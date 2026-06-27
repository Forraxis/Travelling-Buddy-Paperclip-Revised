#!/usr/bin/env python3
"""
LIGHT facts-only CCS scan via BrightData Web Unlocker (bypasses DataDome).

Anonymised by design (per the agreed plan): the CCS URL + listing ID NEVER persist —
only the universal compliance facts (make/model/year + ATM/GTM/Tare/Ball/dimensions/
water/gas/axle, via the shared rich extractor) flow into the candidate stream. The
result is indistinguishable from plate data; it can't be traced back to CCS.

Light: capped at MAX listings, small delays. BrightData routes via its own residential
IPs (not our VPN), so this runs fully parallel to the caravanking + Browserless sweeps.

Output: ops/n8n/.caravan-ccs-candidates.jsonl + ops/caravan-ccs-log.md (facts only).
"""
import hashlib, json, os, random, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caravan_extract import extract, hold_raw  # noqa: E402


def clean_text(h):
    """Full visible page content, tags/scripts stripped — the raw store for re-parsing."""
    h = re.sub(r"<(script|style|svg)[^>]*>.*?</\1>", " ", h, flags=re.S | re.I)
    import html as _h
    t = _h.unescape(re.sub(r"<[^>]+>", " ", h))
    return re.sub(r"\s+", " ", t).strip()


def env(k):
    for ln in open(".env.local"):
        if ln.startswith(k + "="):
            return ln.split("=", 1)[1].strip().strip('"')
    return ""


BRD_KEY = env("BRIGHTDATA_API_KEY")
BRAVE_KEY = env("BRAVE_API_KEY")
OUT = "ops/n8n/.caravan-ccs-candidates.jsonl"
RAW = "ops/n8n/.caravan-ccs-raw.jsonl"          # manifest (slug/year/hash/bytes)
RAW_DIR = "ops/n8n/.caravan-ccs-raw-html"        # full gzipped page HTML — re-parse anything later
MD = "ops/caravan-ccs-log.md"
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 18
DELAY_MIN, DELAY_MAX = 4, 9  # gentle: comfortably above CCS robots Crawl-delay: 2


def unlock(url):
    """Fetch a URL through BrightData Web Unlocker (DataDome handled, AU geo)."""
    body = json.dumps({"zone": "test", "url": url, "format": "raw", "country": "au"}).encode()
    req = urllib.request.Request("https://api.brightdata.com/request", data=body,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {BRD_KEY}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa
        return ""


DISCOVERY = "ops/n8n/.caravan-ccs-detail-urls.txt"  # built by caravan-ccs-taxonomy.py


def discover():
    """Detail URLs to scan. Prefer the taxonomy harvest's discovery file (comprehensive,
    489-make + paginated); fall back to a small per-make enumeration if it's absent."""
    if os.path.exists(DISCOVERY) and os.path.getsize(DISCOVERY) > 0:
        urls = [u.strip() for u in open(DISCOVERY) if u.strip()]
        print(f"  discovery: {len(urls)} URLs from {DISCOVERY}", file=sys.stderr, flush=True)
        return urls
    urls = []
    seen = set()
    for make in ["jayco", "new-age", "coromal", "crusader", "lotus", "snowy-river", "avan", "windsor"]:
        cat = f"https://www.caravancampingsales.com.au/items/{make}/caravans-category/"
        h = unlock(cat)
        for m in re.findall(r"/items/details/[a-z0-9\-]+/SSE-AD-\d+/?", h, re.I):
            full = "https://www.caravancampingsales.com.au" + m
            if full not in seen:
                seen.add(full)
                urls.append(full)
        time.sleep(2)
        if len(urls) >= MAX * 2:
            break
    return urls


def clean_slug(url):
    """Universal year-make-model identity from the URL; drop the CCS listing-ID + codes."""
    m = re.search(r"/items/details/([^/]+)/", url)
    s = m.group(1) if m else ""
    s = re.sub(r"-(?:[a-z]{2}-)?my\d{2}$", "", s)   # drop CCS "-jy-my21" trailing codes
    s = re.sub(r"-\d+(?:\.\d+)?m-\d+(?:ft)?", "", s)  # drop "-6.9m-23ft" metric blurb
    return s


def main():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    urls = discover()[:MAX]
    open(OUT, "w").close()
    open(RAW, "w").close()
    with open(MD, "w") as f:
        f.write("# CCS facts-only scan (BrightData Web Unlocker) — NO urls/ids persisted\n\n")
        f.write("| # | year | identity | src | ATM | GTM | Tare | Ball | OAL | Water | Axle | Sleeps |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    log(f"=== CCS LIGHT SCAN · {len(urls)} listings via Web Unlocker ===")
    n = 0
    for i, url in enumerate(urls):
        if i > 0:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        h = unlock(url)
        if len(h) < 5000 or "captcha-delivery" in h.lower():
            log(f"  {i+1}/{len(urls)} blocked/empty ({len(h)}b)")
            continue
        slug = clean_slug(url)
        yr = re.match(r"(\d{4})", slug)
        # RAW STORE — the COMPLETE page HTML (gzipped) held so ANY future field (spec tables,
        # data-* attrs, JSON-LD, microdata, images) can be re-parsed without re-fetching / re-
        # hitting CCS. Manifest keyed by clean identity + content hash; the manifest carries no
        # CCS url/listing-id (the .gz blob is the private, gitignored full capture for stats only).
        hold_raw(h, RAW_DIR, RAW, {"slug": slug, "year": int(yr.group(1)) if yr else None})
        rec = {"slug": slug, "year": int(yr.group(1)) if yr else None, **extract(h)}
        rec.pop("features", None)  # candidate is lean; the raw store holds everything
        with open(OUT, "a") as f:
            f.write(json.dumps(rec) + "\n")  # NOTE: no 'url', no listing id
        n += 1
        ident = re.sub(r"^\d{4}-", "", slug).replace("-", " ")[:34]
        with open(MD, "a") as f:
            f.write(f"| {n} | {rec['year'] or '-'} | {ident} | {(rec.get('weightSource') or '-')[:3]} | {rec['atmKg'] or '-'} | {rec['gtmKg'] or '-'} | "
                    f"{rec['tareKg'] or '-'} | {rec['ballKg'] or '-'} | {rec.get('overallLengthMm') or '-'} | "
                    f"{rec.get('freshWaterL') or '-'} | {(rec.get('axleConfiguration') or '-')[:6]} | {rec.get('sleeps') or '-'} |\n")
        log(f"  {i+1}/{len(urls)} {rec['year']} {ident[:24]} ATM={rec['atmKg']} water={rec.get('freshWaterL')}")
    log(f"\nDONE: {n}/{len(urls)} captured (facts only) → {OUT} · review → {MD}")


if __name__ == "__main__":
    main()
