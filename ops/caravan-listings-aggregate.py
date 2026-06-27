#!/usr/bin/env python3
"""
Aggregate ALL caravan-listing sources into clean, confidence-graded per-(make, model, year)
catalogue candidates — now carrying the full rich field set + the RedBook/dealer weight split.

Sources combined:
  - ops/n8n/.caravan-listings-candidates.jsonl   caravanking (dealer-typed weights)
  - ops/n8n/.caravan-sweep-candidates.jsonl      davebenson/camperagent (dealer-typed)
  - ops/n8n/.caravan-ccs-candidates.jsonl        CCS — carries redbook{} (manufacturer DB) +
                                                 dealer{} (as-configured), per-field

Pipeline: resolve make (curated spine, greedy longest-match) → parse model/year → cluster by
(make, model, year) → per-field aggregate. Weights are kept in TWO buckets:
  - redbook  → manufacturer DB figure (authoritative; CONFIRMED from one capture)
  - dealer   → as-configured, graded by cross-listing corroboration (>=2 agree -> HIGH)
Rich fields (length / water / gas / axle / sleeps) → median (numeric) or mode (categorical).

Output: ops/n8n/.caravan-catalogue-candidates.jsonl + ops/caravan-catalogue-candidates.md.
NO DB writes — landing is the separate gated job (Rule 11).
"""
import json, re, html, statistics as st
from collections import defaultdict, Counter

# ---- make dictionary: spine 159 + curated heritage/variant supplement ----
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

# AU caravan floorplan/layout suffix codes (rear-door, mid-door, pop-top, …) that CCS dealers
# append to listing titles — strip them so 'Generation 6 N2 Rd' collapses to the 'Generation' nameplate.
LAYOUT = {'rd', 'md', 'fd', 'pt', 'dl', 'px', 'ob', 'sl', 'cb', 'ct', 'rb', 'fb', 'mb', 'st', 'ns', 'rt', 'ft', 'bt', 'xt', 'lt'}


def _is_code(tok):
    t = tok.lower()
    return bool(re.fullmatch(r'\d{1,4}', t) or re.fullmatch(r'[a-z]\d{1,2}', t)
                or re.fullmatch(r'\d{1,4}[a-z]{1,2}', t) or t in LAYOUT)


def clean_model(model):
    """Strip trailing floorplan/layout codes, keeping at least the nameplate word(s)."""
    toks = model.split()
    while len(toks) > 1 and _is_code(toks[-1]):
        toks.pop()
    return ' '.join(toks)


def is_junk_model(model):
    """A model that came out unparseable (single letter / pure number / ≤2 chars) — don't land it."""
    return (not model or len(model) <= 2 or re.fullmatch(r'[A-Za-z]', model)
            or re.fullmatch(r'\d+', model) is not None)


def resolve(slug):
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
    model = clean_model(model)  # strip trailing floorplan/layout codes
    mk = make.replace('-', ' ').title() if make else None
    if mk:
        mk = re.sub(r'\bRv\b', 'RV', mk)
        mk = re.sub(r'\bJb\b', 'JB', mk)
    return mk, model, year


def load(path):
    try:
        return [json.loads(l) for l in open(path) if l.strip()]
    except FileNotFoundError:
        return []


rows = (load('ops/n8n/.caravan-listings-candidates.jsonl')
        + load('ops/n8n/.caravan-sweep-candidates.jsonl')
        + load('ops/n8n/.caravan-ccs-candidates.jsonl'))

clusters = defaultdict(list)
unresolved = []
for r in rows:
    slug = r.get('slug')
    if not slug:
        continue
    mk, model, year = resolve(slug)
    if not mk or not year or is_junk_model(model):
        unresolved.append(slug)
        continue
    clusters[(mk, model, year)].append(r)

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
    """Corroboration grade for the DEALER-sourced weights of a cluster (on ATM agreement)."""
    if not atms:
        return None
    if len(atms) >= 2 and max(atms) - min(atms) <= 25:
        return 'HIGH'
    if len(atms) >= 2 and max(atms) - min(atms) > 250:
        return 'DISPUTED'
    return 'MEDIUM' if len(atms) == 1 else 'LOW'


cands = []
for (mk, model, year), ls in clusters.items():
    # split each listing's weights into redbook vs dealer buckets
    rb = {f: [] for f in WFIELDS}
    de = {f: [] for f in WFIELDS}
    for x in ls:
        rbx = x.get('redbook') or {}
        dex = x.get('dealer')
        if dex is None and 'redbook' not in x:
            # caravanking / dealer sweep: flat weights are dealer-typed
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
        continue  # nothing useful
    urls = [x['url'] for x in ls if x.get('url')]  # CCS has none (anonymised)
    cands.append({
        'make': mk, 'model': model or '(unknown)', 'year': year,
        'bodyType': bodytype([x['slug'] for x in ls]),
        'redbook': redbook,                         # manufacturer DB -> CONFIRMED
        'dealer': dealer,                           # as-configured -> corroboration-graded
        'dealerAtmRange': [min(de['atmKg']), max(de['atmKg'])] if de['atmKg'] else None,
        'redbookCount': max(len(rb[f]) for f in WFIELDS),
        'dealerCount': max(len(de[f]) for f in WFIELDS),
        'dealerConfidence': dealer_grade(de['atmKg']),
        # rich physical fields (not compliance-gated)
        'bodyLengthMm': med([x.get('bodyLengthMm') for x in ls]),
        'overallLengthMm': med([x.get('overallLengthMm') for x in ls]),
        'freshWaterL': med([x.get('freshWaterL') for x in ls]),
        'greyWaterL': med([x.get('greyWaterL') for x in ls]),
        'gasBottleConfig': mode([x.get('gasBottleConfig') for x in ls]),
        'axleConfiguration': mode([x.get('axleConfiguration') for x in ls]),
        'sleeps': mode([x.get('sleeps') for x in ls]),
        'listings': len(ls),
        'sources': urls,
    })

cands.sort(key=lambda c: (c['make'], c['model'], c['year']))
with open('ops/n8n/.caravan-catalogue-candidates.jsonl', 'w') as f:
    for c in cands:
        f.write(json.dumps(c) + '\n')

rb_any = sum(1 for c in cands if any(c['redbook'].values()))
multi = [c for c in cands if c['listings'] >= 2]
with open('ops/caravan-catalogue-candidates.md', 'w') as f:
    f.write(f"# Caravan catalogue candidates (caravanking + dealers + CCS = {len(rows)} listings)\n\n")
    f.write(f"{len(cands)} make/model/year rows · {len(multi)} corroborated (>=2) · "
            f"{rb_any} with a RedBook (manufacturer) figure · unresolved: {len(unresolved)}\n\n")
    f.write("| make | model | year | RB-ATM | RB-Tare | RB-Ball | dlr-ATM | dlr-conf | OAL | Water | Gas | Axle | n |\n")
    f.write("|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    for c in cands:
        rbk, dl = c['redbook'], c['dealer']
        f.write(f"| {c['make'][:16]} | {c['model'][:20]} | {c['year']} | {rbk['atmKg'] or '-'} | "
                f"{rbk['tareKg'] or '-'} | {rbk['ballKg'] or '-'} | {dl['atmKg'] or '-'} | "
                f"{c['dealerConfidence'] or '-'} | {c.get('overallLengthMm') or '-'} | "
                f"{c.get('freshWaterL') or '-'} | {(c.get('gasBottleConfig') or '-')[:7]} | "
                f"{(c.get('axleConfiguration') or '-')[:6]} | {c['listings']} |\n")

print(f"listings: {len(rows)} (caravanking+dealers+CCS) → {len(cands)} make/model/year candidates")
print(f"  corroborated (>=2): {len(multi)} · with RedBook figure: {rb_any} · unresolved: {len(unresolved)}")
print("\nsample:")
for c in cands[:14]:
    rbk = c['redbook']
    print(f"  {c['make'][:14]:14} {c['model'][:20]:20} {c['year']}  "
          f"RB-ATM {rbk['atmKg'] or '-'} dlr-ATM {c['dealer']['atmKg'] or '-'}  "
          f"OAL {c.get('overallLengthMm') or '-'} water {c.get('freshWaterL') or '-'}  n={c['listings']}")
print("\nreview → ops/caravan-catalogue-candidates.md")
