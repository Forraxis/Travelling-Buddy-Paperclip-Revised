#!/usr/bin/env python3
"""
Harvest the Lets Go Caravan & Camping manufacturer directory → name / website /
address / phone per maker. The websites become the dork targets for the per-maker
descriptive-spec harvest; addresses help dedup + future data-asks.

EGRESS: via the n8n VPN webhook (not this box). Polite (8-15s, abort-on-block).
Source: manufacturer-sitemap.xml (clean enumeration, ~50 makers).
Output: ops/n8n/.letsgo-manufacturers.jsonl + ops/letsgo-manufacturers.md (review).
No DB writes, no commit.
"""
import json, random, re, sys, time, urllib.request

WH = "http://172.16.45.151:5678/webhook/caravan-fetch"
URLS_FILE = "ops/n8n/.letsgo-manufacturer-urls.txt"
OUT = "ops/n8n/.letsgo-manufacturers.jsonl"
MD = "ops/letsgo-manufacturers.md"
DELAY_MIN, DELAY_MAX = 8, 15

ASSET = re.compile(r'(maxcdn|bootstrapcdn|cloudflare|fontawesome|cdnjs|gstatic|'
                   r'googleapis|google\.com|jquery|/ajax/|facebook|instagram|youtube|'
                   r'twitter|linkedin|wp\.com|gravatar|letsgocaravan)', re.I)


def fetch(url):
    try:
        data = json.dumps({"url": url}).encode()
        req = urllib.request.Request(WH, data=data,
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=110) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
        return int(d.get("statusCode") or 0), d.get("html") or ""
    except Exception:  # noqa
        return 0, ""


def parse(url, h):
    slug = url.rstrip("/").split("/")[-1]
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.I | re.S)
    name = re.sub(r'<[^>]+>', ' ', h1.group(1)).strip() if h1 else slug.replace('-', ' ').title()
    # website: first external link that isn't an asset/social host
    cand = [x for x in re.findall(r'href=[\"\']([^\"\']+)[\"\']', h)
            if x.startswith('http') and not ASSET.search(x)]
    website = cand[0] if cand else None
    addr = re.search(r'(\d{1,5}[^<>{}\"]{4,60}?(?:QLD|NSW|VIC|WA|SA|TAS|NT|ACT)[^<>{}\"]{0,6}\d{4})', h)
    phone = re.search(r'tel:[+ ]?(\d[\d ]{7,14})', h) or re.search(r'(\(0[2-8]\)\s?\d{4}\s?\d{4}|1[38]00\s?\d{3}\s?\d{3})', h)
    return {"slug": slug, "name": name, "website": website,
            "address": (addr.group(1).strip() if addr else None),
            "phone": (phone.group(1).strip() if phone else None),
            "url": url, "websiteCandidates": list(dict.fromkeys(cand))[:4]}


def main():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    urls = [u.strip() for u in open(URLS_FILE) if u.strip()
            and u.rstrip().endswith('/') and u.count('/') > 5]  # drop the index page
    open(OUT, "w").close()
    with open(MD, "w") as f:
        f.write("# Lets Go Caravan & Camping — manufacturer directory\n\n")
        f.write(f"{len(urls)} makers · name / website / address — for the per-maker spec dork\n\n")
        f.write("| # | name | website | address | phone |\n|---|------|---------|---------|-------|\n")
    log(f"=== harvest {len(urls)} manufacturer pages (VPN, {DELAY_MIN}-{DELAY_MAX}s) ===")
    n = 0
    for i, url in enumerate(urls):
        if i > 0:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        status, h = fetch(url)
        if status in (403, 429):
            log(f"  BLOCKED {status} — stopping: {url}"); break
        if status != 200:
            log(f"  skip {status} {url}"); continue
        r = parse(url, h)
        with open(OUT, "a") as f:
            f.write(json.dumps(r) + "\n")
        n += 1
        with open(MD, "a") as f:
            f.write(f"| {n} | {r['name'][:34]} | {r['website'] or '-'} | "
                    f"{(r['address'] or '-')[:40]} | {r['phone'] or '-'} |\n")
        log(f"  {n}/{len(urls)} {r['name'][:28]:28} {r['website'] or '-'}")
    log(f"\nDONE: {n} makers → {OUT} · review → {MD}")


if __name__ == "__main__":
    main()
