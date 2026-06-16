# Rig Layout Epic — lateral balance + interactive positioning + community data

Branch `feature/rig-layout` (off `overnight/loose-ends`). The big idea: the
**top-down "position your gear" tool *is* the community data pipeline**. When a
user drags their gear onto a top-down of their van, they (a) get left/right
balance + tyre-share checks, (b) get a more accurate result, and (c) generate the
exact X/Y position data that is the moat — which, once moderated, becomes
canonical. Engagement → data → accuracy → trust → shareable → traffic → revenue.

## Decisions (agreed)
- **Distribution + balance AND a tyre-share check** — per-side tyre limit = axle
  GAWR ÷ 2 (OE-tyre backed; no extra data). Assumes OE-equivalent tyres.
- **Drag-and-drop** positioning (Phase B).
- **Multi-vehicle via a `VehicleProfile` registry** — silhouette + footprint +
  (later) positionable zones per body type. Physics is body-agnostic; only the
  visual/zones change. Adding a vehicle type = one profile entry.
- Lateral physics is **advisory** (doesn't flip the legal verdict — Y is often a
  template default until positioned).

## Phase A — lateral physics + top-down view ✅ DONE
- `feat(physics)`: 4-corner lateral split (`VehicleLateral`: corners, left/right,
  imbalance %, per-tyre over-share). `AccessoryLoad.cogYMm`, `VehicleInput.trackWidthMm`,
  `resolveVehicleLateralMm`. 55 physics tests. ⚠️ advisory but physics — worth a glance.
- `feat(rig-layout)`: `TopDownSchematic` (plan view: 4 corner loads, dots at X/Y,
  left/right balance bar) + `SchematicViewer` Side|Top toggle (desktop + mobile);
  `vehicle-profiles.ts` registry (track + body width per body kind); physics uses
  the profile's track. Schematic model carries lateral Y + widths.

## Phase B — interactive drag-to-position ✅ DONE
- Drag accessories on the top-down to set precise X/Y; **live balance updates as
  you drag** (verified: verdict flips Balanced → "38 kg left-heavy"). Pointer
  events invert the px→mm map, clamped to the body. `SET_ACCESSORY_POSITION`
  reducer + `setAccessoryPosition` context handler → physics + balance recompute.
- **Persistence, end to end**: URL accessory param now encodes `id~cogX~cogY`
  (RFC-3986 `~`), so a refresh or shared link keeps positions; new
  `SetupAccessory.cogXMmOverride/cogYMmOverride` columns (migration) written on
  POST/PATCH and read back in the shared-setup view. Anonymous setups already
  serialise full state, so they persist for free.
- 3 url-params round-trip tests. Touch: `touch-none select-none` svg.

### Phase B niceties ✅ DONE
- **Sized footprints** — accessories render as real-dimension boxes (length along
  X, width along Y), not dots. Pure `accessoryFootprint(mount, kg)` helper
  (per-mount base shape, mild mass scaling, capped); 5 unit tests. A future
  catalogue footprint field would override the defaults.
- **Snap-to-zone** — `VehicleProfile.zones` (rear→front bands per body kind:
  ute/wagon/suv/van) resolved to global mm in the model and drawn as labelled
  bands. Drags snap to a 25 mm grid and magnet to the nearest zone centre when
  within 90 mm; the band under a dragged footprint highlights.
- **"Fix it" nudge** — auto-balance button computes the lateral move that
  neutralises the imbalance (`Δy = −imbalanceKg·track / 2w` on the heaviest
  accessory, clamped) and applies it in one tap. Verified: 25 kg left-heavy →
  "move Chassis Front 475 mm right" → Balanced.

## Phase C — community position pipeline ✅ DONE
- `FitmentPositionSubmission` model (migration) — a focused pipeline separate
  from the heavy accessory-submission flow. Auth-optional contributions land
  PENDING.
- **Contribute**: `ContributeLayoutButton` in the top-down view (shows when ≥1
  accessory is positioned) → `POST /api/fitments/positions` (validates fitments
  belong to the variant; rejects bogus IDs 422).
- **Aggregate**: `GET /api/fitments/positions?vehicleVariantId=` returns the
  **median** of APPROVED contributions (outlier-robust) + the current canonical,
  per fitment. Pure `aggregatePositions`/`median` in `src/lib/fitment-positions.ts`
  (8 unit tests).
- **Moderate → promote**: `/admin/moderation/positions` queue grouped by
  fitment+variant; "Promote consensus" writes the median onto
  `AccessoryFitment.cogXMm/cogYMm` (confidence COMMUNITY, source USER_SUBMITTED),
  approves the group, audits. Nav entry added.
- **Consume (loop closed)**: accessory search / brand-items / `?a=` resolve now
  return `fitment.cogXMm/cogYMm`; adding an accessory seeds the drag start from
  the canonical (community/OEM) placement — so a promoted consensus shows up for
  the next user. Verified end-to-end (contribute → promote → canonical 3600→2463
  → aggregate API → seeded on add).

## Phase D — Standalone layout editor ✅ BUILT (items 1–6)

Implemented: (1) caravan position plumbing → tow-ball cross-over; (2) CaravanLateral
van L/R physics; (3) `/layout/[vehicle]` route + coupled-rig canvas (drag both
sides, live tow-ball, hitched/unhitched compare strip, mobile nudge, SEO content);
(4) placementScope enum + mounting-location backfill; (5) custom-load creator +
brand-submission fork (reuses AccessorySubmission); (6) tintable category icon set
+ admin top-down-image override (`/admin/catalogue/top-down-images`). Saves +
contributes via the Phase B/C pipeline.

**Setup/version parity (2026-06-16):** `/layout/[vehicle]?setupId=` now hydrates a
saved setup (custom loads **and** the owner's weighbridge calibration via the
shared provider setup-loader); save PATCHes the existing setup instead of forking,
and promotes a new id into the URL after a first save; `SetupVersionsPanel` is
mounted so P2 versions/revert/compare work in the editor too. An "Open in layout
planner" ("Layout") link was added to the setups dashboard. The per-model P3
correction already applied here (shared `buildPhysicsInput`), so the editor now has
full calibration + version parity with the calculator.

### Design notes (as built)
The dedicated "position your gear" tool. Decisions below are signed off by Tim
(the user is the domain authority — Rule 11 sign-off is his).

### Shape & routing
- A **real route**, not a modal: `/layout/[vehicle-slug]` (+ a setup token for a
  saved rig). Crawlable/indexable per vehicle (SEO: "HiLux load layout planner"),
  ad/affiliate surface, shareable (saved layout = URL + OG image of the top-down).
  Modal feel is explicitly NOT required — a separate page is fine.
- Same data lives on the **setup**; the calculator shows the overall verdict, the
  layout page is the editor. Edit → save → reflected on the calc page. The
  positions/loads belong to **both** pages.

### One coupled-rig canvas (replaces "3 top-downs")
- A single top-down of the **whole coupled rig** — caravan (left) + vehicle
  (right) joined at the tow-ball. Drag accessories on **either** side.
- The **tow-ball is the live shared readout** between them. Dragging caravan gear
  fore/aft of the van axle changes TBM, which flows to the vehicle's rear axle +
  GCM. (Tim's example: a drawbar toolbox moved back a foot drops TBM — already
  works in the engine.)
- A **hitched/unhitched "compare strip"** under the canvas: two rows of axle bars
  (front / rear / TBM) showing solo vs towing, so the user sees that coupling the
  van lifts weight off the front axle onto the rear. "Solo" = same calc with TBM
  zeroed — free to compute.
- This unifies the three views into one editor + one compare strip.

### Drag axes — full X *and* Y on BOTH sides
- Vehicle gear: X (longitudinal) + Y (lateral) — done in Phase B.
- Caravan gear: **also full X/Y**. X moves TBM (engine already honours
  `acc.cogXMm` → `momentSum += weight*(axleX − posX)`); **Y needs a new caravan
  lateral module** (van left/right wheel-load split) — currently only the vehicle
  has `VehicleLateral`. Advisory like the vehicle side; **Tim to sign off the van
  L/R model** (2-side split summed across axles; works for single/dual/triple).

### Engine/state gaps to close (not new physics except van lateral)
- Thread `cogXMm/cogYMm` through **caravan**-accessory state: `AccessorySelection`
  already has the fields, but `use-physics-result` doesn't map them for caravan
  gear, and `SET_ACCESSORY_POSITION` only touches `state.accessories`. Extend to
  `caravanAccessories`.
- Make caravan dots draggable in the (new) coupled canvas.
- Add `CaravanLateral` to the physics result + `computeCaravanAxles` (NEW — Tim
  sign-off).

### Accessories: custom vs brand, and placement scope
- **Fork at creation** (reuses the existing submission flow):
  - **Personal/custom** load → `isShared:false` today = **DRAFT**, private to the
    user, no review, place anywhere. Backed by the existing **`SetupCustomLoad`**
    model (label, weightKg, mountingLocation, cogX, cogY) — extend with optional
    footprint (length/width) + placement scope.
  - **Named brand** product → `isShared:true` = **PENDING** → moderation, or
    **auto-accept by trust tier** (the `NEW/BASIC/TRUSTED/EXPERT` system +
    `promoteUserTrustTier` exists; the accessories submit route currently always
    sets PENDING, so auto-accept is the small extension to wire). Becomes a
    catalogue `Accessory` + `AccessoryFitment`.
- **Placement scope** — new enum on the accessory/fitment: `VEHICLE | CARAVAN |
  BOTH`. Controls where an item can be dropped/dragged. Catalogue items are
  scoped (bull bar = VEHICLE, van toolbox = CARAVAN, fridge = BOTH); personal
  custom loads default BOTH (anywhere).

### Visuals: icons now, admin images later
- Start with a tintable **top-down category icon set** (drawer, fridge, water
  tank, jerry can, spare, rooftop tent, toolbox, bull bar…), auto-scaled to the
  footprint mm (the mm→px scale already exists).
- Later: an **admin screen** to assign a real **top-down image per
  accessory/fitment** (optional `topDownImageUrl`, uploaded to R2 — already
  wired) that overrides the icon. Icon is the fallback.

### Monetization / SEO
- Highest purchase-intent surface in the app — accessory search results are
  affiliate links; "complete this build" suggestions; paid placement via the
  existing **sponsorship** model. Per-vehicle indexable page + shareable layout
  images = the traffic engine.

## Sway indicator — PARKED until the layout editor lands (design noted)
Agreed with Tim: build the **real "sway % vs speed" curve**, front-page home, but:
- **The disclaimer is a gate, not fine print.** First view requires an explicit
  "I understand this is indicative only" acknowledgement + a persistent caption on
  the graph. Plain wording: *illustrative model, not a measurement, not
  engineering advice, do not rely on it for safety decisions.* (Tim: a strong
  legal disclaimer is a MUST.)
- **Tim approves the model + constants** before ship. Honest basis: a
  critical-speed-style curve driven by **tow-ball ratio (TBM % of ATM)** + a
  **load-spread / yaw-inertia proxy** (heavy gear at the van's extremities → worse
  sway). The layout editor already produces both inputs, so sway reacts live to
  dragging — which is why it waits for the editor.

## Phase E — Weighbridge calibration + setup versioning (PLANNED, agreed with Tim)

The trust + accuracy unlock, and a serious data moat. The model is mediocre at
**absolutes** (exact kerb CoG, tools/dirt aboard) but excellent at **deltas**
(move a known weight a known distance). So: **weigh once → anchor to reality →
let the model predict only the changes.** `PHYSICS_NOTES.md` already flags that
the vehicle side has no published axle weights to calibrate against — this is
that anchor. Builds on the existing `CalibrationOverrides` hook
(`caravanTareKg` today) and `SetupCustomLoad`.

### Calibration math (Tim signs off)
1. Snapshot the config **C₀** (all loads + positions) and the **measured** weights
   **M₀** at calibration time.
2. Compute the model prediction **P₀** for C₀. Residual **R = M₀ − P₀** = the
   unexplained mass (tools, water, model bias).
3. For any new config **C₁**: calibrated output = **M₀ + (P(C₁) − P(C₀))** —
   measured baseline plus the *modelled change*. Known weights moving known
   distances; the engine is accurate there.

### Decisions (agreed with Tim)
1. **Residual handling — BOTH.** Default to a **positioned "unaccounted load"**:
   turn R into a draggable load ("we found 118 kg we can't account for — drag it
   to where it sits, e.g. tools in the tub"), so it's fully modelled and moves
   correctly. Reuses **`SetupCustomLoad`** (a special "unaccounted" flavour).
   Fall back to a **static per-axle/corner offset** when the user doesn't know
   where the mass is. Offer both; default to the positioned load with a
   best-guess starting spot.
2. **Input levels — ALL, progressive.** Fidelity matches what the weighbridge
   ticket shows: **total** → calibrates GVM/total; **per-axle** (steer/drive/
   trailer) → front/rear (longitudinal); **per-wheel** (corner scales) → both
   longitudinal + lateral; **tow-ball** (ball scale) → the coupling. We already
   compute all targets: vehicle 4 corners (`VehicleLateral.corners`), 2 axles,
   tow-ball (`towBallMassKg`), van per-axle (`CaravanAxleResult`), van L/R
   (`CaravanLateral`). Entry panel asks "what did your ticket show?" and
   calibrates against whatever they have. Be honest about what each level unlocks.
3. **Versioning — full named snapshots with dates + notes.** New `SetupVersion`
   model: a JSON snapshot of the full calculator state + computed results +
   optional weighbridge measurement, with a label, note, and createdAt. The
   "**as weighed**" version is flagged as the calibration baseline. **Revert** =
   load a snapshot back into state; **compare** = diff two versions side-by-side
   (great UX + shareable). Builds on existing `Setup` + duplicate + share tokens.
4. **Contribute calibration data — opt-in, ON by default.** Measured-vs-calculated
   pairs (anonymised) feed a per-model regression that **improves the base CoG
   estimates for everyone** ("2018 HiLux real kerb CoG sits ~4% further back").
   Ties straight into the Phase C community pipeline; the per-model correction
   lands on the catalogue (or a calibration table the engine reads via
   `CalibrationOverrides`). The accuracy flywheel + the moat.

### Phasing (each independently shippable)
- **P1** — weighbridge-entry panel (all input levels) + delta-calibrated output on
  a single setup; residual as positioned unaccounted-load (+ static-offset
  fallback). Calibration math + residual attribution = Tim sign-off.
- **P2** — `SetupVersion` snapshots: save named/dated/noted versions, revert,
  compare two side-by-side.
- **P3** — contribute calibration (opt-in default-on) → per-model base-estimate
  improvement regression; surfaced via `CalibrationOverrides`. **BUILT END-TO-END
  (capture + math + moderation + live wiring):**
  - Schema `CalibrationContribution` / `VehicleCalibrationCorrection`;
    rate-limited anon `POST /api/calibrations/contribute` (recomputes P₀
    server-side, "store raw"); opt-in share panel in the calibration result view.
  - `calibration-contribution.ts` derivation: bareness-weighted robust weighted-
    median, N≥3 gate (counts **distinct contributors** via fingerprint collapse),
    sane-ratio + CoG-band guards (27 unit tests).
  - `/admin/moderation/calibrations` queue (per-variant aggregate + drilldown,
    Publish/Reject, CoG sign-off checkbox, **"Currently live" banner + Unpublish**).
  - **Live wiring DONE:** `getVariantById` includes `calibrationCorrection` →
    `buildPhysicsInput` folds it via `mergeModelCorrection`, **live mode only**,
    **only when the user hasn't weighed their own rig**, and **never in baseline**
    (so contributions can't feed back on their own P₀). kerb-MASS auto-applies
    once published past the gate; kerb-CoG stays gated behind `cogApplied`.
  - Math written up for Rule-11 in **CALIBRATION_SIGNOFF.md §9** (incl. §9.6 impl
    guards + known limitations). **Awaiting Tim's §9.5 red pen** — CoG is gated
    by default in code; only un-gate per-variant via the moderator checkbox.
  - **Moat-hardening DONE (2026-06-16):** per-contributor dedup
    (`duplicateFingerprint` = `user:<id>` or content hash; gate counts distinct
    contributors; idempotent resubmit); admin un-publish/revert action +
    Unpublish button; queue surfaces the currently-live correction and
    published-only variants. See CALIBRATION_SIGNOFF.md §9.6 ("Resolved").
  - **Known limitations (still deferred):** moderation is all-or-nothing per
    variant (no per-row reject); anon dedup is content-based, not true identity.
    See CALIBRATION_SIGNOFF.md §9.6.

### Trust / legal
Calibrating to a weighbridge ticket *raises* credibility ("calibrated to your
figures") while staying a planning tool, not certification — disclaimer stays.

### New schema/fields Phase E introduces (for planning)
- `WeighbridgeMeasurement` (or fields on `SetupVersion`): granularity
  (TOTAL/AXLE/CORNER/TOWBALL) + the measured values + date.
- `SetupVersion`: setupId, label, note, createdAt, `stateSnapshot` (Json),
  `resultSnapshot` (Json), `isWeighedBaseline` (bool), optional measurement.
- `SetupCustomLoad`: an "unaccounted" flag/kind (residual load).
- `CalibrationOverrides`: extend beyond `caravanTareKg` to carry the measured
  baseline + per-axle/corner residuals (and, P3, per-model corrections).

## Also worth adding (fantastic-makers)
Shareable layout image (traffic), start-from-template layouts (seeds data).

## Rollback tags
- `rollback/pre-rig-layout` — before the epic.
- `rollback/topdown-view` — after Phase A.

## Open data gaps (collect via the pipeline)
Track width + body width per *variant* (currently estimated per body type);
accessory footprint dimensions; lateral positions (the whole point of Phase B/C).

## New schema/fields Phase D introduces (for planning)
- `Accessory`/`AccessoryFitment`: `placementScope` enum (`VEHICLE|CARAVAN|BOTH`),
  optional `topDownImageUrl`, optional footprint `lengthMm`/`widthMm`.
- `SetupCustomLoad`: optional footprint + `placementScope` (default BOTH).
- Physics result: `CaravanLateral` (van L/R) — NEW, Tim sign-off.
- Auto-accept-by-trust-tier on the accessory submit route (infra exists).
