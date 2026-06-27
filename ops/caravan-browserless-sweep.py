#!/usr/bin/env python3
"""
Sweep the accessible (non-DataDome) JS-rendered caravan dealer sites for ATM/GTM/Tare/Ball,
rendering each listing through Browserless (egress = the ProtonVPN, since browserless runs in
gluetun's netns on .151). Plain fetch only saw the JS template ({{atm}}); Browserless renders
the real value. Feeds the same aggregate -> provenance -> land pipeline as caravanking.

Sites are config-driven (sitemap + listing filter). Flexible weight extractor handles both
"ATM: 3500 KG" (caravanking) and "TARE 2455 ATM 3500 BALL 292" (davebenson) forms.

Polite: one at a time, randomised delay, abort-on-block, resumable. Every URL logged to the
.md review file. No DB writes, no commit.
"""
import json, os, random, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caravan_extract import extract, hold_raw  # noqa: E402

BL = "http://172.16.45.151:3100"
TOKEN = "68ffe6fcc40391c41de254042dc8bf90ccb5fbe0d78b2708007e09ae96d7ff38"
WH = "http://172.16.45.151:5678/webhook/caravan-fetch"  # plain VPN fetch for sitemaps (xml)
OUT = "ops/n8n/.caravan-sweep-candidates.jsonl"
RAW = "ops/n8n/.caravan-sweep-raw.jsonl"        # manifest (site/slug/year/hash/bytes)
RAW_DIR = "ops/n8n/.caravan-sweep-raw-html"     # full gzipped page HTML — re-parse anything
MD = "ops/caravan-sweep-log.md"
DELAY_MIN, DELAY_MAX = 6, 14

SITES = [
    {
        "name": "davebenson",
        "sitemap": "https://stock.davebensoncaravans.com.au/caravan-sitemap.xml",
        "filter": r"/(used|new)-caravans/for-sale/",
    },
    {
        "name": "camperagent",
        "sitemap": "https://www.camperagent.com.au/sitemap_vehicle-details.xml",
        "filter": r"/vehicle-details/",
    },
]


def vpn_get(url):
    try:
        data = json.dumps({"url": url}).encode()
        req = urllib.request.Request(WH, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=100) as r:
            return json.loads(r.read().decode("utf-8", "replace")).get("html") or ""
    except Exception:  # noqa
        return ""


def render(url):
    """Render via Browserless (VPN egress). Returns (ok, html)."""
    body = json.dumps({"url": url, "bestAttempt": True,
                       "gotoOptions": {"waitUntil": "networkidle2", "timeout": 35000}}).encode()
    req = urllib.request.Request(f"{BL}/content?token={TOKEN}", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            h = r.read().decode("utf-8", "replace")
        block = "captcha-delivery" in h.lower() or "just a moment" in h.lower()
        return (not block and len(h) > 5000), h
    except Exception:  # noqa
        return False, ""


def weight(label, h):
    # LABEL  (optional :)  NUMBER  (optional kg) — caravan-sane bounds, take the first plausible
    for m in re.finditer(label + r"\s*:?\s*([0-9][0-9,]{2,4})(?:\s*kg)?\b", h, re.I):
        n = int(m.group(1).replace(",", ""))
        if 250 <= n <= 6000:
            return n
    return None


def ident(url):
    # Build a caravanking-style "YEAR-make-model" slug so the aggregate's resolver can parse it.
    parts = [p for p in url.split("?")[0].rstrip("/").split("/") if p]
    # case A: a segment already embeds year+make+model (e.g. "2018-avida-ceduna")
    seg = next((p for p in parts
                if re.search(r"(19|20)\d{2}", p) and "-" in p and not p.replace("-", "").isdigit()), None)
    if seg:
        return seg, int(re.search(r"(19|20)\d{2}", seg).group())
    # case B: year is its own segment (davebenson) — make/model are the two before it
    yi = next((i for i, p in enumerate(parts) if re.fullmatch(r"(19|20)\d{2}", p)), None)
    if yi is not None and yi >= 2:
        return f"{parts[yi]}-{parts[yi - 2]}-{parts[yi - 1]}", int(parts[yi])
    return (parts[-1] if parts else ""), None


def main():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    done = set()
    if os.path.exists(OUT):
        for line in open(OUT):
            try:
                done.add(json.loads(line)["url"])
            except Exception:  # noqa
                pass
    if not os.path.exists(MD) or os.path.getsize(MD) == 0:
        with open(MD, "w") as f:
            f.write("# Caravan Browserless sweep (JS dealer sites, via VPN)\n\n")
            f.write("| # | site | year | slug | ATM | GTM | Tare | Ball | BodyL | Water | Axle | URL |\n")
            f.write("|---|---|---|---|---|---|---|---|---|---|---|---|\n")

    n = len(done)
    for site in SITES:
        sm = vpn_get(site["sitemap"])
        urls = [u for u in re.findall(r"<loc>([^<]+)</loc>", sm) if re.search(site["filter"], u)]
        todo = [u for u in urls if u not in done]
        log(f"=== {site['name']}: {len(todo)} to render ({len(urls) - len(todo)} done) ===")
        for i, url in enumerate(todo):
            if n > len(done) or i > 0:
                time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            ok, h = render(url)
            if not ok:
                if "captcha-delivery" in h.lower():
                    log(f"  BLOCKED (datadome) — stopping {site['name']}: {url}")
                    break
                log(f"  {site['name']} skip (render fail) {url}")
                continue
            slug, year = ident(url)
            hold_raw(h, RAW_DIR, RAW, {"site": site["name"], "slug": slug, "year": year})  # COMPLETE raw HTML
            rec = {"url": url, "site": site["name"], "slug": slug, "year": year,
                   **extract(h)}  # rich: weights + lengths + water + gas + axle + features
            with open(OUT, "a") as f:
                f.write(json.dumps(rec) + "\n")
            n += 1
            with open(MD, "a") as f:
                f.write(f"| {n} | {site['name']} | {year or '-'} | {slug[:26]} | {rec['atmKg'] or '-'} | "
                        f"{rec['gtmKg'] or '-'} | {rec['tareKg'] or '-'} | {rec['ballKg'] or '-'} | "
                        f"{rec.get('bodyLengthMm') or '-'} | {rec.get('freshWaterL') or '-'} | "
                        f"{(rec.get('axleConfiguration') or '-')[:6]} | {url} |\n")
            if (i + 1) % 10 == 0:
                log(f"  {site['name']} {i + 1}/{len(todo)} (last ATM={rec['atmKg']} year={year})")
    log(f"\nDONE: {n - len(done)} rendered this run → {OUT} · review → {MD}")


if __name__ == "__main__":
    main()
