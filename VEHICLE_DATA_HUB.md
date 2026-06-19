# Vehicle Data Hub — design

> **Status:** DRAFT for Tim's sign-off (2026-06-19). Not built. Supersedes the
> standalone `/admin/catalogue/vehicles/spec-fetch` console (which it absorbs). Touches
> schema + the gated axle/GCM path, so it needs a Rule-11 tick before build. Builds on
> the ROVER pipeline (`VEHICLE_DATA_FETCH.md`) and reuses the existing candidate +
> gating + promotion machinery.

## 1. Problem

Vehicle data arrives from several sources (ROVER documents, AI/grounded-Claude,
compliance plates, community), and today they live in different screens: candidates in
the Spec-Fetch console, promoted variants in the catalogue. You end up looking the same
vehicle up in two places, and there's no single view of **what's done vs what's missing**
per field. We want **one command center**: one record per vehicle, every source folded
in, field-level completeness visible, and every action (fetch AI, review, confirm, edit)
taken from that one spot.

## 2. Core model — the variant is the spine

Flip today's "a candidate promotes into a brand-new variant" into **"the catalogue
variant is the spine, and each source contributes fields to it."**

- **`VariantSpecProvenance` (new):** one row per `(variantId, field)` — the *accepted*
  state of each spec field, carrying `source` (ROVER | CLAUDE | PLATE | COMMUNITY |
  MANUAL), `value`, `confidence`, `status` (CONFIRMED | ESTIMATE | DISPUTED), `asOf`,
  `sourceUrl`, `corroboratingCount`. This is what the coverage matrix reads and what lets
  the **calculator narrow its "Est. — confirm your plate" flag to the specific estimated
  fields** (the open `VEHICLE_DATA_FETCH.md` TODO) instead of flagging a whole variant.
- **`VehicleSpecCandidate` (existing):** stays as the *proposal* layer — an incoming,
  reviewable set of per-field values from one source. Extended with **`targetVariantId`**
  (nullable) so a fetch can fill gaps on an *existing* variant rather than always minting a
  new one, and so candidates can be **field-scoped** (just axle+GCM, say).
- **Promotion** = merge selected candidate fields → the variant's provenance rows (audited,
  per-field). Reuses `promoteSpecCandidate` + `evaluatePromotionGate`.
- **Draft (unpromoted) vehicles** = a candidate with no `targetVariantId` and no variant
  yet — rendered in the hub as an "unpublished" row in the same matrix.

The matrix is a **read-model over provenance (accepted) + candidates (proposed)** — never a
new source of truth.

## 3. Navigation + search

Default browse is the rollup **Make → Model → Variant → Field**, but a search/filter bar
over the same read-model works at **variant grain**, so you jump straight to what you want:

- **Free-text:** make / model / variant name / VTA number.
- **Status facets:** Complete · Partial · Missing-AI-data · Missing-a-critical ·
  Missing-CoG-inputs · Draft (unpromoted) · Estimate-only · Plate-confirmed · Fetching.
- **Source:** ROVER · AI · Plate · Community.
- **Specific-field:** "everything missing **front axle**".
- **Result toggle:** grouped-by-model *or* flat variant list.

(So "incomplete + missing AI" returns the flat list of exactly those variants → click →
the variant. Browse and search are two lenses on one dataset.)

## 4. The coverage matrix

Two tiers of fields — **collected together in one fetch, gated differently**:

**Tier A — Compliance + CoG (defines "done"; gated).**
GVM · GCM · front axle · rear axle · tow-ball · braked towing (criticals) ·
kerb · wheelbase · front/rear overhang · length (CoG inputs).

**Tier B — Powertrain & efficiency (the broad sweep; soft; the fuel-app foundation).**
Grouped by what the fuel app needs:
- **Powertrain (consumption-model inputs):** engine displacement · cylinders/config ·
  induction (turbo / NA) · power (kW) · torque (Nm) · transmission · gears · final-drive
  ratio · drivetrain (2WD/4WD/AWD) · fuel type.
- **Fuel / energy system (range + cost):** fuel grade / min octane (RON) · fuel-tank
  capacity (total + usable) · AdBlue/DEF capacity — and for EV/PHEV: battery (kWh, total +
  usable) · electric range (km) · energy use (Wh/km) · charge-port type · max AC/DC charge rate.
- **Efficiency baselines (claimed / unladen):** fuel consumption combined / urban /
  extra-urban (L/100km) · CO₂ (g/km) · emissions standard.
- **Aero & rolling (the towing-delta drivers):** frontal area / drag coeff (where
  available) · kerb mass (have it) · tyre size / type · width · height.

> **Why collect Tier B now — the fuel app.** The bigger product (per the docs) is a
> fuel-aware trip planner: range + fuel-stop mapping, "minimum comfortable fuel" buffers, and a
> savings strategy from personal preferences. The *same single AI call* that fills compliance
> gaps may as well capture every **static** fuel input, so we never re-crawl. Three notes that
> shape the model:
> - **The real number is real-world TOWING consumption — not on any spec sheet.** The figures
>   above are the unladen *baseline*; the app's edge is modelling the delta from the rig's mass
>   + aero + config, fed by **community real-world logs** (P3 moat, segmented by laden/towing).
>   That's a derived/community field, not a single AI value — the same shape as the CoG edge.
> - **Some Tier-B fields are accessory-modifiable.** A long-range fuel tank changes tank
>   capacity (range) just like a GVM upgrade changes a limit — model it as an **overlay**, not a
>   fixed spec (reuses the upgrade/accessory machinery).
> - **The fuel app also needs non-spec data** — external fuel-price feeds, route / elevation /
>   terrain, and user preferences (reserve buffer, stint length, brand) — separate domains the
>   provenance + aggregation model anticipates, but this AI sweep doesn't fetch.
>
> Tier B is **soft**: it doesn't gate "done", needs no plate — collected **sourced + dated**,
> community-aggregatable via the P3 moat. Designed to grow as features land.

Per-field cell state (trust ladder, weakest → strongest):

| Cell | Meaning |
| --- | --- |
| ○ Missing | no value from any source |
| ⟳ Fetching | an AI job is in flight |
| ◐ Estimate | AI single-source (Tier-A gated — **never green**; axle stays here until plate/cross-source) |
| ◐c Community | user-submitted, below plate-consensus threshold |
| ● Confirmed | ROVER-authoritative, plate-confirmed, or ≥K cross-source agreement (Tier B: sourced + dated) |

Two completeness readings per variant:
- **Compliance status** (the primary "done", drives filters): Complete (all Tier-A ●) ·
  Partial · Estimate-only · Missing-AI · Draft · Fetching.
- **Spec coverage** (secondary): % of Tier B present — filterable ("missing fuel
  consumption"); enriches the record without blocking "done".

## 5. Sources & trust ladder (Rule 11)

Unchanged in spirit from `VEHICLE_DATA_FETCH.md` §1–2; the hub just renders it:

- **ROVER (structured doc)** → auto-confirmed for the fields it carries (GVM/tow/kerb/dims).
- **Plate (VLM-confirmed)** → confirmed-for-this-rig; publishes to others only at ≥N agreeing.
- **AI / grounded Claude** → **estimate, never green for a critical.** Axle/GCM stay
  **diagnostic** regardless of AI confidence (the vendor-axle trap is worst here).
- **Cross-source agreement** (≥K independent authoritative, exact-match) can upgrade an
  estimate → confirmed. **K, the tiers that count, and exact-vs-tolerance per field are
  Tim's Rule-11 call.**
- **Community** → personal/diagnostic until the P3-moat consensus threshold.

## 6. AI fetch — how it's triggered  ← (the part to nail)

**Unit of work:** one AI job = `(variant, set-of-missing-fields)`. Per-variant is the atom.
Runs on the existing **BullMQ `specFetchQueue`** (worker `runSpecFetchJob` exists + is
gate-tested), provider = **CLAUDE (grounded + web_search + structured output)**, citations →
per-field `sourceUrl`. Output lands as **candidate fields → gated estimates**, never
promoted automatically.

### Entry points (granularity)
1. **Per-variant — "Fetch missing fields"** (primary): fills that variant's gaps (axle/GCM/…).
2. **Per-model — "Fetch missing across N variants"**: fans out to N per-variant jobs (confirm
   dialog shows N + est. cost). Essential for ROVER's 25–67-variant models where axle/GCM is
   missing on *all* of them.
3. **Per-field**: targeted single field (re-fetch a disputed/stale value).

### Trigger modes
- **Auto on a NEW ROVER entry (forward completeness).** When the incremental crawl ingests a
  newly-published approval, auto-enqueue the AI gap-fill for its missing criticals (axle/GCM)
  — so the catalogue stays **complete from 2021 on, going forward**. Affordable because new
  approvals are a weekly trickle (not the 5000 backlog). The cheap part (variant names +
  GVM/tow/kerb) already comes from the RVD itself; only the axle/GCM AI call is added.
- **Manual (bulk curation).** Admin-initiated from the hub — fire a batch across a model's
  variants or the "Needs AI" queue. How the popular tow-rig shortlist and the backlog get
  worked through deliberately.
- **Demand-driven (back-catalogue).** A user **search-miss**, or selecting a name-only
  skeleton (§6.5), enqueues a **low-priority** fetch → appears in the hub as a Draft for
  review ("let demand be the list" — the pre-2021 path and the un-curated ROVER backlog).
- The **5000-strong existing ROVER backlog is NOT auto-AI'd** — it's populated as name
  skeletons (§6.5) and filled on selection/curation. Only *new* entries auto-fill.

### The "Needs AI" queue
A first-class saved filter = variants missing a critical that have **no AI attempt yet**.
Select rows → **bulk fetch**. This is the day-to-day workflow: open the queue, fire a batch,
review the estimates as they land.

### Controls (cost + safety)
- **Gate:** runs only when `SPEC_FETCH_LIVE_ENABLED=true` + `ANTHROPIC_API_KEY` set (existing
  gate). Off by default → no live model calls.
- **Dedup:** a `(variant, field)` fetch already queued/running is not re-enqueued.
- **Cooldown:** don't auto-refetch a field fetched < N days ago (forced refresh overrides).
- **Batch cap:** max jobs per bulk action / per day (so a model-bulk can't runaway).
- **Budget guard (optional):** a spend ceiling; abort + alert when hit.
- **Idempotent:** a re-fetch **replaces** the prior AI estimate for that field (refresh-in-place,
  like ROVER ingest) — never duplicates.

### What it fetches
- **The full spec sheet in one structured-output call** — Tier A *and* Tier B (§4). One
  grounded-Claude call returns the whole set with per-field citations; asking for 30 fields
  costs the same as asking for 6. Skips fields already ROVER-authoritative or plate-confirmed
  (never re-states a confirmed value), fills every other empty Tier-A and Tier-B field.
- **Tier B lands soft** — sourced + dated, no plate/gate; Tier-A criticals stay gated (axle
  diagnostic). Provenance is per-field regardless of tier.
- **Optional "seek corroboration"** mode: for a single-sourced *critical*, ask AI for a
  *second* independent authoritative source → feeds the cross-source-agreement upgrade (§5).

### Status, inline
Each fetched cell shows ⟳ while queued/running, then the estimate (◐) with confidence +
citation + `lastFetchedAt`, plus a per-field **Confirm** (admin tick / plate) and **Re-fetch**.
Job failures surface inline (not a silent gap).

## 6.5 Catalogue population — names first, data on demand

The catalogue should be **browsable before its data is fetched**: a user (or admin) can see a
vehicle exists and select it, which *then* pulls the data. Three layers, cheapest first:

| Layer | What | Source | Cost | When |
| --- | --- | --- | --- | --- |
| **0 — Skeleton (names)** | one entry per VTA: make + model + category + VTA + last-updated. Browsable/searchable immediately; status **"names-only / not fetched"**. | **ROVER grid** (the directory IS the enumerable list — one cheap grid crawl yields all ~5000). | ~nil (no detail, no AI) | Bulk, up front |
| **1 — ROVER core data** | expands a skeleton into its real **variant names + GVM / braked-tow / kerb / dims** (one RVD parse yields names *and* figures together). | **VTADetails RVD** (HTTP only) | cheap (paced HTTP) | Auto for new entries; on selection/curation for the backlog; or a paced backfill |
| **2 — AI gap-fill** | the fields ROVER lacks: **front/rear axle, GCM** (gated estimates). | **grounded Claude** | $ per call | Auto-on-new (§6); on-demand / manual for the backlog |

- **Skeleton grain caveat:** the grid gives make + model + VTA (approval grain), **not** the
  per-variant names — those only exist in the RVD. So a skeleton is **model/VTA-level** until
  Layer 1 expands it into variants. The hub renders an un-expanded skeleton as a single
  "Draft — not fetched" row; selecting it runs Layer 1 (then Layer 2).
- **Pre-2021 vehicles aren't in ROVER**, so there's no skeleton list for them — names arrive
  **demand-driven** (search-miss → AI) plus the manual/CSV/popular-shortlist paths. (A curated
  seed of popular pre-2021 tow rigs is the sensible starting set.)
- **Layer 1 mines Tier B for free where the RVD has it** — engine displacement, cylinders,
  fuel type and tyres are in the RVD's engine/fuel/tyre listings (structure-on-demand from the
  archived raw text). Fuel *consumption* / CO₂ usually aren't in the RVD, so the Tier-B AI
  sweep (Layer 2) fills those.
- **Net:** every 2021+ vehicle is *visible* from day one (Layer 0); the popular ones get
  fully curated (Layers 1–2) deliberately; the long tail fills as it's selected.

## 7. Absorbing the Spec-Fetch console

`/admin/catalogue/vehicles/spec-fetch` retires; its actions (fetch / review / edit /
gate-override / promote / reject / unpublish) move onto the variant/field detail in the hub.
The candidate table stays (it's the proposal layer); only the *destination* changes — one place.

## 8. Boundaries

- **Admin-only.** The public **confirmed-spec vehicle page** (`VEHICLE_DATA_FETCH.md`
  decision 6) reads the same provenance but renders **only CONFIRMED** fields, provenance-
  stamped; AI estimates never appear publicly.
- The calculator reads the variant + provenance to scope its estimated-field flags.

## 9. Data-model changes (sketch)

- **`VariantSpecProvenance`** — `(variantId, field)` unique; `source`, `value`, `confidence`,
  `status`, `asOf`, `sourceUrl`, `corroboratingCount`.
- **`VehicleSpecCandidate`** — add `targetVariantId` (nullable); allow field-scoped candidates;
  add a `triggeredBy` (MANUAL | SEARCH_MISS | BULK) for audit/cost tracking.
- **Spec-fetch job** — add `targetVariantId` + `fields[]` to the job payload; a
  `triggeredBy` reason already on the candidate covers AUTO_ON_INGEST | SEARCH_MISS | BULK.
- **`RoverApprovalIndex` (new — the skeleton/names layer):** one row per VTA — `vtaNumber`,
  `make`, `model`, `category`, `lastUpdatedMs`, `expandState` (UNFETCHED | EXPANDED),
  `resultingModelId?`. Populated from the grid crawl (cheap, all ~5000); "expand" runs the
  RVD detail fetch (Layer 1). The hub lists UNFETCHED rows as Draft skeletons.
- Backfill: write provenance rows for the already-ingested ROVER variants (source = ROVER).

## 10. Build phasing (incremental, each shippable)

1. **Provenance spine** — `VariantSpecProvenance` schema + backfill the already-ingested ROVER
   variants' provenance (no UI). *(Read-only hub build starts here — agreed 2026-06-19.)*
2. **The hub (read-only)** — matrix + browse + search/filter over existing data. Already
   useful: see done/missing across the catalogue.
3. **Skeleton population** — `RoverApprovalIndex` from the grid crawl + the "expand" (Layer-1
   RVD detail) action; name-only Draft rows become browsable.
4. **AI fetch wiring** — grounded-Claude provider + the trigger entry points (incl.
   auto-on-new-ingest) + job status + the "Needs AI" queue + cost controls.
5. **Absorb Spec-Fetch** — per-field promote/confirm; narrow the calculator's estimated flags.
6. **Cross-source agreement + demand-driven auto + public confirmed-spec page.**

## 11. Rule-11 / decisions for Tim

1. **Cross-source agreement:** K (how many independent authoritative sources), which tiers
   count, exact-match vs tolerance **per field**.
2. **Axle / GCM confirm bar:** stays diagnostic by default — what upgrades it (plate only? plate
   *or* K-source?).
3. **AI auto-trigger scope:** demand-driven on/off; any auto-on-ingest (and for which
   categories)?
4. **Cost controls:** cooldown window N, per-day batch cap, budget ceiling.
5. **"Confirmed" definition per field tier** — the green bar for each field.
6. **Status taxonomy / "done" bar** — confirm the §4 rollup definitions.
7. **Tier-B field set** — confirm the powertrain/efficiency list (anything the fuel project
   needs that's missing?), and that soft fields need only "sourced + dated" (no plate/gate).
