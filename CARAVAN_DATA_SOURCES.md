# Caravan Data Sources — sourcing the ATM/GTM/Tare/Ball catalogue

> Companion to `VEHICLE_DATA_SOURCES.md` (which covers the tow-vehicle side). This doc
> covers how we populate the **caravan** catalogue: identity (make/model/variant) and the
> compliance quad **ATM / GTM / Tare / Tow-ball** plus dimensions, water, gas, axle, sleeps.
>
> Status: **LANDED, 2026-06-24.** Caravan *physics* already exists — caravans are a pure
> **data** play. All sources scraped + aggregated + landed: **1,194 caravan variants, 1,039
> with ATM** (152 makes), 371 with authoritative RedBook weights, ~3,900 columns promoted,
> 4,914 provenance rows — all flagged **pending Tim's Rule-11 sign-off**. See §11 for the
> known limitations / holes that still bite.

## 1. The problem

There is **no bulk, licensable, free source** of AU caravan ATM/GTM. Manufacturers publish
Tare + Ball in brochures but rarely ATM/GTM in scrapeable bulk. The only place the full
compliance quad appears at scale is **used-vehicle listings** (dealer-transcribed plate
figures) and the **RedBook** spec database that the big marketplace surfaces.

So the strategy is: build a **make spine**, then harvest the compliance quad from listings,
**confidence-graded by corroboration and by source**, landed into a provenance layer that
mirrors the vehicle side.

## 2. Compliance posture (READ FIRST)

We respect `robots.txt`. Posture per source actually used:

| Source | `robots.txt` (`User-agent: *`) | Verdict |
|---|---|---|
| `caravanking.com.au` | `Allow: /` | ✅ compliant |
| `camperagent.com.au` | disallows `/admin`, `/api/`, `/draft` only | ✅ `/vehicle-details/` allowed |
| `stock.davebensoncaravans.com.au` | blocks file-types + `?`-search URLs only | ✅ detail pages allowed (avoid `?` search) |
| **`caravancampingsales.com.au` (CCS)** | **`Disallow: /`** (only `/$`, `/editorial/`, `/research/`; `Crawl-delay: 2`; `Disallow: /_api/*`) | ❌ **disallowed for all of `/items/`** |

**✅ RESOLVED (2026-06-24):** CCS is the richest source (489 makes + the authoritative RedBook
spec block) but its robots.txt disallows everything we'd scrape. **Tim's call: proceed
facts-only / anonymised / gentle** ("holding the data to get the stats, not competing against
them") — honour `Crawl-delay: 2`, persist no URL/listing-id, take only the universal compliance
facts. CCS was scanned (1,505 listings, 713 RedBook) and **landed**. Full-HTML raw held
(gitignored) so we never re-hit them on a re-parse.

Egress rules (unchanged): **all** caravanking/dealer scraping goes via the **n8n VPN webhook**
(`/webhook/caravan-fetch`, egress = ProtonVPN AU, never the home IP). BrightData routes via its
own residential IPs (separate path). Anonymisation: for CCS we persist **no URL / listing-id** —
only the universal compliance facts (indistinguishable from plate data).

## 3. The make spine (159 makes)

`ops/n8n/.caravan-makes-merged.jsonl` — 159 makes merged from RVMAP + letsgocaravanandcamping,
with `{name, slug, website, address, tier, buildType}`. This is the robots-compliant identity
backbone. Doc: `ops/caravan-makes-spine.md`.

## 4. Compliant listing scrapers (the working catalogue)

These three feed one pipeline: **scrape → aggregate → provenance → land.**

| Scraper | File | Egress | Yield |
|---|---|---|---|
| caravanking (static HTML) | `ops/caravan-listings-fullscan.py` | n8n VPN webhook | ~506 listings |
| dealer JS sites (Browserless render) | `ops/caravan-browserless-sweep.py` | n8n VPN (Browserless in gluetun netns, :3100) | davebenson + camperagent |
| aggregate → catalogue | `ops/caravan-listings-aggregate.py` | — | clusters by (make,model,year), median quad |
| land → DB | `src/jobs/caravan-listings-land-local.ts` | — | makes/models/variants + provenance |

**Landed so far:** ~73 makes / ~439 variants / ~350 with ATM+GTM (median of corroborating
listings), via `CaravanVariantSpecProvenance`.

### Rich extractor — `ops/caravan_extract.py`

Shared by every scraper. `extract(html) -> dict` returns the weight quad **+** `bodyLengthMm`,
`overallLengthMm`, `freshWaterL`, `greyWaterL`, `gasBottleConfig`, `axleConfiguration`,
`sleeps`, and a `features[]` catch-all (capture-everything, per Tim — "every feature helps the
physics"). Unit-tolerant: ATM "3500 KG" or "ATM 3500"; length 16′/7.0m/7000mm; water "2×95L"→190.

## 5. The two-source weight model (key discovery)

A marketplace listing carries **two independent weight figures**, and they legitimately differ:

| | Page label | What it is | Confidence |
|---|---|---|---|
| **RedBook** | `Aggregate Trailer Mass` / `Gross Trailer Mass` / `Tare Mass` / `Towball Download Mass` | **Manufacturer DATABASE** spec, keyed to make/model/year (the listing disclaimer cites "(Redbook) … manufacturer standard … specifications") | **Authoritative from a single capture** ≈ the plate/compliance figure |
| **Dealer free-text** | `* ATM:` / `* TARE:` bullets the dealer typed | **This van as-configured** (base + fitted options) | Graded by independent-listing corroboration |

Observed gaps confirm the model (dealer ATM 2751 vs RedBook 2500; 3090 vs base; 2682 vs 2595) —
**the gap = fitted-options weight**, real signal not noise.

`caravan_extract.py` now emits **per-field provenance**: `redbook{}`, `dealer{}`, a
`weightSource` hint, and a primary value that **prefers RedBook** then falls back to dealer.
RedBook coverage is **per-field sporadic** (`Aggregate Trailer Mass` populated on ~⅓ of pages,
`Tare`/`Ball` on ~⅔) — which is the main argument for breadth: more listings = more chances to
assemble the complete authoritative quad per variant.

### Confidence grading (land step)
- **RedBook field** → `CONFIRMED` (manufacturer DB; authoritative from one capture).
- **Dealer field** → graded by the agreed ladder: ≥2 independent listings agreeing → HIGH;
  single sane → MEDIUM; disagree → DISPUTED. Tolerances: GVM/GCM/ATM ±25 kg, axles ±20, ball ±10.
- HIGH+MEDIUM promote to the variant column (feed the calculator); LOW/DISPUTED stay
  provenance-only (drive "help us verify"). Same safety policy as vehicles. **Rule-11 sign-off
  (Tim) still pending** before any of this feeds a compliance verdict.

## 6. CCS make→model taxonomy harvest (DONE 2026-06-24)

`ops/caravan-ccs-taxonomy.py` (via BrightData Web Unlocker, which defeats CCS's DataDome).
CCS's all-caravans results page exposes a **canonical Make facet of ~489 makes** (vs our 159
spine — ~3× wider); each make page exposes its **Model facet** (Jayco→77 models, Adria→16).
These are universal manufacturer facts (a "Jayco Silverline" is like an ATM figure) → fully
anonymisable. Two stages: `makes` (1 request → `.caravan-ccs-makes.jsonl`) and `models [N]`
(per-make model facet + page-1 detail URLs → `.caravan-ccs-taxonomy.jsonl` +
`.caravan-ccs-detail-urls.txt`). Every make page's text is **raw-held** in
`.caravan-ccs-taxo-raw.jsonl` for re-parse without re-fetch.

`ops/caravan-ccs-scan.py` (facts-only detail scanner) consumes `.caravan-ccs-detail-urls.txt`,
extracts both weight sources, and persists **no URL/id** into the catalogue.

**Raw capture — hold EVERYTHING (Tim: "make sure we are capturing all the raw data"):** every
fetched page's **complete HTML** is gzipped (≈10% of size, byte-identical round-trip verified)
into a content-addressed store (`.caravan-ccs-raw-html/` for details, `.caravan-ccs-taxo-raw-html/`
for make pages), with an anonymised manifest (`.caravan-ccs-raw.jsonl` = slug/year/hash/bytes,
**no URL/id**). This means **any** future field — spec-table structure, `data-*` attrs, JSON-LD,
microdata, image URLs — can be re-parsed without ever re-fetching / re-hitting CCS. Shared helper
`hold_raw()` in `caravan_extract.py`. The gz blobs are **private, gitignored**, used only to
derive stats; the published catalogue stays anonymised. (Note: the first ~50 make-*discovery*
pages were held as stripped text before the upgrade — low stakes, no specs there; all detail
pages and remaining make pages are full HTML.)

**State (DONE):** taxonomy harvested all 489 makes; detail scan captured **1,505 listings (1,138
with ATM, 713 RedBook)**; aggregate + land run → catalogue (see §0 status). Full-HTML raw held
for every page.

## 7. Why static HTML caps out, and the JS-render cost scope

CCS is a **Next.js SPA** (`isSpaMode: true`). Listings load client-side from **`/_api/search-core`**,
which is **robots-disallowed** (`Disallow: /_api/*`) **and** BrightData refuses it
("not available … in accordance with robots.txt"). So:

- **Static category-page HTML embeds only ~9–12 listings**; pagination params (`?page=`,
  `?offset=`, `Range=`) all return the same page-1 set + sponsored repeats.
- There is **no listings sitemap** (sitemap.xml returns an HTML shell).
- **Deep-tail size:** the headline count is JS-rendered (not readable from static HTML);
  estimated **~6,000–12,000 live caravan listings** from make-facet density.

### Cost options (BrightData: Web Unlocker ~$1–3 / 1k successful; Scraping Browser ~$5/GB)

| Option | Method | Listings | Est. cost | Notes |
|---|---|---|---|---|
| **A — page-1 only** (current method) | Web Unlocker, static HTML | ~4–6k | **$7–13** | Practical ceiling without JS; covers popular current variants |
| **B — full deep tail** | Scraping Browser to paginate make results (discovery) + Web Unlocker for detail pages | ~8–10k | **$25–45** | Discovery ~$10–15 (≈2.5 GB, images blocked) + detail ~$12–30 |
| **C — JSON API** | hit `/_api/search-core` directly | all | ~$10–20 | ❌ **robots-disallowed + BrightData refuses — off the table** |

**Marginal value of B over A is LOW.** RedBook is per-variant — once captured, more listings of
the same van add nothing to the base spec. The deep tail's extra ~4–6k listings are mostly
*duplicate variants*; net-new unique variants ≈ 20–30%. So ~$25–45 buys ~20–30% more variant
coverage — and **all of it is robots-disallowed** (the gating issue is posture, not budget).

### Robots-compliant alternatives to reach authoritative specs
1. **License RedBook directly** — RedBook is the DB source CCS surfaces; a data licence is the
   clean path to authoritative ATM/GTM at scale.
2. **Manufacturer sites + the compliant scrapers** (caravanking/dealers) — already yielding
   73 makes / 350 quads; expand the dealer set (verify each dealer's robots first).
3. **User-contributed plate photos** — the moat already built on the vehicle side.

## 8. Provenance schema

`CaravanVariantSpecProvenance` (mirror of `VariantSpecProvenance`): per-field `source` / `status`
/ `confidence` / `corroboratingCount` / `sourceUrl` / `value` / `asOf`, related from
`CaravanVariant.specProvenance`. Applied via `prisma db push` (additive — **never** `migrate dev`
on the shared remote DB; reset risk).

> ⚠️ **HOLE (§11):** this model is in `schema.prisma` + the live DB but has **no migration file**
> (added by `db push`). The next `prisma migrate dev` will see drift. Before any future migrate, a
> migration must be authored for it (`prisma migrate diff` / `--create-only`). `source='MANUAL'`
> is also used for *scraped* RedBook/dealer data — a slight mislabel (there's no REDBOOK/SCRAPED
> source enum value); the `notes` field disambiguates.

## 9. File inventory

```
ops/caravan_extract.py                  shared rich extractor (weights+dims+water+gas+axle+RedBook/dealer split + hold_raw)
ops/caravan-listings-fullscan.py        caravanking static scan (VPN, holds raw)     [compliant]
ops/caravan-browserless-sweep.py        dealer JS sites via Browserless (VPN, raw)   [compliant]
ops/caravan-ccs-taxonomy.py             CCS make→model facet harvest (BrightData)    [done]
ops/caravan-ccs-scan.py                 CCS facts-only detail scanner (BrightData)   [done]
ops/caravan-listings-aggregate.py       v2: 3-source aggregate, RedBook/dealer split, model-name cleanup
src/jobs/caravan-listings-land-local.ts v2: land rich fields + two-source weights + provenance
ops/n8n/.caravan-makes-merged.jsonl     159-make spine
ops/n8n/.caravan-ccs-makes.jsonl        489 CCS makes (harvested)
ops/n8n/.caravan-ccs-taxonomy.jsonl     make→model taxonomy (489 makes)
ops/n8n/.caravan-*-raw-html/            FULL gzipped page HTML, content-addressed (gitignored)
ops/n8n/.caravan-*-raw.jsonl            raw-store manifests (slug/year/hash/bytes, no URL)
ops/n8n/.caravan-ccs-detail-urls.txt    discovery URL list (transient, gitignored)
```

## 10. Open decisions (Tim)

1. ✅ **CCS & robots.txt** — RESOLVED: proceed facts-only/anonymised/gentle (see §2). Done + landed.
2. **Deep tail** — Option A (page-1, done) vs B (~$25–45, deep tail). B's marginal value is low
   given RedBook's per-variant authority; **not pursued** (Option A was the run). Still open if
   wider coverage ever wanted.
3. **Rule-11 sign-off (PENDING)** — all 1,194 caravan variants' weights are landed as
   ESTIMATE/CONFIRMED **awaiting Tim's tick**. They are *live in the calculator now but flagged*.
   The physics sign-off docs (`CALIBRATION_SIGNOFF.md` / `PHYSICS_NOTES.md`) do **not** yet
   reference this dataset — a reviewer won't know it's waiting. **Add a pointer there.**

## 11. Known limitations / holes (things that can bite)

1. **Length is the granularity axis (not floorplan).** Agreed target granularity is
   **model + year + length**, with floorplan/berths as finer sub-facets beneath it — length is
   what actually swings AU caravan weight, and the data's "floorplan" labels are mostly
   berth/layout codes (`exp-2021-4` vs `(6)`, `16-49`, `5-4fb`). The floorplan/berths re-cluster
   + supersede is **DONE** (Bruder Exp 2021 now splits `exp-2021-4` ATM 1600 / `exp-2021-6` 3100;
   the misleading median row is gone — see `HANDOVER.md`). **Open blocker:** length is **not yet a
   variant-identity dimension** and `bodyLengthMm` is populated on only **433/1263 (34%)** of
   variants, so different-length vans of one model/year can still collapse to a median. Making
   length a real clustering key needs a `bodyLengthMm` backfill first (derive from
   `overallLengthMm` where possible / re-parse held CCS raw) — **Rule 11** (feeds axle/TBM). The
   `DISPUTED` gate (ATM spread >250 kg → not promoted to a column) still catches the worst merges
   in the meantime.
2. **~155 caravans are identity-only** (no extractable weight) — appear in the catalogue but
   can't compute. ~30 % of CCS dealer titles were unparseable (skipped; raw held → re-parseable).
3. **No migration for `CaravanVariantSpecProvenance`** (see §8) — `db push` only; migrate drift.
4. **`source='MANUAL'` mislabels scraped data** (see §8).
5. **UI not verified.** Catalogue rows are confirmed at the DB layer (status=CATALOGUE, columns
   populated); **nobody has browser-walked the live calculator** to confirm it surfaces them and
   that flagged/ESTIMATE rows aren't filtered out by a front-end gate. Admin review surface exists
   (`src/app/admin/moderation`, `admin/catalogue/vehicles/spec-fetch`) but it's **unverified** that
   these scraped ESTIMATE rows actually appear there for sign-off.
6. **Work is uncommitted** (24 files at last count) — commit when ready.
