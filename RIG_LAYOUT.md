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

## Phase B — interactive drag-to-position ⬜ NEXT
- Drag accessories on the top-down (and side) to set precise X/Y; live balance
  update as you drag. Persist to `SetupAccessory.cogXMm/cogYMm` (fields exist).
- Snap-to-zone using the profile's positionable zones (to add to VehicleProfile).
- Touch-friendly (campsite use). "Fix it" nudge ("move X 180 mm right").
- Sized accessory footprints (render gear as real-dimension boxes) — needs an
  accessory width/length field (add to Accessory + submission).

## Phase C — community position pipeline ⬜ AFTER B
- "Contribute your layout" → submission → moderation → promote precise positions
  to canonical `AccessoryFitment.cogXMm/cogYMm`. (Submission + moderation flow
  already exists; this adds position capture + the promote step.)
- Aggregate community positions → improve template defaults; "most people mount
  this here" heat-map (social proof + better defaults).

## Also worth adding (fantastic-makers)
Shareable layout image (traffic), start-from-template layouts (seeds data),
weighbridge calibration cross-check (data quality + Phase 2 hook).

## Rollback tags
- `rollback/pre-rig-layout` — before the epic.
- `rollback/topdown-view` — after Phase A.

## Open data gaps (collect via the pipeline)
Track width + body width per *variant* (currently estimated per body type);
accessory footprint dimensions; lateral positions (the whole point of Phase B/C).
