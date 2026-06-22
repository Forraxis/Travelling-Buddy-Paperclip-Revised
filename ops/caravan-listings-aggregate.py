#!/usr/bin/env python3
"""
Ingest/aggregate the caravanking listings (506 used-van records w/ ATM/GTM/Tare/Ball)
into clean, confidence-graded per-(make, model, year) candidates for the caravan catalogue.

Pipeline: resolve make (curated spine dictionary, greedy longest-match — handles multi-word
makes like 'Kimberley Kampers') → parse model/year/floorplan → cluster listings by
(make, model, year) → median ATM/GTM/Tare + spread + count → confidence grade.

Confidence (the corroboration ladder, adapted): >=2 agreeing listings -> HIGH; single but
internally consistent (ATM-GTM ~= ball) -> MEDIUM; single/odd -> LOW; cluster disagrees
beyond tolerance -> DISPUTED (flag, don't auto-pick).

Output: ops/n8n/.caravan-catalogue-candidates.jsonl + ops/caravan-catalogue-candidates.md
(review table). NO DB writes — landing is a separate gated job (Rule 11).
"""
import json, re, html, statistics as st
from collections import defaultdict

# ---- make dictionary: spine 159 + curated heritage/variant supplement ----
makes=set()
for l in open('ops/n8n/.caravan-makes-merged.jsonl'):
    makes.add(html.unescape(json.loads(l)['name']).lower())
HERITAGE={'statesman','roadstar','compass','trailcraft','millard','evernew','paramount',
 'golden eagle','dreamhaven','paradise','swift','roma','traveller','western','jurgens',
 'galaxy','sterling','jayco','coromal','retreat','supreme','crusader','nova','windsor',
 'regent','avan','franklin','goldstream','kimberley kamper','kimberley kampers','red centre',
 'new age','snowy river','design rv','royal flair','on the move','aussie wide','jb',
 'spaceland','concept','newlands','olympic','viscount','majestic','elite','victory'}
makes|=HERITAGE
makes|={'masterpiece','opal','universal','montana','billabong','atlantic','stoney creek',
 'ezytrail','spaceland','galaxy','legend','kedron','kokoda','mdc','adria','silverline'}
# kebab slugs INCLUDING the make-minus-suffix form (so 'Lotus Caravans' also matches 'lotus-trooper')
base=set()
for m in makes:
    base.add(re.sub(r'[^a-z0-9]+','-',m).strip('-'))
    m2=re.sub(r'\b(caravans?|campers?|rv|motorhomes?|australia|annexes?|custom)\b',' ',m).strip()
    if len(m2)>2: base.add(re.sub(r'[^a-z0-9]+','-',m2).strip('-'))
make_slugs=sorted(base, key=len, reverse=True)  # longest first => greedy multi-word match

NOISE=re.compile(r'\b(caravan|caravans|pop-?top|off-?road|offroad|semi-?off-?road|full|'
 r'hybrid|camper|trailer|motorhome|series|edition|with|and|the|van|wagon|shower|toilet|'
 r'slide-?out|bunks?|family|luxury|deluxe|tourer|used|new|2|sized|full-sized)\b')

def resolve(slug):
    yr=re.match(r'(\d{4})',slug)
    year=int(yr.group(1)) if yr else None
    s=re.sub(r'^\d{4}-','',slug)
    make=next((m for m in make_slugs if s==m or s.startswith(m+'-')), None)
    rest=s[len(make)+1:] if make else s
    fp=re.search(r'(\d{1,2}[-.]\d{1,2}(?:[-.]\d)?)', rest)
    model=NOISE.sub(' ', rest)
    if fp: model=model.replace(fp.group(1),' ')
    model=re.sub(r'[-\s]+',' ',model).strip().title()
    mk=make.replace('-',' ').title() if make else None
    # acronym fix
    if mk: mk=re.sub(r'\bRv\b','RV',mk); mk=re.sub(r'\bJb\b','JB',mk)
    return mk, model, year, (fp.group(1) if fp else None)

rows=[json.loads(l) for l in open('ops/n8n/.caravan-listings-candidates.jsonl') if l.strip()]
clusters=defaultdict(list); unresolved=[]
for r in rows:
    if not r.get('slug') or not r.get('atmKg'): continue
    mk,model,year,fp=resolve(r['slug'])
    if not mk or not year:
        unresolved.append(r['slug']); continue
    clusters[(mk,model,year)].append(r)

def grade(atms,one):
    spread=max(atms)-min(atms)
    if len(atms)>=2 and spread<=150: return 'HIGH'        # >=2 agree -> corroborated
    if len(atms)>=2 and spread>250: return 'DISPUTED'      # listings disagree -> flag
    atm,gtm,tare=one.get('atmKg'),one.get('gtmKg'),one.get('tareKg')
    sane = atm and tare and atm>tare and (not gtm or tare-20<=gtm<=atm+20)
    return 'MEDIUM' if sane else 'LOW'                     # single sane listing -> MEDIUM

def bodytype(slugs):
    t=' '.join(slugs)
    if re.search(r'fifth|5th-wheel', t): return 'FIFTH_WHEELER'
    if re.search(r'pop-?top', t): return 'CARAVAN_POP_TOP'
    if 'camper' in t: return 'CAMPER_TRAILER'
    if 'hybrid' in t: return 'HYBRID'
    if re.search(r'off-?road|outback', t): return 'OFF_ROAD_CARAVAN'
    if 'motorhome' in t: return 'OTHER'
    return 'CARAVAN_FULL_HEIGHT'

cands=[]
for (mk,model,year),ls in clusters.items():
    atms=[x['atmKg'] for x in ls]
    cands.append({'make':mk,'model':model or '(unknown)','year':year,
        'bodyType':bodytype([x['slug'] for x in ls]),
        'atmKg':int(st.median(atms)),'atmRange':[min(atms),max(atms)],
        'gtmKg':int(st.median([x['gtmKg'] for x in ls if x.get('gtmKg')] or [0])) or None,
        'tareKg':int(st.median([x['tareKg'] for x in ls if x.get('tareKg')] or [0])) or None,
        'listings':len(ls),'confidence':grade(atms,ls[0]),
        'sources':[x['url'] for x in ls]})

cands.sort(key=lambda c:(c['make'],c['model'],c['year']))
with open('ops/n8n/.caravan-catalogue-candidates.jsonl','w') as f:
    for c in cands: f.write(json.dumps(c)+'\n')

from collections import Counter
conf=Counter(c['confidence'] for c in cands)
multi=[c for c in cands if c['listings']>=2]
with open('ops/caravan-catalogue-candidates.md','w') as f:
    f.write(f"# Caravan catalogue candidates (from {len(rows)} caravanking listings)\n\n")
    f.write(f"{len(cands)} candidate make/model/year rows · {len(multi)} corroborated (>=2 listings)\n")
    f.write(f"confidence: {dict(conf)} · unresolved make/year: {len(unresolved)}\n\n")
    f.write("| make | model | year | ATM | GTM | Tare | n | conf | ATM range |\n")
    f.write("|------|-------|------|-----|-----|------|---|------|-----------|\n")
    for c in cands:
        rng=(f"{c['atmRange'][0]}-{c['atmRange'][1]}" if c['atmRange'][0]!=c['atmRange'][1] else '-')
        f.write(f"| {c['make'][:20]} | {c['model'][:24]} | {c['year']} | {c['atmKg']} | {c['gtmKg'] or '-'} | {c['tareKg'] or '-'} | {c['listings']} | {c['confidence']} | {rng} |\n")

print(f"listings: {len(rows)} · resolved into {len(cands)} make/model/year candidates")
print(f"corroborated (>=2 listings): {len(multi)} · confidence {dict(conf)}")
print(f"unresolved (no make/year): {len(unresolved)}")
print("\nsample candidates:")
for c in cands[:14]:
    print(f"  {c['make'][:16]:16} {c['model'][:22]:22} {c['year']}  ATM {c['atmKg']}  n={c['listings']}  {c['confidence']}")
print("\nreview → ops/caravan-catalogue-candidates.md")
