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

## Also worth adding (fantastic-makers)
Shareable layout image (traffic), start-from-template layouts (seeds data),
weighbridge calibration cross-check (data quality + Phase 2 hook).

## Rollback tags
- `rollback/pre-rig-layout` — before the epic.
- `rollback/topdown-view` — after Phase A.

## Open data gaps (collect via the pipeline)
Track width + body width per *variant* (currently estimated per body type);
accessory footprint dimensions; lateral positions (the whole point of Phase B/C).
