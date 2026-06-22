#!/usr/bin/env python3
"""
SMALL, SLOW proof scrape of caravanking.com.au Jayco listings — 15 pages.

Purpose: prove we can pull identity + ATM/GTM/Tare/Ball + plate-photo URL from a
caravan listing page cleanly (the listings path that snippet-parsing couldn't do
because it lacked model identity). Listing pages carry the exact van (year+model+
floorplan in the URL) AND the weight quad in plain text — so identity is explicit.

POLITENESS (deliberately glacial — this is a proof, not a harvest):
  - 15 URLs, ONE at a time, no concurrency.
  - 22-38s RANDOM delay between requests (not fixed — fixed intervals look botty).
  - realistic browser User-Agent + Referer; robots.txt is Allow:/ (checked).
  - ABORT immediately on any non-200 (403/429/block) — no retry hammering.
Egress: from this box (caravanking is a benign listing site, like the others
fetched this session). SCALING beyond this proof moves to the n8n VPN.

Output: ops/n8n/.caravan-listings-candidates.jsonl (no DB writes, no commit).
"""
import json
import random
import re
import sys
import time
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
REFERER = "https://www.caravanking.com.au/"
OUT = "ops/n8n/.caravan-listings-candidates.jsonl"
DELAY_MIN, DELAY_MAX = 22, 38  # seconds, randomised

URLS = [
    "https://www.caravanking.com.au/caravan/2021-jayco-journey-outback-17-58-3/",
    "https://www.caravanking.com.au/caravan/2021-jayco-silverline-semi-offroad-caravan/",
    "https://www.caravanking.com.au/caravan/2019-jayco-journey-pop-top-caravan-with-bunks/",
    "https://www.caravanking.com.au/caravan/1998-jayco-starcraft-pop-top-caravan/",
    "https://www.caravanking.com.au/caravan/2020-jayco-all-terrain-offroad-caravan/",
    "https://www.caravanking.com.au/caravan/2020-jayco-journey-outback-offroad-caravan/",
    "https://www.caravanking.com.au/caravan/2014-jayco-starcraft-13-42-pop-top-caravan/",
    "https://www.caravanking.com.au/caravan/2004-jayco-heritage-full-caravan/",
    "https://www.caravanking.com.au/caravan/2021-jayco-journey-16-51-3-caravan/",
    "https://www.caravanking.com.au/caravan/2023-jayco-journey-pop-top-caravan-2/",
    "https://www.caravanking.com.au/caravan/2022-jayco-starcraft-caravan/",
    "https://www.caravanking.com.au/caravan/2018-jayco-journey-full-caravan-with-double-bunks/",
    "https://www.caravanking.com.au/caravan/2018-jayco-journey-caravan/",
    "https://www.caravanking.com.au/caravan/2022-jayco-journey-outback-pop-top-caravan/",
    "https://www.caravanking.com.au/caravan/2017-jayco-starcraft-outback-caravan/",
]


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": REFERER,
                                               "Accept": "text/html"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa
        return 0, str(e)


def num(html: str, label: str):
    m = re.search(label + r"\s*:?\s*([0-9][0-9,]{2,4})\s*KG", html, re.I)
    return int(m.group(1).replace(",", "")) if m else None


def identity(url: str):
    slug = url.rstrip("/").split("/")[-1]
    year = re.match(r"(\d{4})", slug)
    fp = re.search(r"(\d{1,2}[-.]\d{1,2}(?:[-.]\d)?)", slug)
    return {"slug": slug,
            "year": int(year.group(1)) if year else None,
            "floorplan": fp.group(1) if fp else None}


def main():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    open(OUT, "w").close()
    log(f"=== SLOW SCRAPE · {len(URLS)} caravanking listings · {DELAY_MIN}-{DELAY_MAX}s delays ===")
    ok = 0
    for i, url in enumerate(URLS):
        if i > 0:
            d = random.uniform(DELAY_MIN, DELAY_MAX)
            log(f"  …sleeping {d:.0f}s")
            time.sleep(d)
        t0 = time.time()
        status, html = fetch(url)
        if status != 200:
            log(f"  {i+1}/{len(URLS)} HTTP {status} — ABORTING (block/err): {url}")
            break
        ident = identity(url)
        rec = {
            "url": url, **ident,
            "title": (re.search(r"<title>(.*?)</title>", html, re.I) or [None, None])[1],
            "tareKg": num(html, "TARE"),
            "gtmKg": num(html, "GTM"),
            "atmKg": num(html, "ATM"),
            "ballKg": num(html, r"Ball\s*Weight"),
            "imgCount": len(re.findall(r"<img", html, re.I)),
        }
        # internal consistency: ATM - GTM should ~= ball-at-ATM (not the tare ball)
        rec["atmMinusGtm"] = (rec["atmKg"] - rec["gtmKg"]) if rec["atmKg"] and rec["gtmKg"] else None
        with open(OUT, "a") as f:
            f.write(json.dumps(rec) + "\n")
        ok += 1
        log(f"  {i+1}/{len(URLS)} 200 ({time.time()-t0:.1f}s) {ident['year']} fp={ident['floorplan']} "
            f"ATM={rec['atmKg']} GTM={rec['gtmKg']} TARE={rec['tareKg']} BALL={rec['ballKg']}")
    log(f"\nDONE: {ok}/{len(URLS)} fetched → {OUT}")


if __name__ == "__main__":
    main()
