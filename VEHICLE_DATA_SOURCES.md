# Vehicle Data — Source & Trust Strategy

> Living doc. Captures where vehicle data comes from, how much we trust each
> source, and how it lands in the DB. Decisions reached 2026-06 (Tim + Claude).
> Sits alongside `VEHICLE_DATA_FETCH.md` (the on-demand fetch feature) and
> `VEHICLE_DATA_HUB.md` (the admin browse/coverage surface).

## The core split: two different data problems

| | **Identity list** | **Spec fill** |
| --- | --- | --- |
| What | make → model → badge → year (+ build date) | GVM / GCM / kerb / **front+rear axle limits** / braked tow / TBM / fuel |
| Shape | broad but shallow (just names) | deep, per-vehicle |
| Needs to | exist upfront so users can find their vehicle | be filled when a vehicle is selected ("the pull") |
| Cost | cheap / free | the AI grounding spend |

Conflating these is what makes scraping carsales/RedBook *look* necessary. It isn't —
identity has free sources; the hard specs aren't licensable from anyone (see Dead ends).

## Three-tier trust model

Web/AI data is **never** treated as truth. The ceiling depends on the source:

| Tier | Source | Authoritative for | Lifts Rule-11 gate? |
| --- | --- | --- | --- |
| **ESTIMATE** | AI / web grounding (any confidence, M *or* H) | nothing — pre-fill only | No |
| **CONFIRMED** | **Owner's manual / OEM spec sheet** (hand-collected or VLM-extracted) | the **variant** (manufacturer's own published figure) | Catalogue-level only |
| **VERIFIED** | User's **compliance-plate photo** | the **specific vehicle** (catches options / second-stage / GVM upgrade) | Yes |

**Rule:** if a figure is from any web/AI source (M or H), we **still prompt the user to
plate it.** Confidence drives *display emphasis* and *review priority* only — it never
substitutes for a plate. A **manual** is genuinely authoritative at the *variant* level,
so it can take a catalogue figure to CONFIRMED/green; the **plate** is authoritative at
the *instance* level and stays the per-user check (it's what catches a GVM upgrade).
Encode as `VariantSpecProvenance` source tiers: `AI_WEB → ESTIMATE`,
`OWNER_MANUAL/OEM_DOCUMENT → CONFIRMED`, `PLATE_PHOTO → VERIFIED`.

## Source map (consolidated research, 2026-06)

| Source | Gives | Has axle/GVM/GCM? | Access | Verdict |
| --- | --- | --- | --- | --- |
| **QLD rego — Light Vehicles fleet** (`Vehicle registrations`, dataset `6632a3a0-…`) | make/model/body/year/fuel/cyl + **GVM + TARE/kerb**, full fleet **incl. utes** + prevalence | **GVM + kerb YES** (validated sane); **GCM blank; no axle** | **Free, CKAN, no key** | **Best find** — free plated GVM/kerb spine |
| **QLD rego — New & Transfers** (`f70d8de3-…`, passenger only) | make/model/**badge**/body/year/**build-date** + prevalence | No specs | Free, CKAN, no key | Adds **badge** granularity; **no utes, no weights** |
| **ROVER / RAV** | identity + GVM/GCM/tare (2021+) | GVM/GCM yes; no axle | Free, already ingested | Headline spine for 2021+ |
| **Wikidata** | make/model/generation/year skeleton | No | Free (CC0) | Optional identity backbone |
| **OEM spec-sheet PDFs** (Isuzu `/Spec_Sheets/`, Toyota hubs) | GVM/GCM/kerb/tow/TBM | partial (no axle split) | open PDFs | **VLM-extract → CONFIRMED** |
| **OEM owner's manuals** | **front/rear axle limits** + plate data | **YES** (but) | per-model PDFs | ⚠️ **NOT openly downloadable** — gated/portal'd/VIN'd (2026-06-21: 5/5 verified-discovery NO_URL). Extraction works on a PDF Tim *supplies* → CONFIRMED |
| **AI grounding (Claude + web_search)** | gcm/overhang/fuel/dims YES; **axle mostly NO** | partial | API key + web search | ESTIMATE gap-filler for headline/geometry; **does NOT yield axles** (placard-only data) |
| **Lovells / Pedders certifier pages** | **FACTORY** front/rear axle + GVM + GCM **AND** upgraded + CPA # | **YES — the axle source** | public HTML (Lovells not bot-blocked; Pedders 403s) | ✅ **2026-06-21: harvested → 215 variants axle landed.** Factory axle → base variant; upgrade → `GvmUpgrade` |
| **Green Vehicle Guide** | identity + **fuel L/100km** (2004+) | No | search-only, **licence unconfirmed** | Pursue by email; not turnkey |
| **RACQ Towing Mass Guide** | kerb/GVM/GCM/tow/ball (<4.5t, back to 2000) | GVM/GCM/tow yes; no axle | PDF/web | Cross-check seed |
| **Compliance plate (user)** | the actual vehicle's certified figures | YES | user photo upload | **VERIFIED — the only green** |

### Axle limits — SETTLED 2026-06-21 (after testing all four candidate sources)

The front/rear axle gap (the longitudinal-CoG differentiator) is now sourced. Findings, in order:
1. **AI web grounding** — fills gcm/overhang/fuel/dims, **not axles** (they're placard-only). ~$7, 5 rigs.
2. **Owner's manuals** — **not openly downloadable** (gated/portal'd/VIN'd; verified-discovery 5/5 NO_URL,
   ~$2). The local VLM extraction pipeline (`src/lib/spec-fetch/manual/extract.ts`: pre-screen →
   docling-VLM/text → Qwen → GVM-validate) WORKS on a supplied PDF, but there's nothing to download.
3. **RVD remarks** — axle only for second-stage builds (169 motorhome/upgrade docs in `RoverDocument.parsed`).
4. **✅ GVM-upgrade certifiers (LOVELLS) — the answer.** Public HTML lists FACTORY front/rear axle per
   gen. Harvested + gen-aware-landed → **215 variants** (`lovells-harvest-local.ts` + `lovells-land-local.ts`),
   as MANUAL/ESTIMATE, Rule-11-gated, GVM-validated. Gaps (Navara/Triton/Amarok) → Pedders/Ironman next.

5. **✅ Brave-dork PDF discovery — the GENERAL source.** Search dorks (`filetype:pdf gvm gcm
   specifications`) via the **Brave Web Search API** → bulk fetch → the extract pipeline →
   GVM-keyed gen-aware landing. Surfaces OEM spec PDFs (the files portals gate), dealer CDNs,
   spec archives. Added **84 variants** incl. SUVs Lovells can't cover (X-Trail/CX-5/Kluger/…).
   `brave-pdf-search` + `brave-extract` + `brave-land`. Needs `BRAVE_API_KEY`.

**TOTAL axle coverage 2026-06-21: 298 variants** (Lovells 215 + Brave 83) across 10 makes — from 0.
The realistic axle stack: **Lovells + Brave-dork (factory/spec) → ESTIMATE** · **user plate → VERIFIED**.

## Acquisition strategy by data tier

- **Identity** → **QLD rego CSV** (make/model/badge/body/year/build-date + prevalence) as the
  spine; **ROVER** for 2021+; **AI-resolve free-text fallback** for the long tail (canonicalises
  what a user types, fills it, adds it to the list — self-healing). Wikidata optional.
- **Headline specs (GVM/GCM/kerb/tow/TBM)** → **OEM spec-sheet PDFs via the existing
  Tesseract+Qwen VLM pipeline** (authoritative, reuses infra) → CONFIRMED; **AI grounding** as
  gap-fill → ESTIMATE; RACQ guide as cross-check.
- **Front/rear axle limits** → **owner's manuals** (Tim hand-collecting) via VLM → CONFIRMED;
  **AI grounding** as the fast pre-fill → ESTIMATE (stays diagnostic per Rule 11 until plated).
- **Second-stage / GVM-upgrade (the moat)** → structured **harvest of Lovells/Pedders** public
  pages (+ distributor mirrors), CPA-attributed, into the `GvmUpgrade` model. Caveats that match
  our `gvm-caps` work: GVM upgrades **mostly don't raise GCM** (capture revised GCM only where the
  CPA states it); **state recognition differs** (QLD/WA/NT don't honour revised in-service GCM) →
  needs the per-state validity flag.
- **Fuel** → **GVG** (pursue licence by email to `gvg@infrastructure.gov.au`) or **AI grounding**
  meanwhile.

## Fill strategy

Hybrid, to reconcile "every variant, going way back" with "don't pre-pay for the universe":

- **Batch pre-bake the hot set** (top families by QLD prevalence) → instant common-case UX.
- **Live-fill the long tail on demand** (old trims, rare variants) → first user triggers a grounded
  fetch (~10–60s), it persists, everyone after gets it instantly. Each rare vehicle paid **once, ever.**
- Live fill = the `feature/vehicle-data-fetch` work turned on. Needs: prod API key behind
  `SPEC_FETCH_LIVE_ENABLED`, a "fetching specs…" first-fetch UX, and **cost guards** (cache,
  per-user rate-limit, `max_uses` cap, daily spend ceiling).
- Everything web/AI lands **ESTIMATE-pending-plate**; the plate is the only promotion to VERIFIED.

## Scope decisions (Tim)

- **Families:** ~26 common AU tow rigs, current **and** the superseded "go-backwards" generation
  for the long-life rigs (Navara D40, LC200, Patrol GU/Y61, Pajero, KUN HiLux). Prevalence from the
  QLD rego data replaces the guessed list.
- **How far back:** as far as is genuinely still towing — ~2005 floor for high-runners, deeper for
  the iconic long-life rigs (combination of options 1 + 3).
- **Variants:** capture **every variant incl. trims** (Tim's call). Note the QLD `BADGE` field gives
  trim-ish granularity but is messy (`3DR` / `2.0` / `PREMIUM`) and lacks **drivetrain (4x2/4x4),
  transmission, engine displacement** — those still need AI/manual enrichment.

## QLD rego ingest — practical notes

> **Two QLD datasets (both free, CKAN, no key) — use the right one:**
> 1. **`Vehicle registrations` → "Light Vehicles" Parts 1–5** (dataset `6632a3a0-8cb2-41b6-9435-50f762850d72`;
>    Part 1 res `16352b55-fc97-442b-a741-52276d18ff30`) = the **full registered light-vehicle fleet incl.
>    utes**, carrying **GVM + TARE/kerb** (validated sane: Ranger 3200/2230, HiLux 3000/2075, D-Max
>    3050/1945, LC79 3300/2175). Caveats: **no badge**, **GCM column blank**, **no axle**, values have
>    trailing whitespace, and GVM is *as-registered* → **mode = factory, outliers = real GVM upgrades**.
>    Cols: `Make, Model, Body Shape, Year of Manufacture, Fuel Type, Number of Cylinders, Number of Seats,
>    GVM/GCM/GTM/ATM/TARE Weight, VIN Prefix`. **This is the GVM/kerb + identity spine.**
> 2. **`Vehicle Registration New and Transfers`** (`f70d8de3-…`, 16 CSVs) = **passenger only** (no utes,
>    Wagon/Hatch/Sedan), **no weights**, but **has BADGE** + build-date + transaction prevalence. Use only
>    for passenger badge granularity.
>
> `trim()` is **not** whitelisted in CKAN `datastore_search_sql` (Authorization Error) — normalize
> whitespace client-side; match with `LIKE 'VALUE%'` server-side.

- **No API key required.** CKAN read API is public (keys are only for *writing*).
- **Endpoints** (base `https://www.data.qld.gov.au`): `…/api/3/action/datastore_search` (paginated) and
  `…/api/3/action/datastore_search_sql?sql=…` (server-side `GROUP BY` — aggregate without downloading).
- **Light Vehicles fleet = the spine the scripts use.** Resource IDs (see `LIGHT_VEHICLE_PARTS` in
  `qld-fleet-ingest-local.ts`): Part1 `16352b55-…`, Part2 `2d5d94d7-…`, Part3 `46da194e-…`,
  Part4 `edd505f7-…`, Part5 `f4427a2b-…`. Columns are **mixed-case, trailing-whitespace**:
  `Make, Model, "Body Shape", "Year of Manufacture", "Fuel Type", "Number of Cylinders", "GVM Weight",
  "TARE Weight", …`. ⚠️ The passenger *New & Transfers* file (`612e754f-…`) uses DIFFERENT **upper-case**
  columns (`MAKE, MODEL, BADGE, BODY_SHAPE, …`) and has no weights — don't mix the two up.
- **Gotcha:** `trim()` is blocked in CKAN SQL (Authorization Error) → match with `LIKE 'VALUE%'`
  server-side, normalize whitespace client-side.
- **How to run a job:** `DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" npx jiti
  src/jobs/<job>.ts [flags]`. (`jiti` is the TS runner; runners build their own PrismaClient via the
  PrismaPg adapter, so only `DATABASE_URL` is needed. Bulk pulls should go via n8n/VPN — see egress below.)
- **Schema-change gotcha (Prisma 7):** `migrate dev` rejects `--skip-seed`/`--skip-generate` and reads the
  URL from `prisma.config.ts`. Use `DATABASE_URL=… npx prisma migrate dev --name X --create-only --url "$DB"`
  → `DATABASE_URL=… npx prisma migrate deploy` (no seed, no reset) → `npx prisma generate`.
- **Normalize** make/model like ROVER (`RoverMakeNormalizer` pattern) — TMR conventions are inconsistent.
- QLD-only (one state) but covers ~every common AU model; skews 4WD/ute/caravan — *good* for this app.
  NSW/VIC publish similar if we broaden. Indicative prevalence: Toyota 982k · Mazda 382k · Holden 354k ·
  Mitsubishi 330k · Ford 327k regos (light-vehicle fleet).
- Egress: a public open-data API call is **not** the ROVER portal (low risk) — but it still leaves the home
  IP. For repeated/bulk pulls, route through n8n/VPN per `crawl-egress-vpn-only`.

## Dead ends (do not re-research)

- **US datasets:** NHTSA vPIC (axle fields return *empty*; GVWR only as a class band), EPA
  fueleconomy (US fuel only).
- **GitHub car-spec repos** (arthurkao / abhionlyone / plowman): identity-only, US, stale.
- **NHVR:** heavy-vehicle *regulations*, not a vehicle DB. **State portals:** registration *counts*
  only (except QLD's per-transaction file, used above).
- **Know My Tow:** competitor, undisclosed source, no axle field — not a source.
- **RedBook:** quote-only, ~low-tens-of-thousands AUD/yr, and **does not itemise axle limits** —
  pays for headline data we already get free from ROVER, skips the moat. (Owner = CAR Group, **not**
  cap hpi/Solera.)
- **Owner's manuals via web (2026-06-21):** NOT openly downloadable — OEM portals 403/JS/VIN-gate, and
  free-floating "manuals" online are mostly *workshop/repair* manuals (no weight ratings). Verified
  AI discovery returned 5/5 NO_URL. Don't re-chase web discovery; the manual path needs Tim-supplied
  PDFs (then the VLM pipeline extracts them) or the plate.
- **AI web grounding for AXLES (2026-06-21):** axle limits are placard-only; grounding returns them
  null for most makes (Toyota/Ford/Nissan). Good for gcm/overhang/fuel, not axles. Use Lovells instead.

## Cost notes (AI grounding)

- Token pricing (per MTok): Opus 4.8 $5/$25 · Sonnet 4.6 $3/$15 · Haiku 4.5 $1/$5 · Fable 5 $10/$50.
- **Web search = $10 / 1,000 searches** ($0.01 each) on top of tokens; search-result text bills as
  input tokens. Batch API halves tokens but **not** search.
- Per-vehicle (rich, grounded): ~$0.15 Sonnet / ~$0.23 Opus. The 10-vehicle test over-searched
  (6–13 searches each) — **cap `max_uses` ~4–5**.
- **Model rec:** Sonnet 4.6 default for grounded extraction; escalate the ambiguous second-stage /
  GVM-upgrade rows to Opus 4.8. Tier the search: ground **axles + second-stage** aggressively, fill
  headline fields cheap (memory was ~85% right there). Hot-set backfill ≈ under $10; full corpus
  ≈ $120–180 if ever needed.

## Build status (2026-06-20) — QLD fleet pipeline

QLD fleet backbone is **ingested → normalised (deterministic + AI) → ready to promote.** All on branch
`feature/vehicle-data-fetch`; staging DB populated; nothing running in the background.

**Data in `QldFleetVehicle` (43,484 combos, make·model·year·body):**
- `normStatus` split (combos): **AUTO 19,208 · NEEDS_REVIEW 15,032 · JUNK 9,244**
- AUTO = canonical make + confidently-named model (tow rigs + ROVER-corroborated + AI-resolved tail) → promotable
- NEEDS_REVIEW = mostly the non-tow passenger tail not yet AI-processed (+95 low-conf)
- JUNK = non-canonical makes + AI-rejected non-models (trucks/trims/codes)
- 19,560 combos carry factory GVM; 2,209 carry the in-the-wild GVM-upgrade signal

**Scripts (all gate-clean):**
- `src/jobs/qld-fleet-ingest-local.ts` — CKAN pull → aggregate (mode-GVM=factory, kerb, prevalence,
  upgrade-spread) → `QldFleetVehicle`. Flags `--dry-run` / `--write` (full-refresh) / `--body=` / `--make=`.
- `src/jobs/qld-normalize-local.ts` — deterministic make-alias + model dedup + ROVER cross-join →
  AUTO/NEEDS_REVIEW/JUNK + canonicalMake/Model.
- `src/jobs/qld-canon-writeback-local.ts` — folds the multi-agent canonicalisation
  (`/tmp/qld-canon/out-*.json`) back into staging.
- Multi-agent workflow `qld-model-canonicalise` resolved the 1,285-pair tow residue (787→AUTO, 403→JUNK,
  95→review); ~$3–6, no web search. (Inefficiency noted: each agent re-read the full input file — next time
  pass per-batch slices.) **Only `qld-canon-writeback-local.ts` is committed** — the extract step
  (NEEDS_REVIEW + GVM + tow-body distinct pairs → `/tmp/qld-canon/input.json`) was ad-hoc and the workflow
  script lives in the session dir, NOT the repo. To re-run canonicalisation (e.g. the passenger tail), both
  must be recreated/committed first.

**Migrations applied:** `20260620015952_add_qld_fleet_vehicle`, `20260620023156_qld_normalization_fields`.

## Promotion — DONE (2026-06-20)

**QLD AUTO → live catalogue is promoted.** `src/jobs/qld-promote-local.ts` (gate-clean, idempotent,
`--dry-run`/`--write`/`--make=`/`--min-regs=`/`--min-band-regs=`) wrote: **41 makes · 329 models ·
1,149 variants · 2,255 `QLD_REGO`/ESTIMATE provenance rows.** Decisions baked in:
- **Tow bodies only** (DUAL CAB / UTILITY / UTE CAB'N'CHASSIS / WAGON / VAN) — the sedan/hearse/bus tail is excluded.
- **One model per nameplate** (bodyType = dominant tow body); body+spec live on the variant name ("Dual Cab 2016–2020").
  Mixed-case `canonicalModel` dups (LANDCRUISER/LandCruiser/Landcruiser) are folded by display-slug + a
  per-(body,year) aggregation, so the `(modelId, name, year-range)` exclusion constraint holds.
- **Spec-generation split**: contiguous years sharing factory GVM → one yearFrom–yearTo variant.
- **Scope/quality**: 2005 year floor; iconic rigs (HiLux/LandCruiser/Patrol/Pajero/Navara/Prado) back to 1990;
  per-variant ≥25 regs; sanity guards drop impossible kerb/GVM. Reconcile pass deletes stale/refresh leftovers.
- New: `QLD_REGO` `SpecProvenanceSource` + `maxRoofLoadKg` on `VehicleVariant` (migrations
  `…061913`, `…063140`). Roof load is unpopulated by QLD (manuals/AI/plate later) — rooftop-tent load
  eats GVM + raises CoG (stability, Rule 11).

**GVM upgrades:** `src/jobs/rover-promote-gvm-upgrade-bulk-local.ts` (run with `tsx`, not jiti) sweeps EXPANDED
`secondStageType=GVM_UPGRADE` rows → `GvmUpgrade` overlays on the resolved base. Only **1 of 174 is EXPANDED**
(VTA-066264 Ironman HiLux → attached, GVM 3800, GCM untouched); the other **173 are UNFETCHED and need the
ROVER RVD detail-fetch via n8n/VPN** before they can attach. Stale makes `Ironman TMCA Toyota` + `TRAKKA FIAT`
deleted. ROVER **base** (744 NONE rows) likewise needs expansion before GCM/badge merge.

### Original routing plan (for reference)

Fold `QldFleetVehicle` (+ ROVER) into the **live catalogue** as ESTIMATE-pending-plate. **3-way routing:**

| Source | Routes to |
|---|---|
| QLD `normStatus=AUTO` combos + ROVER base (`secondStageType=NONE`) | `VehicleMake`/`VehicleModel`/`VehicleVariant` (the car); GVM+kerb from QLD as `ESTIMATE`, GCM/badge from ROVER |
| **ROVER `secondStageType=GVM_UPGRADE` (174: Ironman/Premcar/Lovells…)** | **`GvmUpgrade` overlay on the resolved base variant — NEVER a standalone make.** Reuse `rover-promote-gvm-upgrade-local.ts` routing |
| ROVER MOTORHOME(75) / CONVERSION(37) / OTHER(291) | their own handling (defer) |

**Cleanup:** delete the stale test make `"Ironman TMCA Toyota"` — a GVM upgrade wrongly promoted as a *make*
(promotion never ran on this fresh DB: only 1 `GvmUpgrade` row exists vs 174 classified). The catalogue is
otherwise near-empty test data (3 makes / 2 variants), so QLD+ROVER effectively builds it from scratch.

**GVM-upgrade cross-source:** ROVER = the *certified kit* (Ironman HiLux SSM → upgraded GVM/GCM/axle); QLD
`gvmUpgradeSignal` = the *same upgrades seen in registrations* (e.g. 198 Rangers at 3500 GVM). Reconcile.

**Promotion mechanics to settle (open design — decide these before building the promote job):**
- **Order matters.** Create base `VehicleVariant`s FIRST (ROVER base + QLD AUTO), THEN run the GVM-upgrade
  routing — a `GvmUpgrade` row attaches to an *existing* base variant, so the base must exist or it orphans.
- **QLD↔ROVER merge.** Both feed the *same* variants — join on canonical make/model (+ year) so a HiLux
  isn't duplicated. Take GVM/kerb from QLD, GCM/badge from ROVER. Define the merge key + dedupe before insert.
- **QLD combo → `VehicleVariant` mapping.** QLD is per (make, model, **year**, body) with **no trim**, but
  `VehicleVariant` has `yearFrom/yearTo` + a `name`/`slug` (trim-level). Decide: collapse QLD years into
  `yearFrom/yearTo` ranges? one variant per (make, model, body)? what `name` when there's no trim
  (e.g. body-based: "HiLux Dual Cab")? Map QLD `Body Shape` → the `VehicleBodyType` enum
  (`DUAL_CAB_UTE` / `WAGON` / `SUV` / `VAN` …; QLD has no SUV — wagons cover 4WD wagons).
- **Idempotent + batched**, everything `ESTIMATE`. New job, e.g. `qld-promote-local.ts`.

**Rule 11 / trust:** everything promoted lands `ESTIMATE`; plate stays the only green; axle limits still
absent (manuals / AI / plate). Do not un-gate.

## Open items

- [x] **Promotion** (above) — QLD AUTO → variants (1,149) **DONE**; stale makes cleaned; 1/174 GVM_UPGRADE attached.
- [~] **ROVER expansion via VPN** — IN PROGRESS. `rover-expand-bulk-local.ts` drives the n8n `rover-expand`
      webhook per UNFETCHED row (n8n fetches ROVER on the AU VPN → app `/api/rover/ingest`). Politeness: jitter
      + escalating backoff honouring `Retry-After` + 120s request timeout + abort-on-persistent-block.
      **Gotcha found:** large detail pages (inline PDFs) 413 at the public nginx edge (`client_max_body_size`),
      so the run posts to the app's **internal** URL `http://172.16.1.239:3070` to bypass it (ROVER hop still
      VPN — only the n8n→app return hop changed). Long-term: raise the edge nginx limit. After expand:
      `rover-promote-base-local.ts` + `rover-promote-gvm-upgrade-bulk-local.ts` to land GCM/axle + overlays + trucks.
- [ ] **ROVER full backfill (the BIG pass)** — BUILT, not yet run. `ops/n8n/rover-backfill.json` (webhook
      `rover-backfill`, imported + active in n8n) pages the grid **ASC by approval number** (full sweep), discovery
      only; `rover-backfill-discover-local.ts` drives pagination + upserts skeleton rows into RoverApprovalIndex.
      We hold ~1,321 of the ~5,000 register; this discovers the rest. **Run after the expand pass finishes** (don't
      double live-portal load), then run expand again on the new UNFETCHED rows, then promote.
- [ ] **n8n refresh workflow** — periodic re-pull. n8n can't run `jiti` directly, so either (a) an exec/SSH
      node that runs `qld-fleet-ingest-local.ts --write` on the box, or (b) replicate the CKAN queries in n8n
      → POST to a new app ingest endpoint (the ROVER `ops/n8n/` pattern). **Import inactive.** Data refreshes
      only when QLD republishes (~periodic), so low urgency.
- [ ] **Passenger NEEDS_REVIEW tail (~15k)** — optional, for full non-tow coverage: first re-create the
      extract (→ `/tmp/qld-canon/input.json`) + the `qld-model-canonicalise` workflow (neither committed —
      see Build-status note), then run + `qld-canon-writeback-local.ts --write`.
- [ ] **GVG licence** — email `gvg@infrastructure.gov.au` for a data extract + commercial reuse terms (Tim/ops).
- [ ] **Owner's-manual collection** — Tim gathering; wire `OWNER_MANUAL → CONFIRMED` provenance tier.
- [ ] **Grounded Claude provider** — tiered prompt (cheap headline, grounded axles + second-stage,
      `max_uses` capped), ESTIMATE-pending-plate, behind `SPEC_FETCH_LIVE_ENABLED`.
- [ ] **Lovells/Pedders moat harvest** → `GvmUpgrade` (CPA-attributed, per-state flag), via n8n/VPN.
