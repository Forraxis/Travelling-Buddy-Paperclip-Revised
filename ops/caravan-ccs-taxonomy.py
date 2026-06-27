#!/usr/bin/env python3
"""
Harvest the CCS make -> model taxonomy (+ detail-listing discovery) via BrightData.

CCS's all-caravans results page exposes a canonical **Make facet** (~490 makes — far
wider than our 159-make spine); each make page then exposes its **Model facet** plus the
detail listings. This builds the comprehensive make->model spine AND the discovery URL list
that feeds caravan-ccs-scan.py (replacing its hardcoded 8-make discover()).

ANONYMISED, universal facts only: make + model names are the *manufacturer's* IP (a
"Jayco Silverline" is a universal fact, like an ATM figure) — nothing here links back to
CCS. No CCS url / listing-id is persisted into the taxonomy; detail URLs live only in a
transient discovery file the scanner consumes and never lands.

Raw-held: every make page's cleaned text is appended to .caravan-ccs-taxo-raw.jsonl so the
model facet (or anything else) can be re-parsed later without re-fetching.

Stages (argv):
  python3 ops/caravan-ccs-taxonomy.py makes            # stage 1: make list only (1 request)
  python3 ops/caravan-ccs-taxonomy.py models [N]       # stage 2: model facet for first N makes
Outputs:
  ops/n8n/.caravan-ccs-makes.jsonl       make spine {slug, name}
  ops/n8n/.caravan-ccs-taxonomy.jsonl    {make, name, models:[...], listingHint}
  ops/n8n/.caravan-ccs-detail-urls.txt   detail URLs for the scanner (transient, gitignored)
  ops/n8n/.caravan-ccs-taxo-raw.jsonl    raw make-page text (re-parse store)
  ops/caravan-ccs-taxonomy.md            human-review table
"""
import hashlib, json, os, random, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caravan_extract import hold_raw  # noqa: E402

ALL = "https://www.caravancampingsales.com.au/items/caravans-category/"
MAKE_URL = "https://www.caravancampingsales.com.au/items/{slug}/caravans-category/"
MAKES = "ops/n8n/.caravan-ccs-makes.jsonl"
TAXO = "ops/n8n/.caravan-ccs-taxonomy.jsonl"
DETAILS = "ops/n8n/.caravan-ccs-detail-urls.txt"
RAW = "ops/n8n/.caravan-ccs-taxo-raw.jsonl"      # manifest (slug/hash/bytes)
RAW_DIR = "ops/n8n/.caravan-ccs-taxo-raw-html"   # full gzipped page HTML — re-parse anything
MD = "ops/caravan-ccs-taxonomy.md"
DELAY_MIN, DELAY_MAX = 4, 9  # gentle: comfortably above CCS robots Crawl-delay: 2

# facet slugs that are states / categories / conditions, not makes
DROP = {
    "new-south-wales", "victoria", "queensland", "south-australia", "western-australia",
    "tasmania", "northern-territory", "australian-capital-territory", "caravans",
    "new", "used", "demo",
}
NOISE = re.compile(
    r"(state|category|subcategory|condition|poptop-?\d|-\d{2,}$|ambulance|fifth-wheeler$)", re.I)


def env(k):
    for ln in open(".env.local"):
        if ln.startswith(k + "="):
            return ln.split("=", 1)[1].strip().strip('"')
    return ""


BRD_KEY = env("BRIGHTDATA_API_KEY")


def unlock(url):
    body = json.dumps({"zone": "test", "url": url, "format": "raw", "country": "au"}).encode()
    req = urllib.request.Request("https://api.brightdata.com/request", data=body,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {BRD_KEY}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=80) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:  # noqa
        return ""


def clean_text(h):
    h = re.sub(r"<(script|style|svg)[^>]*>.*?</\1>", " ", h, flags=re.S | re.I)
    import html as _h
    return re.sub(r"\s+", " ", _h.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def title(slug):
    return " ".join(w.upper() if w in ("rv", "ab", "mdc") else w.capitalize()
                    for w in slug.split("-"))


def extract_makes(h):
    """Canonical make slugs from the all-caravans Make facet, de-noised."""
    slugs = sorted(set(re.findall(r"/items/([a-z0-9][a-z0-9-]+)/caravans-category/", h, re.I)))
    return [s for s in slugs if s not in DROP and not NOISE.search(s) and not re.match(r"\d{4}-", s)]


def extract_models(h, make):
    """Model-facet slugs under a make page, de-noised (drop dealer-typed listing junk)."""
    raw = re.findall(rf"/items/{re.escape(make)}/([a-z0-9][a-z0-9-]+)/caravans-category/", h, re.I)
    out = []
    for s in dict.fromkeys(raw):
        if re.match(r"\d{4}-", s):          # year-prefixed dealer slug
            continue
        if re.fullmatch(r"[\d-]+", s):       # pure numbers / dashes
            continue
        if NOISE.search(s) or len(s) > 40:
            continue
        # drop slugs that embed the make name again (re-typed listing titles)
        if s.startswith(make + "-") or f"-{make}-" in s:
            continue
        out.append(s)
    return out


def extract_details(h):
    return sorted(set("https://www.caravancampingsales.com.au" + m
                      for m in re.findall(r"/items/details/[a-z0-9-]+/SSE-AD-\d+/?", h, re.I)))


def stage_makes():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    log("=== stage 1: make facet ===")
    h = unlock(ALL)
    if len(h) < 50000 or "captcha-delivery" in h.lower():
        log(f"  FAILED ({len(h)}b)"); sys.exit(1)
    makes = extract_makes(h)
    with open(MAKES, "w") as f:
        for s in makes:
            f.write(json.dumps({"slug": s, "name": title(s)}) + "\n")
    log(f"  {len(makes)} makes -> {MAKES}")
    log(f"  sample: {makes[:12]}")
    return makes


def stage_models(limit):
    log = lambda m: print(m, file=sys.stderr, flush=True)
    if not os.path.exists(MAKES):
        stage_makes()
    makes = [json.loads(l) for l in open(MAKES) if l.strip()]
    if limit:
        makes = makes[:limit]
    # RESUMABLE + gentle: never re-fetch a make we already have (don't re-hit their pages).
    done = set()
    if os.path.exists(TAXO):
        done = {json.loads(l)["make"] for l in open(TAXO) if l.strip()}
    todo = [m for m in makes if m["slug"] not in done]
    if not done:  # fresh run — init outputs + header
        open(TAXO, "w").close()
        open(DETAILS, "w").close()
        open(RAW, "w").close()
        with open(MD, "w") as f:
            f.write("# CCS make -> model taxonomy (BrightData, facts-only)\n\n")
            f.write(f"{len(makes)} makes · model facets de-noised · no CCS urls persisted\n\n")
            f.write("| # | make | models | detail listings |\n|---|---|---|---|\n")
    log(f"=== stage 2: model facets · {len(todo)} to do ({len(done)} already held) of {len(makes)} ===")
    total_models = total_details = 0
    for j, mk in enumerate(todo):
        i = len(done) + j
        if i > 0:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        h = unlock(MAKE_URL.format(slug=mk["slug"]))
        if len(h) < 30000 or "captcha-delivery" in h.lower():
            log(f"  {i+1}/{len(makes)} {mk['slug']}: blocked/empty ({len(h)}b)")
            continue
        models = extract_models(h, mk["slug"])
        details = extract_details(h)
        # hold the COMPLETE raw HTML (gzipped) so any field can be re-parsed without re-fetching
        hold_raw(h, RAW_DIR, RAW, {"make": mk["slug"]})
        with open(TAXO, "a") as f:
            f.write(json.dumps({"make": mk["slug"], "name": mk["name"], "models": models,
                                "listingHint": len(details)}) + "\n")
        with open(DETAILS, "a") as f:
            for u in details:
                f.write(u + "\n")
        with open(MD, "a") as f:
            f.write(f"| {i+1} | {mk['name']} | {len(models)}: {', '.join(models[:8])}"
                    f"{'…' if len(models) > 8 else ''} | {len(details)} |\n")
        total_models += len(models)
        total_details += len(details)
        log(f"  {i+1}/{len(makes)} {mk['slug']}: {len(models)} models, {len(details)} listings")
    # de-dup the discovery URL file
    if os.path.exists(DETAILS):
        urls = sorted(set(u.strip() for u in open(DETAILS) if u.strip()))
        with open(DETAILS, "w") as f:
            f.write("\n".join(urls) + "\n")
        total_details = len(urls)
    log(f"\nDONE: {len(makes)} makes · {total_models} models · {total_details} unique detail URLs")
    log(f"  taxonomy -> {TAXO} · discovery -> {DETAILS} · raw -> {RAW} · review -> {MD}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "makes"
    if cmd == "makes":
        stage_makes()
    elif cmd == "models":
        stage_models(int(sys.argv[2]) if len(sys.argv) > 2 else 0)
    else:
        print("usage: caravan-ccs-taxonomy.py makes | models [N]", file=sys.stderr)
        sys.exit(2)
