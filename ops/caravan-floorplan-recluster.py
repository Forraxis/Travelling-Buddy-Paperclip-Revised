#!/usr/bin/env python3
"""
Caravan floorplan RE-CLUSTER — analysis + land-ready candidates (CATALOGUE_GRANULARITY_PLAN.md
milestone 3). Re-aggregates the SAME held listing candidates as caravan-listings-aggregate.py,
but keys on (make, model, year, FLOORPLAN) instead of (make, model, year) — so one
"Atlantic New Generation 2017" stops merging 6-berth and 2-berth layouts (very different ATMs)
into a single median.

NO re-scrape: reads the same .caravan-*-candidates.jsonl already on disk. NO DB writes — this
emits the new candidate set + a split report for Rule-11 review; landing is the separate gated
job (caravan-floorplan-reland-local.ts).

Floorplan key: the residual code string of the slug after year+make+nameplate are removed —
the berth count, the manufacturer floorplan/model-code (n206, s212, ht190, w1403-2f, m230-1s)
and the layout suffix (rd/md/fd/…). This is exactly what clean_model() throws away today.

Output:
  ops/n8n/.caravan-catalogue-fp-candidates.jsonl   (one row per (make,model,year,floorplan))
  ops/caravan-floorplan-recluster.md               (split report + worked examples)
"""
import json, re, html, statistics as st
from collections import defaultdict, Counter

# ---- make dictionary (identical to caravan-listings-aggregate.py) ----
makes = set()
for l in open('ops/n8n/.caravan-makes-merged.jsonl'):
    makes.add(html.unescape(json.loads(l)['name']).lower())
HERITAGE = {'statesman', 'roadstar', 'compass', 'trailcraft', 'millard', 'evernew', 'paramount',
            'golden eagle', 'dreamhaven', 'paradise', 'swift', 'roma', 'traveller', 'western', 'jurgens',
            'galaxy', 'sterling', 'jayco', 'coromal', 'retreat', 'supreme', 'crusader', 'nova', 'windsor',
            'regent', 'avan', 'franklin', 'goldstream', 'kimberley kamper', 'kimberley kampers', 'red centre',
            'new age', 'snowy river', 'design rv', 'royal flair', 'on the move', 'aussie wide', 'jb',
            'spaceland', 'concept', 'newlands', 'olympic', 'viscount', 'majestic', 'elite', 'victory'}
makes |= HERITAGE
makes |= {'masterpiece', 'opal', 'universal', 'montana', 'billabong', 'atlantic', 'stoney creek',
          'ezytrail', 'spaceland', 'galaxy', 'legend', 'kedron', 'kokoda', 'mdc', 'adria', 'silverline'}
base = set()
for m in makes:
    base.add(re.sub(r'[^a-z0-9]+', '-', m).strip('-'))
    m2 = re.sub(r'\b(caravans?|campers?|rv|motorhomes?|australia|annexes?|custom)\b', ' ', m).strip()
    if len(m2) > 2:
        base.add(re.sub(r'[^a-z0-9]+', '-', m2).strip('-'))
make_slugs = sorted(base, key=len, reverse=True)

NOISE = re.compile(r'\b(caravan|caravans|pop-?top|off-?road|offroad|semi-?off-?road|full|'
                   r'hybrid|camper|trailer|motorhome|series|edition|with|and|the|van|wagon|shower|toilet|'
                   r'slide-?out|bunks?|family|luxury|deluxe|tourer|used|new|2|sized|full-sized)\b')
NOISE_WORDS = {'caravan', 'caravans', 'poptop', 'pop-top', 'offroad', 'off-road', 'full', 'hybrid',
               'camper', 'trailer', 'motorhome', 'series', 'edition', 'with', 'and', 'the', 'van',
               'wagon', 'shower', 'toilet', 'family', 'luxury', 'deluxe', 'tourer', 'used', 'new', 'sized'}
LAYOUT = {'rd', 'md', 'fd', 'pt', 'dl', 'px', 'ob', 'sl', 'cb', 'ct', 'rb', 'fb', 'mb', 'st', 'ns', 'rt', 'ft', 'bt', 'xt', 'lt'}


def _is_code(tok):
    t = tok.lower()
    return bool(re.fullmatch(r'\d{1,4}', t) or re.fullmatch(r'[a-z]\d{1,2}', t)
                or re.fullmatch(r'\d{1,4}[a-z]{1,2}', t) or t in LAYOUT)


def clean_model(model):
    toks = model.split()
    while len(toks) > 1 and _is_code(toks[-1]):
        toks.pop()
    return ' '.join(toks)


def is_junk_model(model):
    return (not model or len(model) <= 2 or re.fullmatch(r'[A-Za-z]', model)
            or re.fullmatch(r'\d+', model) is not None)


def resolve(slug):
    """make/model/year — identical to the production aggregate."""
    yr = re.match(r'(\d{4})', slug)
    year = int(yr.group(1)) if yr else None
    s = re.sub(r'^\d{4}-', '', slug)
    make = next((m for m in make_slugs if s == m or s.startswith(m + '-')), None)
    rest = s[len(make) + 1:] if make else s
    fp = re.search(r'(\d{1,2}[-.]\d{1,2}(?:[-.]\d)?)', rest)
    model = NOISE.sub(' ', rest)
    if fp:
        model = model.replace(fp.group(1), ' ')
    model = re.sub(r'[-\s]+', ' ', model).strip().title()
    model = clean_model(model)
    mk = make.replace('-', ' ').title() if make else None
    if mk:
        mk = re.sub(r'\bRv\b', 'RV', mk)
        mk = re.sub(r'\bJb\b', 'JB', mk)
    return mk, model, year


def floorplan_key(slug):
    """The residual code string after year+make+nameplate — berth + model-code + layout.

    Keeps any slug token that is a code (carries a digit, OR is a known layout suffix, OR is a
    lone variant letter). Drops nameplate words and the marketing noise words. Returns None when
    the slug carries no floorplan signal at all (→ falls back to the model-year median, same as
    today). Floorplan naming is dealer-typed and messy (PLAN §12) — this is a best-effort
    normalised discriminator, not a canonical code."""
    s = re.sub(r'^\d{4}-', '', slug)
    make = next((m for m in make_slugs if s == m or s.startswith(m + '-')), None)
    rest = s[len(make) + 1:] if make else s
    fp = []
    for t in rest.split('-'):
        tl = t.lower()
        if not tl or tl in NOISE_WORDS:
            continue
        if re.search(r'\d', tl) or tl in LAYOUT or len(tl) == 1:
            fp.append(tl)
    return '-'.join(fp) or None


def load(path):
    try:
        return [json.loads(l) for l in open(path) if l.strip()]
    except FileNotFoundError:
        return []


rows = (load('ops/n8n/.caravan-listings-candidates.jsonl')
        + load('ops/n8n/.caravan-sweep-candidates.jsonl')
        + load('ops/n8n/.caravan-ccs-candidates.jsonl'))

WFIELDS = ['atmKg', 'gtmKg', 'tareKg', 'ballKg']


def med(vals):
    vals = [v for v in vals if v]
    return int(st.median(vals)) if vals else None


def mode(vals):
    vals = [v for v in vals if v]
    return Counter(vals).most_common(1)[0][0] if vals else None


def bodytype(slugs):
    t = ' '.join(slugs)
    if re.search(r'fifth|5th-wheel', t):
        return 'FIFTH_WHEELER'
    if re.search(r'pop-?top', t):
        return 'CARAVAN_POP_TOP'
    if 'camper' in t:
        return 'CAMPER_TRAILER'
    if 'hybrid' in t:
        return 'HYBRID'
    if re.search(r'off-?road|outback', t):
        return 'OFF_ROAD_CARAVAN'
    if 'motorhome' in t:
        return 'OTHER'
    return 'CARAVAN_FULL_HEIGHT'


def dealer_grade(atms):
    if not atms:
        return None
    if len(atms) >= 2 and max(atms) - min(atms) <= 25:
        return 'HIGH'
    if len(atms) >= 2 and max(atms) - min(atms) > 250:
        return 'DISPUTED'
    return 'MEDIUM' if len(atms) == 1 else 'LOW'


def berths_from_fp(fp):
    """Leading 1-2 digit token of the floorplan key is the berth count (AU CCS convention)."""
    if not fp:
        return None
    m = re.match(r'(\d{1,2})(?:-|$)', fp)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 10 else None
    return None


# ---- cluster both ways: old (m,model,year) and new (m,model,year,fp) ----
old_clusters = defaultdict(list)
new_clusters = defaultdict(list)
unresolved = []
for r in rows:
    slug = r.get('slug')
    if not slug:
        continue
    mk, model, year = resolve(slug)
    if not mk or not year or is_junk_model(model):
        unresolved.append(slug)
        continue
    fp = floorplan_key(slug)
    old_clusters[(mk, model, year)].append(r)
    new_clusters[(mk, model, year, fp)].append(r)


def build_cand(key, ls):
    mk, model, year, fp = key
    rb = {f: [] for f in WFIELDS}
    de = {f: [] for f in WFIELDS}
    for x in ls:
        rbx = x.get('redbook') or {}
        dex = x.get('dealer')
        if dex is None and 'redbook' not in x:
            dex = {f: x.get(f) for f in WFIELDS}
        dex = dex or {}
        for f in WFIELDS:
            if rbx.get(f):
                rb[f].append(rbx[f])
            if dex.get(f):
                de[f].append(dex[f])
    redbook = {f: med(rb[f]) for f in WFIELDS}
    dealer = {f: med(de[f]) for f in WFIELDS}
    if not any(redbook.values()) and not any(dealer.values()):
        return None
    urls = [x['url'] for x in ls if x.get('url')]
    return {
        'make': mk, 'model': model or '(unknown)', 'year': year,
        'floorplan': fp,
        'berths': berths_from_fp(fp) or mode([x.get('sleeps') for x in ls]),
        'bodyType': bodytype([x['slug'] for x in ls]),
        'redbook': redbook,
        'dealer': dealer,
        'dealerAtmRange': [min(de['atmKg']), max(de['atmKg'])] if de['atmKg'] else None,
        'redbookCount': max(len(rb[f]) for f in WFIELDS),
        'dealerCount': max(len(de[f]) for f in WFIELDS),
        'dealerConfidence': dealer_grade(de['atmKg']),
        'bodyLengthMm': med([x.get('bodyLengthMm') for x in ls]),
        'overallLengthMm': med([x.get('overallLengthMm') for x in ls]),
        'freshWaterL': med([x.get('freshWaterL') for x in ls]),
        'greyWaterL': med([x.get('greyWaterL') for x in ls]),
        'gasBottleConfig': mode([x.get('gasBottleConfig') for x in ls]),
        'axleConfiguration': mode([x.get('axleConfiguration') for x in ls]),
        'sleeps': mode([x.get('sleeps') for x in ls]),
        'listings': len(ls),
        'sources': urls,
    }


cands = [c for c in (build_cand(k, ls) for k, ls in new_clusters.items()) if c]
cands.sort(key=lambda c: (c['make'], c['model'], c['year'], c['floorplan'] or ''))
with open('ops/n8n/.caravan-catalogue-fp-candidates.jsonl', 'w') as f:
    for c in cands:
        f.write(json.dumps(c) + '\n')

# ---- split analysis: which (make,model,year) clusters separate into >1 floorplan ----
by_my = defaultdict(set)
for (mk, model, year, fp) in new_clusters:
    by_my[(mk, model, year)].add(fp)
split = {k: v for k, v in by_my.items() if len(v) >= 2}

# worked examples: split clusters whose per-floorplan ATM actually disagrees materially
examples = []
fp_atm = {}
for c in cands:
    atm = c['redbook']['atmKg'] or c['dealer']['atmKg']
    if atm:
        fp_atm[(c['make'], c['model'], c['year'], c['floorplan'])] = atm
for (mk, model, year), fps in split.items():
    atms = [fp_atm.get((mk, model, year, fp)) for fp in fps]
    atms = [a for a in atms if a]
    if len(atms) >= 2 and max(atms) - min(atms) >= 200:
        examples.append(((mk, model, year), max(atms) - min(atms),
                         sorted(fps, key=lambda x: x or '')))
examples.sort(key=lambda e: -e[1])

with open('ops/caravan-floorplan-recluster.md', 'w') as f:
    f.write(f"# Caravan floorplan re-cluster (DRY — no DB writes)\n\n")
    f.write(f"Same {len(rows)} held listings, re-keyed on (make, model, year, **floorplan**).\n\n")
    f.write(f"- old clusters (make,model,year): **{len(old_clusters)}**\n")
    f.write(f"- new clusters (make,model,year,floorplan): **{len(new_clusters)}** "
            f"→ candidates with weights: **{len(cands)}**\n")
    f.write(f"- (make,model,year) groups that SPLIT into ≥2 floorplans: **{len(split)}**\n")
    f.write(f"- of those, ≥200 kg ATM disagreement between floorplans: **{len(examples)}**\n")
    f.write(f"- unresolved slugs: {len(unresolved)}\n\n")
    f.write("## Worked examples — model-years where floorplans had been merged to one median\n\n")
    f.write("| make | model | year | ATM spread (kg) | floorplans |\n|---|---|---|---|---|\n")
    for (mk, model, year), spread, fps in examples[:40]:
        fp_show = ', '.join(f"{fp}={fp_atm.get((mk,model,year,fp),'?')}" for fp in fps)
        f.write(f"| {mk[:16]} | {model[:20]} | {year} | {spread} | {fp_show[:80]} |\n")

print(f"listings {len(rows)} → old {len(old_clusters)} (make,model,year) "
      f"→ new {len(new_clusters)} (make,model,year,floorplan); {len(cands)} with weights")
print(f"  {len(split)} model-years split into ≥2 floorplans; "
      f"{len(examples)} with ≥200 kg ATM disagreement between layouts")
print("\ntop worked examples (floorplan merge that was hiding an ATM spread):")
for (mk, model, year), spread, fps in examples[:12]:
    fp_show = ', '.join(f"{fp}={fp_atm.get((mk,model,year,fp),'?')}" for fp in fps)
    print(f"  {mk[:14]:14} {model[:18]:18} {year}  Δ{spread:>4}kg  {fp_show[:70]}")
print("\ncandidates → ops/n8n/.caravan-catalogue-fp-candidates.jsonl"
      "\nreport     → ops/caravan-floorplan-recluster.md\nNO DB writes (Rule-11 gated landing is separate).")
