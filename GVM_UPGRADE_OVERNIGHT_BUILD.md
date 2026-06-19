# Overnight build — GVM upgrades + Data-Hub maturation

> **For a fresh context.** Read this top-to-bottom, then `VEHICLE_DATA_HUB.md` (the hub design
> + §3.5/§4 overlay intent) and `VEHICLE_DATA_FETCH.md` §4–5 (the GVM-upgrade overlay + state
> caps spec). Then execute the **Build plan** phase by phase, keeping the health gate green.
> **Honour the Guardrails.** Commit at the end; **do not push or merge** — leave for Tim.
>
> **This is a planning draft (2026-06-19). Refine before kicking off.**

---

## 1. Where we are (branch `feature/vehicle-data-fetch`)

The ROVER ingestion + Data Hub are built and proven. Health gate: `npm run type-check` clean ·
`npm run test` (531) · `npm run lint` clean.

**Built + working:**
- **Skeleton index** — `RoverApprovalIndex`: **1,321** M+N vehicles (cars/vans/utes/trucks/buses),
  browsable + searchable at `/admin/catalogue/vehicles/data-hub`, **normalized** (base make/model +
  modifier + `isSecondStage`; 1,269 AUTO / 52 NEEDS_REVIEW). `577` second-stage rows.
- **Expand-on-select** — click a row's VTA → detail page; **Expand** triggers the n8n `rover-expand`
  webhook (VPN) → fetches the RVD → `/api/rover/ingest` → per-variant candidates + skeleton flips
  EXPANDED. Proven live (Ford Ranger VTA-060160 → 4 variants).
- **Per-field provenance spine** — `VariantSpecProvenance` (CONFIRMED/ESTIMATE/DISPUTED, source,
  asOf); written on promotion. **Coverage matrix** page per variant (Tier A/B).
- **Per-VTA detail page** — identity + per-variant ROVER figures + archived docs + Expand.
- Promotion (`promoteSpecCandidate`), ingest, amendment detection, the crawl (ready to activate).

**Current data counts (collection DB `travelling_buddy_revised`):** 89 PENDING ROVER candidates ·
**only 1 CATALOGUE variant** (TORINO) · 577 second-stage index rows · 52 NEEDS_REVIEW.

**Not done (the overnight targets):** second-stage rows are listed as if they were separate cars;
no GVM-upgrade data model / overlay; almost no base variants promoted; no state cap rules; no AI
gap-fill; the NEEDS_REVIEW tail; baseModel still carries trim noise ("Hilux AN2 SSM 4x4").

## 2. Guardrails (do NOT cross)

- **LOCAL only — NO live ROVER from this machine.** The sandbox egresses via Tim's home IP
  (memory `crawl-egress-vpn-only`). All overnight work runs against the **collection DB + the
  committed `docs/RVD/` corpus + code**. **Do NOT run expand/crawl or any
  `rover.infrastructure.gov.au` fetch from here** — n8n/VPN owns acquisition.
- **Rule 11 — physics stays gated.** Anything that changes a **compliance verdict** (a GVM upgrade
  altering GVM/GCM/axle/tow limits; state cap validation) is **Tim's sign-off**. Build the data
  model + apply-logic, but keep the verdict-affecting effect **behind a flag / advisory /
  diagnostic** until he ticks it. Never un-gate kerb-CoG / SSF.
- **No live AI.** No `ANTHROPIC_API_KEY` call. AI work is **scaffolding only**, gated off.
- **Gate green after every phase.** `npm run lint:fix` before the final gate (lint includes
  prettier). After any schema change: `DATABASE_URL=… npx prisma migrate dev --name …` **then
  `npx prisma generate`** (stale client → type-check fails).
- **Commit at the end; do not push/merge.**

## 3. Build plan (execute in order; gate green after each)

### Phase 0 — Promote base variants (the prerequisite)
A GVM upgrade attaches to a **base** `VehicleVariant`, but only 1 exists. So first materialise the
factory (non-second-stage) vehicles.
- A runner `src/jobs/rover-promote-base-local.ts`: for each **`isSecondStage = false`** ROVER index
  row that is EXPANDED, promote its PENDING candidates → CATALOGUE `VehicleVariant` (reuse
  `promoteSpecCandidate`; gate enforced; idempotent). Skip second-stage (Phase 3 handles those).
- For coverage, the executor may **expand more base vehicles first** — but expansion is the n8n/VPN
  path and **must not run from the sandbox**. So Phase 0 promotes whatever is already EXPANDED;
  bulk-expanding the catalogue is a separate n8n task for Tim. Note the count promoted.
- **Acceptance:** factory EXPANDED rows have CATALOGUE variants with provenance; gate green.

### Phase 1 — Second-stage sub-classification + hub filter  *(pragmatic #1a)*
- **Schema:** `RoverApprovalIndex.secondStageType` enum
  `NONE | GVM_UPGRADE | CONVERSION | MOTORHOME | OTHER` (+ index).
- **`src/lib/spec-fetch/rover/second-stage.ts`** (pure, tested) `classifySecondStage(row, baseFactoryCategory?)`:
  - **GVM_UPGRADE:** category bumped above the base model's factory category (NA→NB1/NB2), or a known
    GVM-upgrade brand (Ironman, Premcar, Lovells, Pedders, MRT, Roothy/“GVM”, etc.), or "GVM"/"upgrade"
    in the raw text. (SSM + bump is the strongest signal — see VTA-066264.)
  - **MOTORHOME:** motorhome / camper / RV / "explorer md" / body-builder keywords.
  - **CONVERSION:** tray / service body / 6x6 / 6x4 / crane / tipper / ambulance / tow-truck.
  - **OTHER:** second-stage but unclassified. **NONE:** not second-stage.
- Runner to classify the 577 rows; report the histogram.
- **Hub UI:** a **Type** column + a second-stage-type filter, and a **“base vehicles only”** toggle
  (hide everything except NONE) so the list reads as actual cars. Surface the type on the detail page.
- **Acceptance:** the 577 classify sensibly (spot-check Ironman→GVM_UPGRADE, motorhomes→MOTORHOME);
  filter works; tests green.

### Phase 2 — GVM-upgrade data model  *(design #2 — schema)*
- **`GvmUpgrade` model:** `{ id, baseVariantId (FK VehicleVariant) , modifierName, pathway
  (PRE_REGO_SECOND_STAGE | POST_REGO_SSM | STATE_ENGINEER), vtaNumber?, engineerRef?, gvmKg?, gcmKg?,
  frontAxleLimitKg?, rearAxleLimitKg?, maxTowingKg?, addedMassKg?, isPreRego, certifiedState
  (AustralianState?), status (CATALOGUE|COMMUNITY|PENDING), sourceUrl?, sourceVtaNumber?, createdAt }`.
  Shared CATALOGUE for kits; one row per approval. Index `[baseVariantId]`.
- **`Setup.appliedGvmUpgradeId`** (FK nullable) **+** custom-override fields for the engineer-cert /
  plate path: `customGvmUpgrade Json?` ( `{ gvmKg, gcmKg?, axle?, maxTowingKg?, addedMassKg,
  certifiedState, engineerRef }` ) — a setup uses **either** a catalogue kit **or** a custom override.
- Enum `GvmUpgradePathway`. Migration + generate.
- **Acceptance:** schema migrates; `Setup` carries the upgrade ref; gate green. No behaviour yet.

### Phase 3 — Promotion routing: GVM-upgrade → upgrade record, not a variant  *(pragmatic #1b)*
- Extend the promote path: when a candidate's index row is `secondStageType = GVM_UPGRADE`, **do NOT
  mint a standalone variant** — instead resolve the **base** variant (base make/model/year via the
  normalized fields) and create a **`GvmUpgrade`** attached to it (figures from the candidate: GVM,
  tow, axle if present; `addedMassKg` left null/estimated). Mark the candidate APPROVED + link.
- If the base variant doesn't exist yet → land the upgrade as **PENDING/unattached** with a clear
  "base vehicle not in catalogue" note (don't fabricate the base).
- Runner proving one GVM-upgrade candidate (e.g. an Ironman Hilux) → a `GvmUpgrade` on the base Hilux.
- **Acceptance:** a GVM-upgrade second-stage promotes to a `GvmUpgrade` row on the base variant, NOT a
  duplicate car; non-GVM second-stage (motorhome/conversion) still promote as their own variant (or
  are skipped per a documented rule); gate green.

### Phase 4 — Overlay application in physics  *(GATED / advisory — Rule 11)*
- **`src/modules/calculator/build-physics-input.ts`:** if `setup.appliedGvmUpgradeId` (or
  `customGvmUpgrade`), apply the overlay — **override** the limit set (GVM, and GCM/axle/tow **only if
  the upgrade states them**) and add `addedMassKg` (via the existing `offsets`/accessory-mass path).
  - **The GCM-doesn't-move trap:** apply GVM but leave GCM at factory unless the upgrade explicitly
    raises it — the headroom case the GCM enforcement already catches.
- **GATE:** behind `GVM_UPGRADE_ENABLED` (env) **and** rendered **advisory / "Est. — confirm your
  plate"** — the verdict-affecting limit change must NOT silently flip outcomes until Tim signs off.
- Unit tests: overlay raises GVM in the input; GCM-not-moved stays factory; mass delta applied.
- **Acceptance:** with the flag ON, the input carries the upgraded limits + mass; with it OFF,
  behaviour is unchanged; tests green. **Stays advisory.**

### Phase 5 — State cap rules  *(versioned RegulationSet — advisory)*
- Seed **Federal + QLD** caps as `RegulationSet` + `RegulationSetVersion` data: "lower of +X kg or
  +Y% of base GVM" (QLD: lower of +300 / +10%). Per-state (others as Tim provides). `effectiveDate` +
  `changeSummary` set; grandfathering falls out of the versioning.
- A pure validator `validateGvmUpgradeAgainstCap(baseGvm, deltaKg, state, regSet)` →
  `{ withinSpec, capKg, governedBy }`. On custom entry, sanity-check ("QLD: lower of +300/+10% →
  your +280 is within spec ✓") + flag implausible. **Interstate-recognition** warning when
  `user.homeState !== certifiedState`.
- **ADVISORY** until Tim ticks the caps (mark the RegulationSet entries unsigned). Tests.
- **Acceptance:** the QLD worked example (Tim's +280 governed by +10%) validates; interstate warning
  fires; advisory; tests green.

### Phase 6 — GVM-upgrade admin + "your kit" UI scaffolding
- **Admin:** manage `GvmUpgrade`s per base variant (list / create / edit); a review surface for
  promoted-from-ROVER upgrades.
- **Calculator/setup:** "Have a GVM upgrade?" → dropdown of CATALOGUE `GvmUpgrade`s **for this
  vehicle** / **"enter custom"** (the plate path; marked **estimated** until plate-confirmed). Wire
  `setup.appliedGvmUpgradeId` / `customGvmUpgrade`.
- Surface the **§6 disclaimer** near the upgrade entry + verdict.
- **Acceptance:** an admin can attach a kit to a base variant; a setup can select it; the verdict shows
  the advisory upgraded limits (flag-gated); gate green.

### Phase 7 — Docs + Rule-11 sign-off checklist
- Update `VEHICLE_DATA_HUB.md` / `VEHICLE_DATA_FETCH.md` to mark what's built; write a
  `GVM_UPGRADE_SIGNOFF.md` Rule-11 checklist for Tim (the items in §5 below).

## 4. Adjacent overnight-able work (optional — include what you want)

Independent of the GVM theme; each is local + gate-testable. Pick per appetite:
- **baseModel cleanup** — strip trim/drive/SSM noise ("Hilux AN2 SSM 4x4" → "Hilux"); improves grouping.
- **NEEDS_REVIEW curation (52)** — an admin "set base make/model manually" action + a hub queue view.
- **Promote-all base tool** — bulk-promote the EXPANDED factory candidates (feeds Phase 0/3).
- **AI Tier-A/B sweep — SCAFFOLDING ONLY (gated)** — the "Needs AI" queue, the grounded-Claude
  provider wiring, the trigger model (auto-on-new + manual + demand). **No live calls** (no key +
  Rule 11). See `VEHICLE_DATA_HUB.md` §6.
- **Client vehicle picker** — make→model→variant with skeletons + expand-on-select (VEHICLE_DATA_HUB §3.5).
- **Public confirmed-spec vehicle page + SEO** (decision 6).
- **Caravan Tier-B mirror** — frontal area + mass for the towing-fuel delta.

## 5. Rule-11 / decisions for Tim (the physics + caps that need sign-off)

1. **GVM upgrade alters the verdict** — confirm the overlay applies GVM (always), and GCM/axle/tow
   **only when the cert states them** (default = factory). Sign off un-gating `GVM_UPGRADE_ENABLED`.
2. **Per-state cap rules** — the actual numbers per state (Federal + QLD first); whether the app
   *validates* vs only records; interstate-recognition wording.
3. **`addedMassKg`** default when a cert doesn't state spring mass (the headroom-vs-mass split).
4. **Second-stage routing rule** — GVM_UPGRADE → overlay; do motorhomes/conversions become their own
   variants, or a different treatment?
5. **Disclaimer** wording (legal) near the upgrade + verdict.

## 6. Gotchas
- Prisma 7: `DATABASE_URL=…` inline for the CLI; **regenerate the client after a schema change**.
- Lint gate includes prettier — `npm run lint:fix` before the final gate.
- `trailingSlash: true` — API routes end in `/`.
- Standalone `src/jobs/*` run via `npx tsx`; `@/lib/db` builds the PrismaPg adapter.
- Only 1 CATALOGUE variant exists — Phase 0 must run before Phase 3 has bases to attach to.

## 7. How to kick off
1. `git status` clean on `feature/vehicle-data-fetch`. Gate green (`type-check && test && lint`).
2. Execute Phases 0→7 in order; gate after each; fix before moving on.
3. **Local + dev DB only. Never fetch ROVER from this machine. Keep physics gated.**
4. End: `npm run lint:fix`, gate green, **commit** (clear message). **Do not push/merge.**
5. Update the "where we are" + write the Rule-11 sign-off checklist.
