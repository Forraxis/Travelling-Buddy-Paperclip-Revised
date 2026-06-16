# Vertical CoG height + static stability — physics sign-off (Rule 11)

**Status: BUILT, ADVISORY-ONLY. Assumptions PROVISIONALLY ACCEPTED by Tim
(2026-06-16) as the working default — to be VALIDATED and revisited before
go-live (see §6).** The metric is computed and shown, clearly labelled *Advisory*,
and **never contributes to the pass/fail verdict**. It stays advisory until the
pre-launch validation below is done — same gate discipline as the P3 CoG work in
`CALIBRATION_SIGNOFF.md §9`.

> ⛔ **PRE-LAUNCH GATE:** do not promote this metric from "advisory" to a
> verdict-affecting / headline figure until §6 is validated and ticked. This is
> on the launch checklist ([[next-steps-pre-launch-checklist]]).

Code: `src/lib/physics/position-map.ts` (`resolveVehicleHeightMm`),
`src/lib/physics/engine.ts` (height constants + `computeVehicleAxles` stability
block), `VehicleStability` in `types.ts`, UI in `RightColumn.tsx` (`StabilityCard`).
Unit tests in `engine.test.ts` ("Stability").

## 1. What it computes
A third axis — **vertical CoG height** — added to the existing longitudinal (x)
and lateral (y) model. Height has **no effect on axle loads** (proven by a unit
test: same x/y, different z → identical front/rear and identical verdict). It
drives one new, advisory number:

- **Combined CoG height** `H = Σ(wᵢ · zᵢ) / Σwᵢ` over every vehicle load (kerb,
  fuel, passengers, cargo, tow-ball download, accessories).
- **Static Stability Factor** `SSF = (trackWidth / 2) / H` — the classic rigid-body
  rollover proxy (≈ the lateral g at which the vehicle tips). Higher = safer.

## 2. Height assumptions (mm above ground) — ← ruling needed
Base loads (`engine.ts`):
| Load | Height | Rationale |
|---|---|---|
| Kerb (base vehicle) | **700** | typical 4WD/ute kerb CoG height |
| Fuel | 350 | tank below the floor |
| Passengers | 750 | seated occupant CoG |
| Cargo | 700 | loose gear in tub/boot |
| Tow-ball download | 450 | acts at hitch height (low, rearward → stabilising) |

Accessories default by mounting location (`resolveVehicleHeightMm`), e.g. roof
~1950, snorkel 1700, windscreen/A-pillar 1500, canopy body 1300, bonnet 1100,
cabin/tray/tub 950, fenders/arches 850, bull bar 650, chassis 600, rear bar/hitch
500, underbody 350. A user-supplied `cogZMm` overrides the default.

← Are the base-load heights and the per-mounting table acceptable? The **kerb CoG
height (700 mm)** is the single most influential constant — it should arguably
vary by body type (a 79-Series sits higher than a dual-cab) or come from a real
measurement. Flat constant for now.

## 3. SSF thresholds (advisory bands) — ← ruling needed
`ok ≥ 1.05 · warn ≥ 0.95 · else fail`. For reference, NHTSA SSF: passenger cars
~1.3–1.5, SUVs/4WDs ~1.0–1.2, top-heavy < 1.0. ← Are these the right cut-points
for a loaded touring rig, and is "fail" the right word for an advisory metric
(vs "caution")?

## 4. Scope / limitations (deliberate)
- **Vehicle only.** No combined-rig or caravan rollover (articulated dynamics,
  sway) — that's a much larger model. The SSF is the *tow vehicle's*, including
  the tow-ball download at hitch height.
- **Static, rigid-body.** No suspension roll, tyre compliance, or dynamic load
  transfer. SSF is a first-order indicator, not a certification figure.
- **No `cogZMm` editing UI yet.** Height comes from the mounting location; the
  override field is plumbed but not exposed (the side view shows placement by
  mounting location). A draggable vertical axis is a follow-up.

## 5. How it reaches the user
`VehicleResult.stability` → a "Stability" card on the calculator (CoG height in m,
SSF, status dot) badged **Advisory**, with the caveat that it doesn't change the
verdict. `stability.provisional` is `true`; flip messaging when signed off.

## 6. Sign-off checklist

**Decision (Tim, 2026-06-16):** use these assumptions as the working default for
now; **validate and revisit before going live.** So the boxes below are the
*pre-launch validation* list, not a final blessing — the metric stays advisory
until they're confirmed.

- [ ] §1 SSF = halfTrack / combined-CoG-height is the right rollover proxy.
- [ ] §2 base-load heights (esp. kerb = 700 mm) are acceptable / or specify a better source.
- [ ] §2 per-mounting-location height table.
- [ ] §3 SSF bands (1.05 / 0.95) + "fail" wording.
- [ ] §4 vehicle-only, static scope is acceptable for v1.
- [ ] §5 keep it advisory (no verdict impact) until the above are blessed.

Until §6 is ticked, treat the SSF/CoG-height output as **diagnostic only**.
