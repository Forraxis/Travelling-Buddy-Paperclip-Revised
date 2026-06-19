# Overnight build — handover (run 1)

> **Self-contained handover for an autonomous session.** Read this, then `BACKLOG.md` (the full
> menu), `GVM_UPGRADE_OVERNIGHT_BUILD.md` (GVM detail), `VEHICLE_DATA_HUB.md` + `VEHICLE_DATA_FETCH.md`
> (§4–5 overlay/caps). Execute the **Phases** in order; **gate green after each**. Commit at the end;
> **do NOT push or merge.**

## Guardrails (do NOT cross)
- **LOCAL only — never fetch `rover.infrastructure.gov.au` from this machine** (sandbox = Tim's home
  IP; memory `crawl-egress-vpn-only`). Work against the collection DB + `docs/RVD/` corpus + code.
- **Rule 11 — physics stays gated.** Any change to a compliance **verdict** (GVM upgrade altering
  limits; cap validation) is behind a flag / advisory / diagnostic until Tim signs off. Never touch
  kerb-CoG / SSF.
- **No live AI** (no `ANTHROPIC_API_KEY` call) — scaffolding only, gated off.
- After any schema change: `DATABASE_URL=… npx prisma migrate dev --name …` **then `npx prisma
  generate`**. `npm run lint:fix` before the final gate. Gate = `type-check && test && lint`.
- `DATABASE_URL=postgresql://travellingbuddy:<pw>@172.16.45.240:5432/travelling_buddy_revised` (from
  `.env.local`).

## File ownership (so phases don't collide)
Each hot file is edited by exactly ONE phase: `schema.prisma`→**F** · `normalize.ts`→**P3** ·
`promote-candidate.ts`→**P4** · `build-physics-input.ts`→**P5** · `data-hub/page.tsx`→**P7**.
Everything else is new files. Run **F first (sequential)**; then the waves below.

---

## Phase F — Foundation (schema; SEQUENTIAL, must finish first)
One migration with ALL new schema for this run:
- `RoverApprovalIndex.secondStageType` enum `NONE|GVM_UPGRADE|CONVERSION|MOTORHOME|OTHER` (default NONE) + `@@index`.
- `GvmUpgrade` model: `{ id, baseVariantId (FK VehicleVariant, onDelete Cascade), modifierName,
  pathway (enum GvmUpgradePathway: PRE_REGO_SECOND_STAGE|POST_REGO_SSM|STATE_ENGINEER), vtaNumber?,
  engineerRef?, gvmKg?, gcmKg?, frontAxleLimitKg?, rearAxleLimitKg?, maxTowingKg?, addedMassKg?,
  isPreRego Boolean @default(false), certifiedState (AustralianState?), status (VehicleVariantStatus
  @default(CATALOGUE)), sourceUrl?, sourceVtaNumber?, createdAt, updatedAt }` + `@@index([baseVariantId])`
  + back-relation `gvmUpgrades GvmUpgrade[]` on `VehicleVariant`.
- `Setup.appliedGvmUpgradeId String?` (FK GvmUpgrade, onDelete SetNull) + `customGvmUpgrade Json?` +
  back-relation on `GvmUpgrade`.
- migrate (`add_gvm_upgrades_and_second_stage`) + generate + gate. **Acceptance:** schema in sync, gate green.

## Wave 1 (after F) — backend, disjoint files
**P1 — Promote base variants** `src/jobs/rover-promote-base-local.ts`: for each `isSecondStage=false`
EXPANDED index row, promote its PENDING ROVER candidates → CATALOGUE variants (reuse
`promoteSpecCandidate`; idempotent). Run it; report count. *(No new schema.)*

**P2 — Second-stage classifier** `src/lib/spec-fetch/rover/second-stage.ts` (pure, tested
`classifySecondStage`) + `src/jobs/rover-classify-second-stage-local.ts` (writes `secondStageType`).
GVM_UPGRADE = category bumped above the base's factory category (NA→NB1/NB2) OR a known GVM brand
(Ironman, Premcar, Lovells, Pedders, MRT…) OR "GVM"/"upgrade" in the raw; MOTORHOME / CONVERSION by
keywords; else OTHER; NONE if not second-stage. Run it; report histogram.

**P3 — baseModel cleanup** edit `src/lib/spec-fetch/rover/normalize.ts` (+test): strip trim/drive/SSM
noise from baseModel ("Hilux AN2 SSM 4x4" → "Hilux"); keep platform code if useful. A runner re-applies.

## Wave 2 (after Wave 1) — GVM core + physics (gated)
**P4 — GVM promotion routing** edit `src/lib/spec-fetch/promote-candidate.ts` (+ a small
`src/lib/spec-fetch/rover/gvm-upgrade.ts`): when a candidate's index `secondStageType=GVM_UPGRADE`,
resolve the base variant and create a `GvmUpgrade` on it (figures from the candidate) instead of a
standalone variant; APPROVE + link. If no base variant → land PENDING/unattached with a note. Runner proof.

**P5 — Physics overlay + "Est." narrowing** edit `src/modules/calculator/build-physics-input.ts`
(+test): (a) if `setup.appliedGvmUpgradeId`/`customGvmUpgrade`, override limits (GVM always; GCM/axle/
tow only if the upgrade states them) + add `addedMassKg` via the existing offsets path — **behind
`process.env.GVM_UPGRADE_ENABLED` and rendered advisory**; (b) connect `VariantSpecProvenance` so the
"Est." flag narrows to the specific ESTIMATE fields (the open TODO). Tests: overlay raises GVM;
GCM-not-moved stays factory; mass delta; flag OFF = unchanged.

**P6 — State cap rules** new `src/lib/regulations/gvm-caps.ts` (pure validator
`validateGvmUpgradeAgainstCap(baseGvm, deltaKg, state, capData)`) + `src/jobs/seed-gvm-caps-local.ts`
(seed Federal + QLD "lower of +X / +Y%" as `RegulationSet`/`Version`, **advisory/unsigned**). Tests
incl. Tim's QLD +280 governed-by-+10% example + interstate-recognition warning.

## Wave 3 (after Wave 2) — UI (disjoint routes/components)
**P7 — Hub UI** edit `data-hub/page.tsx` + new components: a **Type** column + second-stage-type
filter + a **"base vehicles only"** toggle; first-class **Needs-expand / Needs-AI / Needs-review**
saved-filter chips. (Owns the hub page.)

**P8 — GVM admin + "your kit"** new admin route to manage `GvmUpgrade`s per base variant (list/create/
edit) + a calculator/setup **"Have a GVM upgrade? pick your kit / enter custom"** component wiring
`setup.appliedGvmUpgradeId`/`customGvmUpgrade`; surface the §6 disclaimer. (New files.)

**P9 — Public confirmed-spec page** new public route: a model page + variant table showing **CONFIRMED-
only** provenance, provenance-stamped, canonicalised; disclaimer near figures. (New files.)

**P10 — NEEDS_REVIEW curation** new admin server action + component to set baseMake/baseModel manually
for the 52 NEEDS_REVIEW rows (set `normalizationStatus=MANUAL`), linked from the hub. (New files.)

## Phase Z — Integration + gate + commit
Run the full gate; fix any integration (wire new admin pages into `navigation.ts`; link P8/P9/P10
where sensible). `npm run lint:fix`; gate green. **Commit** with a clear message. **Do NOT push.**
Update this doc's status + write `GVM_UPGRADE_SIGNOFF.md` (the Rule-11 checklist from
`GVM_UPGRADE_OVERNIGHT_BUILD.md §5`).

---

## Deferred to follow-on runs (documented, NOT this run)
From `BACKLOG.md`: grounded-Claude provider + live AI sweep (**needs key + Rule 11**); cross-source
agreement; plate-consensus/plate-prompt; client vehicle picker (L); regulation source registry +
watchers (F); the **fuel app** (G — consumption model, trip/stop planning, fuel-price, EV, real-world
logs); physics sign-offs (H); PDF report; bulk-expand (**n8n/VPN**); model-year mapping; amendment
re-review surface; E2E suite. Pick these into run 2+.
