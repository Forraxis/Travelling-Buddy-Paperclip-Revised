# Catalogue Granularity — Design Plan

> **Status:** PLAN, ready to execute (written 2026-06-25). Pick this up in a fresh session.
> **Owner decision pending:** "how far to go" (§7) and migration go-ahead (§5).
> Companion docs: `VEHICLE_DATA_SOURCES.md`, `CARAVAN_DATA_SOURCES.md` (§11 holes), `PHYSICS_NOTES.md`.

## 1. The problem (grounded)

A catalogue **variant** is currently identified by **model + year-range + a free-text name** that
only encodes body label. It carries **no structured field for the axes that actually change the
compliance numbers**: generation, cab type, drivetrain, badge/series, engine (vehicles); floorplan
(caravans).

**Worked example — Nissan Navara, 2008 dual cab (Tim's car):** searching it returns three
overlapping, confusingly-named variants and no way to pin the real config —

```
Dual Cab 2007–2008    GVM 2805  kerb 1985  tow 3500
Cab Chassis 2008–2009  GVM 2730  kerb 1509  tow 3500
Ute 2008–2014         GVM 2860  kerb 1630  tow 3500
```

Missing: generation (**D22 vs D40 both sold in 2008**), cab (single/king/dual), **drivetrain
(4x2 vs 4x4)**, badge (ST / ST-X / the **Spanish-built** D40 he has), engine. Navara has 53
variants but they're sliced on the **wrong axes** (body-label × year), inherited from the
QLD-rego aggregate granularity.

Caravans have the identical disease (`CARAVAN_DATA_SOURCES.md §11`): one "Atlantic Generation
2017" merges 6-berth and 2-berth floorplans with very different ATMs into a single median.

## 2. Root cause

The variant row **conflates "a model-year" with "a compliance-distinct configuration."** The
real-world identity a user holds is `Make → Model → Generation → Body → Drive → Badge → Year`,
and the compliance figures (kerb / GVM / GCM / tow) live at that **leaf**, varying across every
one of those axes.

## 3. Why it matters — correctness, not just UX

This is not polish. A D40 dual-cab **4x2 ST** and a **4x4 ST-X** have materially different
GVM/kerb/tow. If a user picks "Dual Cab 2007–2008, GVM 2805" but theirs is the heavier 4x4, the
**verdict is computed on the wrong GVM.** For a compliance tool that is the one thing we can't
get wrong. Coarse granularity = silently-wrong answers + low user trust.

## 4. Proposed model — structured facets

Add facet fields to the variant (flat columns — see §5 for the table-vs-column call):

**VehicleVariant** (new fields):
| Facet | Type | Example | Number-impact |
|---|---|---|---|
| `generation` | String? | `D40`, `D23/NP300` | groups year spans; high |
| `cabType` | enum `CabType?` | `SINGLE_CAB` `KING_CAB` `DUAL_CAB` `WAGON` | high |
| `driveType` | enum `DriveType?` | `4X2` `4X4` `AWD` | **highest** (kerb/GVM swing) |
| `badge` | String? | `ST`, `ST-X`, `Sahara` | medium |
| `engine` | String? | `2.5 dCi`, `V6 4.0` | medium (kerb) |
| `transmission` | String? | `6AT`, `6MT` | low |

**CaravanVariant** (new fields):
| Facet | Type | Example | Number-impact |
|---|---|---|---|
| `floorplan` | String? | `19-65-2`, `Rear Door`, `6 berth` | **highest** (ATM/Tare swing) |
| `berths` | Int? | `4` | medium |

The **variant slug** becomes the config fingerprint (`navara-d40-dual-cab-4x4-st-x`), so each
compliance-distinct config is its own addressable leaf.

## 5. Data-source reality per facet (the honest part)

The facets are only worth adding if we can fill them. Populability, per facet:

| Facet | Primary source | Coverage reality |
|---|---|---|
| `generation` | **rule** (year+model map) + ROVER `baseModel` | HIGH — derivable for most mainstream models |
| `cabType` | QLD body field (`Dual Cab`/`Cab Chassis`/`Utility`) + ROVER | HIGH for utes; already half-encoded in names |
| `driveType` | **ROVER** approval docs (list 4x2/4x4) + AI-ground + plate | MED — QLD does NOT carry it reliably; ROVER does |
| `badge` | ROVER / manufacturer brochure / AI-ground / user | LOW–MED — patchy for older vehicles |
| `engine` | ROVER / brochure | LOW–MED |
| `floorplan` (caravan) | **re-parse the held raw** (slug + full HTML we kept) | HIGH — we already hold every CCS page |

**Key facts:** (a) **ROVER is the granularity backbone** for vehicles — federal per-variant
approvals carry drive/cab/engine; the ROVER expansion is already in flight
(`VEHICLE_DATA_SOURCES.md` open items). (b) **Caravan floorplan needs no new fetch** — all 1,505
CCS slugs carry it and full raw HTML is held, so we re-cluster from data in hand.

## 6. The two-tier philosophy (don't over-build)

Catalogue granularity will never be perfect for the long tail (old trims, the "Spain edition").
So:

1. **Catalogue = best estimate by the facets we can fill.** Guided narrow-down to the most
   specific leaf we have.
2. **Plate photo = truth.** The VLM verdict-upgrade path (already built) is the precision
   mechanism — the user confirms exact GVM/GCM from their compliance plate → VERIFIED. The UI
   must **frame the catalogue figure as an estimate and invite plate confirmation**, so a coarse
   match never masquerades as exact.

**Scope guardrail:** do NOT chase every micro-variant in the catalogue. Fill the facets that
move the numbers and are derivable (drive, cab, generation, floorplan); let the plate path handle
the rare tail. Adding facet *columns* we can only 20%-fill is fine **only if** the UI degrades
gracefully (unknown facet = "not specified", still selectable).

## 7. "How far to go" — the decision for Tim

| Tier | Facets | Effort | Recommendation |
|---|---|---|---|
| **Must** | `driveType`, `cabType`, `generation` (veh) · `floorplan` (caravan) | medium | **Do this** — biggest number-impact, mostly populable |
| **Should** | `badge`, `engine`, `berths` | medium-high | Do where ROVER/raw gives it; leave null otherwise |
| **Skip (plate-only)** | trim micro-variants, build-origin (Spain vs Thailand), options packs | — | Out of catalogue scope; plate handles it |

Recommendation: **build the "Must" tier + UI narrow-down + plate-confirm framing.** That fixes the
correctness risk and the clunk without an endless data hunt.

## 8. Schema + migration

- Add the facet columns + two new enums (`CabType`, `DriveType`); make variant `slug` carry facets.
- **⚠️ Use a real migration, not `db push`.** There is already a `db push` drift hole
  (`CaravanVariantSpecProvenance` has no migration — `CARAVAN_DATA_SOURCES.md §8`). **Fix that as
  part of this work**: author the missing provenance migration first, then the facet migrations,
  so `prisma migrate dev` is consistent again. Never reset the shared remote DB.
- Optional heavier alternative: a `VehicleGeneration` table (Model→Generation→Variant) — more
  normalised (D40 is a real grouping with shared dims/year-span) but a bigger change. **Recommend
  flat columns first**; revisit the table only if the picker needs a true generation level.

## 9. Backfill strategy (phased)

1. **Vehicles — derive what's free:** `generation` from a year+model rule table; `cabType` from
   existing body labels/names. (No new data.)
2. **Vehicles — ROVER pass:** map ROVER approvals → `driveType` / `engine` / `badge` onto matching
   variants (the ROVER expansion already lands GVM/axle; extend it to carry these facets).
3. **Vehicles — AI-ground the gaps:** for high-traffic tow rigs still missing `driveType`, use the
   grounded-Claude provider (gated/ESTIMATE), or leave null + plate.
4. **Caravans — re-cluster from held raw:** parse `floorplan` from each CCS slug/raw, re-run the
   aggregate keyed on `(make, model, year, floorplan)`, re-land. **No re-scrape** (we held it all).
   Re-collapses the §11 floorplan blur into real per-layout variants.

## 10. UX flow

- **Guided narrow-down:** Make → Model → Generation → Cab/Body → Drive → Badge → Year. Each step
  filters the next; **auto-collapse any step with a single option** so it never feels bureaucratic.
- **Free-text fallback:** the existing `picker/vehicles/search` should match on facet tokens
  ("navara 4x4 dual cab st-x").
- **Estimate framing:** show the matched figure with its provenance/confidence chip and a clear
  **"This is an estimate — confirm with your compliance plate"** CTA → the VLM path.
- **Graceful unknowns:** a variant missing a facet shows "—/not specified" and stays selectable.

## 11. Phasing / milestones

1. **Migration baseline** — ✅ **DONE (2026-06-25).** Authored the missing
   `CaravanVariantSpecProvenance` migration (`20260625000000_…`) and baselined it on the remote
   via `prisma migrate resolve --applied` (table already existed → drift hole closed). Added the
   facet migration (`20260625000100_add_catalogue_granularity_facets`): `CabType`/`DriveType`
   enums + facet columns on `VehicleVariant` (`generation`/`cabType`/`driveType`/`badge`/`engine`/
   `transmission`) and `CaravanVariant` (`floorplan`/`berths`), applied via `migrate deploy`
   (additive nullable — backward-compatible, no reset). `DriveType` stores `4X2`/`4X4`/`AWD` (via
   Prisma `@map`). `migrate status` clean, `prisma validate` + `type-check` clean. **Restart the
   dev server** before milestone-2 work touches the new fields (running process holds the old client).
2. **Vehicle backfill** — generation rule + cab from names + ROVER drive/engine/badge. (1–2 days)
   **PHASE-1 DONE (2026-06-25):** `src/jobs/backfill-vehicle-facets-local.ts` (dry-run default,
   `--write`, fill-empties-only, idempotent). Derived from data in hand → landed: **driveType 953**
   (AWD 333 / 4X2 321 / 4X4 299), **cabType 1,085** (Wagon 782 / Dual 269 / Single 18 / King 16),
   **generation 141** (major tow models w/ non-overlapping spans). 2,047/5,100 variants now carry
   ≥1 facet; 2,179 `VariantSpecProvenance` rows (source=MANUAL/derived, status=ESTIMATE, pending
   Rule-11). Navara correctly: `Dual Cab`→DUAL_CAB, `Ute`→null (ambiguous), gen→null (D22/D40
   overlap needs ROVER/plate).
   **STEP-2 ROVER — CORRECTED + PARTLY DONE (2026-06-26):** the ROVER crawl ALREADY RAN and is stored
   — `RoverDocument` holds 5,147 RVDs + 1,320 notices across all 1,321 VTAs (EXPANDED); 3,953 variants
   already carry ROVER provenance. So step-2 is a LOCAL mine of held data, NOT a VPN crawl. **Hard limit
   found:** the federal RVD carries per-variant `bodyStyle`/seating/GVM/tare/tow but **NOT driveType,
   badge, trim, or per-variant GCM**, and OEM makes (Toyota) name variants by code (`GUN125R-BTFLXQ3`) —
   verified "4x4"/"4x2" appear NOWHERE in the HiLux RVD. So ROVER can fill **cabType (from bodyStyle)**
   but cannot produce drive/badge/clean names. `src/jobs/rover-enrich-facets-local.ts` (dry default,
   `--write`, fill-empties) filled **cabType for 99 coded ute variants** (Dual 71 / King 9 / Single 19),
   source=ROVER status=CONFIRMED — Single/Dual/King chips now work on coded HiLux-style models (name
   stays coded+demoted). GCM-from-RVD = 0 (not in data). **driveType/badge/trim for OEM-coded variants
   is the ONLY remaining lever → AI-grounding (gated ESTIMATE), NOT ROVER.** (badge/transmission were
   also derived from human-named variants in the phase-1 name-token pass: 202/448.)
   **STEP-3 AI-GROUNDING — TESTED, THEN PIVOTED AWAY (2026-06-26).** Built+probed a grounded-Claude
   facet job (Opus/Sonnet/Haiku + server web_search). Findings: drive grounds reliably; **badge
   unreliable** (Sonnet "SR5" vs Haiku "WorkMate" same code, both HIGH); **cab grounding run-to-run
   unstable** (DUAL then SINGLE, both HIGH) AND redundant — RVD bodyStyle already gives cab
   authoritatively. Haiku ≈ Opus on the reliable facets at ~$0.10/veh (6× cheaper). Gated batches
   (Haiku, $0.30/call cap, every-5 review, resume marker) caught that 2026 D-Max codes are
   un-groundable (null) + cab-via-AI is redundant. **Tim's call: PIVOT AWAY from AI.** Removed the
   `ground-facets-*` jobs, deleted all CLAUDE facet rows. Measured: 652 coded variants lack cab but
   **0 are RVD-fillable** (rover-enrich already took the 99 authoritative ute cabs); the 711 coded
   variants stay **driveType-null + demoted** (no reliable non-AI source — accepted). Catalogue rests
   on QLD names + ROVER bodyStyle + demotion; **no AI data in the catalogue.**
3. **Caravan re-cluster** — floorplan parse from held raw → re-aggregate → re-land. (1 day)
   **ANALYSIS DONE (2026-06-25), LANDING GATED:** `ops/caravan-floorplan-recluster.py` (dry, no DB
   writes — mirrors how `caravan-listings-aggregate.py` gates landing). Re-keys the SAME 2,093 held
   listings on (make, model, year, **floorplan**): **1,221 → 1,309 clusters** (1,163 with weights);
   **72** model-years split into ≥2 floorplans, **32** with ≥200 kg ATM disagreement the median was
   hiding (e.g. **Bruder Exp 2021** 4-berth 1,600 vs 6-berth 3,100; **River Dominator 2019** 2,750
   vs 3,500 — matches §11's "32 clusters"). Land-ready candidates →
   `ops/n8n/.caravan-catalogue-fp-candidates.jsonl`; report → `ops/caravan-floorplan-recluster.md`.
   **LAND DONE — ADDITIVE (2026-06-25):** per Tim's calls — (a) land additively, DON'T delete the
   merged rows until we're happy; (b) keep length codes distinct (176/186/216 = 17'6"/18'6"/21'6",
   each its own weights). `src/jobs/caravan-floorplan-reland-local.ts` (dry default, `--write`,
   `--all`; split-groups-only by default) landed **100 per-floorplan variants** across 63 split
   model-years (650 provenance rows, 477 columns promoted). CaravanVariant 1,194→1,294. Verified:
   Bruder Exp 2021 now has merged `exp-2021` (ATM 2350 median) coexisting with `exp-2021-4`
   (ATM 1600) + `exp-2021-6` (ATM 3100) — median was ~750 kg wrong for both layouts.
   **REMAINING (after Tim reviews the split):** supersede pass — delete/redirect the merged
   model-year rows now covered per-floorplan (only those with no Setup references); optionally
   `--all` to also split single-floorplan groups; revisit the `None`-bucket + floorplan-key
   normalisation (§12) if a cleaner canonical floorplan is wanted (re-parse held raw HTML).
4. **Picker API + UI** — facet narrow-down + collapse-single + plate-confirm framing. (2–3 days)
   **NARROW-DOWN DONE (2026-06-25):** both picker variant routes now compute + return facet option
   lists and accept facet filters — vehicles: `generation`/`cabType`/`driveType`/`badge` (+ existing
   year/fuelType); caravans: `floorplan`/`berths` (+ axle). UI (`BrowseTab.tsx`) renders single-select
   chip rows in the plan's §10 order (gen→cab→drive→badge→fuel; floorplan→berths→axle) via a reusable
   `ChipRow` that **auto-hides at ≤1 option** (collapse-single), plus a config facet-line on each
   variant row. Verified live: Ford Ranger `?driveType=FOUR_WHEEL_DRIVE` narrows 42→23 (all 4x4);
   Bruder Exp shows floorplan 4 (ATM 1600) vs 6 (ATM 3100) as distinct rows. type-check + eslint clean.
   **FREE-TEXT FACET SEARCH DONE (2026-06-25):** chose Postgres token-parse + `pg_trgm` over a
   search engine (deterministic facets > relevance ranking for compliance; ~6.4k rows; no new infra).
   New shared `src/lib/catalogue/facet-tokens.ts` is the single source of truth for the token maps —
   the backfill now imports from it too, so derivation + search can't drift. Both picker `search`
   routes parse the query → exact facet filters (driveType/cabType; caravan berths) + a tokenised
   free-text remainder matched per-token across make/model/variant(+badge/generation/floorplan) via
   ILIKE **OR `word_similarity()`** (typo tolerance), ranked by similarity. Migration
   `20260625000200_add_pg_trgm_search` adds the extension + GIN trgm indexes on the 6 name columns.
   Verified live: "navara 4x4 dual cab" → all 4WD+DUAL_CAB Navaras; "toyta hilux" (typo) → Toyota
   HiLux; "jayco journey" (make+model) → Journey variants. type-check + eslint clean, no drift.
   **YEAR PARSING FIX (2026-06-25):** a 4-digit year is now parsed to an exact range filter
   (`yearFrom ≤ year ≤ yearTo`), not left in the free-text remainder — fixed the bug where "navara
   2008" trigram-matched every 200x year (2008↔2002–2006). "navara 2008" → only the 3 ranges covering
   2008; combines with cab/drive ("navara 2008 dual cab" → 1). Caravan parser parses berths + year.
   **CARAVAN LENGTH FACET (2026-06-25):** length is the spec-defining axis for caravans (a 16'6 vs
   17'6 differ in tare/ATM). Added AU body-length-in-feet (Tim's call: BODY length, not overall —
   overall adds the drawbar; `bodyFeetHalf` rounds bodyLengthMm to the nearest ½-foot, `formatFeet`
   → `16'6"`). Now (a) **searchable** — `parseCaravanQuery` reads `16'6` / `16'6"` / `17ft6` / `18.5`
   (year parsed first so 2012≠length) → exact ½-foot bucket filter; (b) a **browse chip**; (c) shown
   on every caravan row + search result. Filter/chip/display share ONE bucket expression so they
   always agree. Verified: `jayco 18'6"` → only 18'6" vans; `nova revivor` → 2011 = 18'0".
   **Coverage caveat:** only the **433** vans with `bodyLengthMm` show a length; the 733 with only
   `overallLengthMm` show none (overall ≠ marketed feet; filling them needs body data). And the long
   tail (e.g. Tim's exact 16'6 Revivor — catalogue only has the 18' body row) needs the plate/submit
   path. Length is search/filter/display only — NOT yet a variant re-cluster split.
   **PLATE-CONFIRM "ESTIMATE" CTA DONE (2026-06-25):** the precision mechanism (§6 "plate = truth")
   is now wired, not a stub. Result panel shows a **"Confirm GVM/GCM from your compliance plate"** CTA
   (`RightColumn.PlateConfirmCTA`) opening `PlateConfirmModal` → photograph/upload plate →
   `/api/ocr/compliance-plate` reads GVM/GCM → **user reviews + edits** (OCR can misread, so a human
   confirms before it touches the verdict) → Apply writes a per-rig `plateConfirmed` slice to
   calculator state. `buildPhysicsInput` (live mode) then REPLACES the catalogue GVM/GCM with the plate
   figure AND flips that limit ESTIMATE→CONFIRMED (drops the "Est." note, badge → "Confirmed"). Cleared
   when the vehicle changes; session-scoped. Verified: plate GVM 3200 overrides catalogue 3000,
   `estimatedLimits` clears, provenance→CONFIRMED. type-check + eslint clean, 84 calc tests pass,
   calculator page 200. NOT gated like the GVM-upgrade overlay — it's the user's own stamped figure
   (the sanctioned VERIFIED path), and the human-confirm step guards OCR misreads.
   **PICKER PRESENTATION OVERHAUL (2026-06-25):** the Navara-style "shit show" (53 flat rows mixing
   QLD year-bands, cryptic ROVER codes `DC PU 4WD AT ST-X (#054)`, and raw approval codes) is fixed,
   carsales-style. (a) **badge + transmission** now extracted from names (facet-tokens `deriveBadge`/
   `deriveTransmission`; backfilled badge 202 / transmission 448, both surfaced via API). (b)
   **`cleanVehicleName`** composes "ST-X Dual Cab 4x4 Auto" from facets — but ONLY for cryptic
   code-names (`looksCryptic` gate), so readable names ("Double Cab Utility PHEV Platinum 4WD",
   "Dual Cab 2015–2020") are preserved (no info loss). (c) `BrowseTab` now renders **collapsible
   generation/year-era sections** (most-recent open, older collapsed) instead of a flat list; `key`d
   per model so collapse resets. SearchTab rows use clean names too. Verified: Navara → 4 tidy
   sections, ROVER codes legible. Residual: the 4 `LM2TJL…` 2025 rows stay raw (no parsed facets →
   needs the ROVER parse, M2 step-2).
   Plate CTA + modal are shared via `PlateConfirmCTA` (calculator/_components) and now render on BOTH
   desktop (`RightColumn`) and mobile (`MobileResultsBar` sheet) — mobile matters most since plate
   photos happen on phones. `SearchTab` placeholder + empty-state show a clickable worked example
   ("navara 4x4 dual cab" / "jayco journey 6 berth") so the facet-token search is discoverable.
   **REMAINING M4 sub-task:** (c) **slug-as-config-fingerprint** — regenerate variant slugs to embed
   facets + write `VariantSlugRedirect` rows. **DEFERRED — not pre-launch (Tim: not live, SEO not a
   concern yet).** It's a URL/SEO nicety only; users already reach the right variant via the picker.
   Open §12 confirmed: picker/calculator do NOT filter ESTIMATE rows — they surface with a confidence
   badge (correct posture).
5. **Validate** — **BROWSER-WALK DONE (2026-06-25)** via Playwright against the live calculator
   (closes the §11 UI-unverified hole). Confirmed in-UI: vehicle clean names + collapsible
   gen/year sections + cab/drive/badge chips; year/typo/facet search; caravan length chip+display;
   plate-confirm modal. **Caught + fixed a real bug:** `useSearch` had its own item→variant mapping
   that never carried the new facet fields, so SEARCH rows showed raw codes while BROWSE was clean —
   fixed (now share via `picker/display.ts`). **Also fixed:** (a) **year-range cap** — display caps
   yearTo at the current year (2021–2031 → 2021–2026), auto-rolls via `new Date().getFullYear()`
   (`displayYearSpan` in picker/display.ts + buildGroups header); (b) **doubled caravan names**
   ("Jayco Discovery Discovery 2011" → "Jayco Discovery 2011") via `variantHeading` (caravan name
   already includes the model). Shared helpers now used by SearchTab + BrowseTab + CompactCard.
   **HARDENING (2026-06-26):** (a) **cryptic rows demoted** — un-named ROVER code rows
   (`GUN125R-…`/`LM2TJL…`) now sink to the bottom of both browse (client sort `byCleanThenYear`) and
   search (server `ORDER BY name ~ '^[A-Za-z0-9-]{6,}$'` first, so clean rows make the top-N — the
   client sort alone couldn't, since all top-15 were codes). Verified: HiLux/Navara now LEAD with
   clean names, codes last. (b) **37 unit tests** added (`facet-tokens.test.ts` +
   `picker/display.test.ts`) locking in derive*/cleanVehicleName cryptic-gate/parseVehicle+Caravan
   (facets+year+length)/bodyFeetHalf/formatFeet/displayYearSpan-cap/variantHeading-dedup. Full suite
   654 pass.
   **Open finding:** the 2025 raw codes still SHOW (just demoted) — composing real names needs the
   ROVER parse (M2 step-2). Minor: some Jayco caravan models named by floorplan code ("Jayco 17.54-1").
   **Pre-existing unrelated test failure:** `spec-fetch/__tests__/providers.test.ts` ("claude provider
   is a stub") — the grounded-Claude provider was implemented since; the stub test is stale (not this work).

## 12. Risks / open questions

- **Variant explosion:** facets multiply variants where we have data — fine (we only create leaves
  we can fill), but watch picker UX for makes with many configs.
- **Drive/badge coverage is patchy for old vehicles** — accept null + plate; don't fabricate.
- **Caravan floorplan naming is messy** (dealer-typed codes) — needs the same normalisation care as
  the model-name cleanup; do it against the full held raw, not piecemeal.
- **Rule-11:** any re-landed/re-graded compliance figures stay flagged pending Tim's sign-off, same
  posture as the current data.
- **Does the calculator query filter out ESTIMATE rows?** Unverified (§11). Confirm during milestone 4.

## 13. First action when this kicks off

Author the migration baseline (milestone 1) — it unblocks everything and clears the existing
`db push` drift hole in one move. Then vehicle backfill + caravan re-cluster can run in parallel.

## 14. Addendum (2026-06-27) — picker redesign + build-source variants

### 14.1 Picker UI redesigned (supersedes §10 / the M4 chip-soup)

The M4 chip-rows + collapsible gen/year sections (§11.4) felt clunky and were replaced with a
**carsales/caravansales-style** picker (Tim's call after a layout review):

- **One surface, search on top.** The Search/Browse two-tab toggle is gone. A persistent search
  bar is pinned to the top; typing shows live results, clearing returns to Browse. (`PickerBody`
  replaces the tab switch in `EntityPicker`; `PickerShell` no longer takes `activeTab`.)
- **Guided variant narrow-down** (`facet-steps.ts` engine + `VariantNarrow.tsx`): a model's
  variants are narrowed one facet at a time, single-option steps auto-skip, un-named OEM codes fall
  to a collapsible "Other configurations".
  - **Phone:** a stepper — one decision per screen with counts + breadcrumb chips.
  - **Desktop:** the same facets as labelled dropdowns over a live-refining list.
  - **Order (locked):** cars Make→Model→Cab→Drive→**Origin**→Year→Grade · caravans
    Make→Model→**Length**→Year→Berths.
- `SearchTab` deleted; results live in `SearchResults.tsx`. Shared display helpers in `display.ts`
  (year-span cap, `variantHeading` model-dedup, cryptic demotion).

### 14.2 Build-source variants (country of manufacture) — NEW sub-epic

Some model-years ship from >1 plant with materially different GVM / axle / dims — the canonical case
is the **D40 Navara (Barcelona vs Sriracha builds, concurrent across years)**. The coarse variant key
collapses these into one row (a compliance-correctness bug). Honest sourcing reality: ROVER doesn't
reach pre-RVS vehicles and carries no build-origin text anyway, and QLD rego doesn't either — so there
is **no free auto-source**. The build truth lives on the **plate / VIN** (WMI prefix → country) and in
brochures (Tim-supplied, signed off).

Design = a general, self-discovering system:

1. **Represent** — nullable `buildOrigin` (ISO-3166 alpha-2) on `VehicleVariant`; a picker facet step
   that **auto-hides unless a model-year carries >1 value**.
2. **Identify** — plate OCR extracts the VIN; `src/lib/catalogue/vin.ts` maps the WMI → country so the
   plate path auto-selects the right build (the owner needn't know).
3. **Discover** — (Phase 3, pending) cluster plate-confirm evidence by VIN-origin; flag a variant for
   splitting when its confirmations separate into two GVM/axle groups (the P3 contributed-calibration
   moat pattern).

**Status:**
- **Phase 1 — DONE (2026-06-27), ships dark.** Migration `20260627000000_add_vehicle_build_origin`
  (additive); `buildOrigin` threaded through both vehicle picker routes + hooks + types; auto-hiding
  Origin step + flag/name display (`COUNTRY`/`formatOrigin` in `facet-tokens.ts`) + `OriginTag` pill;
  origin-token search ("navara spain" → ES); VIN extraction + WMI→country in the compliance-plate OCR.
  23 unit tests; verified live (temp-seeded ES/TH Navara, screenshotted, reverted). No variant carries
  `buildOrigin` yet → picker unchanged in prod.
- **Phase 2 — PENDING (Tim).** Seed the D40 split with real Spanish/Thai specs (Tim-supplied,
  CONFIRMED tier, Rule-11 sign-off) — turns the mechanism into the first live split.
- **Phase 3 — PENDING.** Plate-evidence discovery → split-candidate flag in moderation.

**Rule 11:** the mechanism is data-free; any build's actual GVM/axle/dim figures are Tim's to supply
and sign off — never invented.
