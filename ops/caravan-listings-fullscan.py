#!/usr/bin/env python3
"""
FULL slow scan of caravanking.com.au caravan listings (~506, all makes) for the
ATM/GTM/Tare/Ball weight quad + identity. Builds the caravan ATM/GTM dataset
(CONFIRMED tier — dealer-transcribed plate figures). No OCR, no images downloaded.

EGRESS: via the n8n VPN webhook (http://172.16.45.151:5678/webhook/caravan-fetch) —
NOT this box / home IP (verified: webhook egress 144.48.38.190 != home 110.141.198.87).
caravanking robots.txt = `Allow: /`; glacial pace + abort-on-block still apply.

POLITENESS: one at a time, 22-38s random delay, browser UA+Referer. On a 403/429
(block) it STOPS immediately and respects it. Transient 5xx/timeout → one 60s
retry then skip. RESUMABLE: skips URLs already in the candidate JSONL.

OUTPUTS:
  - ops/caravan-scan-log.md  → live human-review table (every URL logged), for Tim
  - ops/n8n/.caravan-listings-candidates.jsonl → full records (no DB writes/commit)
"""
import json
import os
import random
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caravan_extract import extract, hold_raw  # noqa: E402

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
REFERER = "https://www.caravanking.com.au/caravan/"
URLS_FILE = "ops/n8n/.caravan-urls.txt"
OUT = "ops/n8n/.caravan-listings-candidates.jsonl"
RAW = "ops/n8n/.caravan-listings-raw.jsonl"        # manifest (slug/year/hash/bytes)
RAW_DIR = "ops/n8n/.caravan-listings-raw-html"     # full gzipped page HTML — re-parse anything
MD = "ops/caravan-scan-log.md"
DELAY_MIN, DELAY_MAX = 22, 38


WEBHOOK = "http://172.16.45.151:5678/webhook/caravan-fetch"


def fetch(url):
    """Fetch via the n8n VPN webhook (egress is the VPN, not this box/home IP)."""
    try:
        data = json.dumps({"url": url}).encode()
        req = urllib.request.Request(WEBHOOK, data=data,
                                     headers={"Content-Type": "application/json"},
                                     method="POST")
        with urllib.request.urlopen(req, timeout=110) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
        return int(d.get("statusCode") or 0), d.get("html") or ""
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:  # noqa
        return 0, ""


def num(html, label):
    m = re.search(label + r"\s*:?\s*([0-9][0-9,]{2,4})\s*KG", html, re.I)
    return int(m.group(1).replace(",", "")) if m else None


def ident(url):
    slug = url.rstrip("/").split("/")[-1]
    y = re.match(r"(\d{4})", slug)
    fp = re.search(r"(\d{1,2}[-.]\d{1,2}(?:[-.]\d)?)", slug)
    desc = re.sub(r"^\d{4}-", "", slug).replace("-", " ").title()
    return slug, (int(y.group(1)) if y else None), (fp.group(1) if fp else None), desc


def main():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    urls = [u.strip() for u in open(URLS_FILE) if u.strip()]
    done = set()
    if os.path.exists(OUT):
        for line in open(OUT):
            try:
                done.add(json.loads(line)["url"])
            except Exception:  # noqa
                pass
    todo = [u for u in urls if u not in done]

    if not os.path.exists(MD) or os.path.getsize(MD) == 0:
        with open(MD, "w") as f:
            f.write("# Caravan Listings Scan — caravanking.com.au\n\n")
            f.write(f"{len(urls)} listings · 22–38s delays · CONFIRMED-tier (dealer-transcribed)\n\n")
            f.write("| # | year | description | ATM | GTM | Tare | Ball | BodyL | OAL | Water | Axle | URL |\n")
            f.write("|---|------|---|---|---|---|---|---|---|---|---|-----|\n")

    log(f"=== FULL SCAN · {len(todo)} to do ({len(done)} already done) of {len(urls)} ===")
    n = len(done)
    ok = 0
    for i, url in enumerate(todo):
        if i > 0:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        status, html = fetch(url)
        if status in (403, 429):
            log(f"  BLOCKED (HTTP {status}) — stopping out of respect: {url}")
            break
        if status != 200:
            time.sleep(60)
            status, html = fetch(url)
            if status != 200:
                log(f"  skip (HTTP {status}) {url}")
                continue
        slug, year, fp, desc = ident(url)
        hold_raw(html, RAW_DIR, RAW, {"slug": slug, "year": year})  # hold COMPLETE raw HTML
        rec = {"url": url, "slug": slug, "year": year, "floorplan": fp, "desc": desc,
               **extract(html)}  # rich: weights + lengths + water + gas + axle + features
        with open(OUT, "a") as f:
            f.write(json.dumps(rec) + "\n")
        n += 1
        with open(MD, "a") as f:
            f.write(f"| {n} | {year or '-'} | {desc[:40]} | {rec['atmKg'] or '-'} | "
                    f"{rec['gtmKg'] or '-'} | {rec['tareKg'] or '-'} | {rec['ballKg'] or '-'} | "
                    f"{rec.get('bodyLengthMm') or '-'} | {rec.get('overallLengthMm') or '-'} | "
                    f"{rec.get('freshWaterL') or '-'} | {(rec.get('axleConfiguration') or '-')[:6]} | {url} |\n")
        ok += 1
        if ok % 10 == 0:
            log(f"  …{ok}/{len(todo)} (last: {year} {desc[:30]} ATM={rec['atmKg']})")
    log(f"\nDONE this run: {ok} scanned → {OUT} · review table → {MD}")


if __name__ == "__main__":
    main()
