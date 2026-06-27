#!/usr/bin/env python3
"""
Harvest the carsales make -> model identity taxonomy via BrightData (facts-only, anonymised).

Purpose: fill make/model/year GAPS in our vehicle catalogue (which comes from the QLD-rego
spine). carsales is the same network as caravancampingsales — its facet/results pages
server-render fine through the Web Unlocker (the DETAIL pages do NOT — DataDome blocks them,
so this harvests IDENTITY only, never the per-listing RedBook specs).

Universal facts only: make + model names are the manufacturer's (a "Toyota LandCruiser" is a
universal fact). No carsales url/listing-id is persisted into the taxonomy. Full make-page HTML
is gzipped + held (private, gitignored) so anything can be re-parsed without re-fetching.

Stages:
  python3 ops/vehicle-carsales-identity.py makes        # make facet (1 request)
  python3 ops/vehicle-carsales-identity.py models [N]    # model facet per make (resumable)
Outputs:
  ops/n8n/.carsales-makes.jsonl        {slug, name}
  ops/n8n/.carsales-identity.jsonl     {make, name, models:[...], years:[...]}
  ops/n8n/.carsales-identity-raw.jsonl + .carsales-identity-raw-html/  (full raw, re-parse)
  ops/carsales-identity.md             review table
"""
import json, os, random, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caravan_extract import hold_raw  # noqa: E402  (shared full-HTML raw helper)

ALL = "https://www.carsales.com.au/cars/"
MAKE_URL = "https://www.carsales.com.au/cars/{slug}/"
MAKES = "ops/n8n/.carsales-makes.jsonl"
IDENT = "ops/n8n/.carsales-identity.jsonl"
RAW = "ops/n8n/.carsales-identity-raw.jsonl"
RAW_DIR = "ops/n8n/.carsales-identity-raw-html"
MD = "ops/carsales-identity.md"
DELAY_MIN, DELAY_MAX = 4, 9  # gentle

# facet slugs that are NOT makes (states / bodystyles / fueltypes / colours / etc.)
NOISE = re.compile(
    r"(state$|bodystyle$|fueltype$|transmission$|drive$|induction$|colour$|category|"
    r"cylinders$|seats$|doors$|-year$|under-|over-|finance|dealer$|details|new-cars|"
    r"used-cars|demo-cars|private|certified|electric$|hybrid$|diesel$|petrol$)", re.I)


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
        with urllib.request.urlopen(req, timeout=85) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:  # noqa
        return ""


def title(slug):
    up = {"bmw", "mg", "gwm", "ldv", "ram", "hsv", "ds", "byd", "jac", "gmc", "ud"}
    return " ".join(w.upper() if w in up else w.capitalize() for w in slug.split("-"))


def extract_makes(h):
    slugs = sorted(set(re.findall(r'/cars/([a-z][a-z0-9-]{1,})/"', h, re.I)))
    return [s for s in slugs if not NOISE.search(s) and not re.match(r"\d", s)]


def extract_models(h, make):
    raw = re.findall(rf"/cars/{re.escape(make)}/([a-z0-9][a-z0-9-]+)/", h, re.I)
    out = []
    for s in dict.fromkeys(raw):
        if NOISE.search(s) or re.match(r"\d{4}-", s) or re.fullmatch(r"[\d-]+", s) or len(s) > 32:
            continue
        out.append(s)
    return out


def extract_years(h):
    yrs = sorted(set(int(y) for y in re.findall(r"/(\d{4})-year/", h)))
    return [y for y in yrs if 1980 <= y <= 2027]


def stage_makes():
    log = lambda m: print(m, file=sys.stderr, flush=True)
    log("=== stage 1: carsales make facet ===")
    h = unlock(ALL)
    if len(h) < 50000:
        log(f"  FAILED ({len(h)}b)"); sys.exit(1)
    makes = extract_makes(h)
    with open(MAKES, "w") as f:
        for s in makes:
            f.write(json.dumps({"slug": s, "name": title(s)}) + "\n")
    log(f"  {len(makes)} makes -> {MAKES}")
    log(f"  sample: {makes[:18]}")
    return makes


def stage_models(limit):
    log = lambda m: print(m, file=sys.stderr, flush=True)
    if not os.path.exists(MAKES):
        stage_makes()
    makes = [json.loads(l) for l in open(MAKES) if l.strip()]
    if limit:
        makes = makes[:limit]
    done = set()
    if os.path.exists(IDENT):
        done = {json.loads(l)["make"] for l in open(IDENT) if l.strip()}
    todo = [m for m in makes if m["slug"] not in done]
    if not done:
        open(IDENT, "w").close()
        open(RAW, "w").close()
        with open(MD, "w") as f:
            f.write("# carsales make -> model identity (BrightData, facts-only)\n\n")
            f.write("| # | make | models | years |\n|---|---|---|---|\n")
    log(f"=== stage 2: model facets · {len(todo)} to do ({len(done)} held) of {len(makes)} ===")
    for j, mk in enumerate(todo):
        i = len(done) + j
        if i > 0:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        h = unlock(MAKE_URL.format(slug=mk["slug"]))
        if len(h) < 30000:
            log(f"  {i+1}/{len(makes)} {mk['slug']}: empty/blocked ({len(h)}b)")
            continue
        models = extract_models(h, mk["slug"])
        years = extract_years(h)
        hold_raw(h, RAW_DIR, RAW, {"make": mk["slug"]})
        with open(IDENT, "a") as f:
            f.write(json.dumps({"make": mk["slug"], "name": mk["name"],
                                "models": models, "years": years}) + "\n")
        with open(MD, "a") as f:
            f.write(f"| {i+1} | {mk['name']} | {len(models)}: {', '.join(models[:8])}"
                    f"{'…' if len(models) > 8 else ''} | {years[0] if years else '-'}-{years[-1] if years else '-'} |\n")
        log(f"  {i+1}/{len(makes)} {mk['slug']}: {len(models)} models, {len(years)} years")
    log(f"\nDONE: {len(makes)} makes processed -> {IDENT}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "makes"
    if cmd == "makes":
        stage_makes()
    elif cmd == "models":
        stage_models(int(sys.argv[2]) if len(sys.argv) > 2 else 0)
    else:
        print("usage: vehicle-carsales-identity.py makes | models [N]", file=sys.stderr)
        sys.exit(2)
