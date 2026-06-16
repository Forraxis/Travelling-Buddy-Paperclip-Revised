# Weighbridge Calibration — Math & Residual-Attribution Sign-off Sheet

**For:** Tim (Rule-11 physics sign-off authority)
**Re:** Phase E / P1 — weighbridge-entry + delta-calibrated output
**Status:** ⚠ AWAITING SIGN-OFF — no calibration code ships until you red-pen this.

This is the math you need to approve before P1. It is deliberately small: one
principle, one master formula, and a single attribution algorithm that unifies
the "BOTH" decision (positioned load **and** static offset) you already made.
The worked example at the end uses real numbers so you can check it by hand.

---

## 1. The principle (restating what we agreed)

The engine is **mediocre at absolutes** (exact kerb CoG, dirt/tools aboard,
real tyre pressures) but **excellent at deltas** (move a known mass a known
distance — that's just lever arithmetic, and `scripts/physics-harden.ts` shows
the delta logic is sound). So:

> **Weigh once → anchor to the measured ticket → let the model predict only the
> *changes* from that anchor.**

We never ask the model for an absolute it's bad at. We ask it for a *difference*
between two configs and add that difference to a number we actually measured.

---

## 2. Definitions

| Symbol | Meaning |
|---|---|
| **C₀** | The config **as weighed** — every load, position, fill %, passengers, fuel, water at calibration time. |
| **M₀** | The **measured** weighbridge ticket for C₀ (whatever fidelity it has — see §4). |
| **P(C)** | The model's raw prediction for config C — a *vector* of metrics: total / front axle / rear axle / tow-ball / per-corner / caravan GTM, etc. |
| **P₀** | `P(C₀)` — the model's prediction of the weighed config. |
| **R** | The **residual** `M₀ − P₀`, per metric. The mass the model couldn't see (tools, water in lines, dirt) plus model bias. |
| **C₁** | Any later config the user explores (added a drawer, moved the toolbox, filled the tank). |

All vehicle longitudinal positions are **mm from the rear axle, + forward**
(engine convention, `position-map.ts`). Lateral **y is mm from centreline, +
right**. Caravan longitudinal is **mm from coupling, + rearward**, axle at
`couplingToAxleMm`.

---

## 3. The master formula

For any later config **C₁**, the **calibrated** output is:

```
calibrated(C₁) = M₀ + ( P(C₁) − P(C₀) )
                 └─┬─┘   └──────┬──────┘
            measured truth   modelled change (the part we trust)
```

Two properties to confirm:

1. **Self-consistency at the anchor:** at `C₁ = C₀` the bracket is zero, so
   `calibrated(C₀) = M₀`. The calibrated rig reproduces your ticket exactly. ✔
2. **Only deltas are modelled:** the prediction `P` is never used as an
   absolute — only `P(C₁) − P(C₀)` ever reaches the output. ✔

The two residual-handling modes you chose ("BOTH") are just **two ways of
realising this same formula** — they differ only in *how `P(C₁) − P(C₀)`
behaves as the rig geometry changes*:

### Mode A — positioned "unaccounted load" (default)
Turn the residual into a real load `(m_R, x_R, y_R)` and **add it to the config**.
Then there is no separate correction term at all — you just run the normal engine
on `C + residual load`. Because the load is part of the config, when you move
*other* gear the residual stays put (tools in the tub don't migrate) and the axle
split updates correctly around it. This is the physically honest default.

The clever bit: a single point load has **3 degrees of freedom** (mass, x, y), so
from the ticket we *solve* those three so the engine reproduces the measured
total, front/rear split, and left/right split simultaneously (§4). After that,
`calibrated(C₀) = M₀` falls out for free — Mode A satisfies the master formula by
construction.

### Mode B — static per-metric offset (fallback / "don't know where it is")
Keep the residual as a constant added to each metric:

```
calibrated_metric(C₁) = P_metric(C₁) + (M₀_metric − P₀_metric)
```

Simpler, always works, but the offset is **frozen** — it doesn't re-split when
you change the wheelbase-relevant geometry. Correct when the user genuinely can't
say where the unaccounted mass sits.

**They agree exactly at C₀; they diverge at C₁** only in how the residual's
*axle split* responds to geometry changes. Mode A is the default; Mode B is the
fallback and the mop-up (see §5).

---

## 4. Residual attribution by ticket fidelity (progressive)

The ticket tells us different things at different fidelities. We fit the
positioned load to whatever the ticket constrains, and **honestly state what each
level unlocks**.

### 4.1 TOTAL only (most common — a single GVM figure)
```
m_R = M₀_total − P₀_total
```
Place `m_R` at a **best-guess** longitudinal spot (cargo/tub zone, `y_R = 0`),
draggable. Reproduces the **total** exactly; front/rear split is the model's
guess. Honest copy: *"We found 120 kg we can't account for — drag it to where it
sits (tools in the tub? water?) so we can split it correctly."*

### 4.2 PER-AXLE (steer / drive, i.e. front + rear)
We now have two numbers, so solve **both mass and longitudinal position**:
```
ΔF = M₀_front − P₀_front          (front-axle residual)
ΔR = M₀_rear  − P₀_rear           (rear-axle residual)
m_R = ΔF + ΔR                     (= M₀_total − P₀_total, consistency check)

x_R = ΔF · wheelbase / m_R        (position, mm forward of rear axle)
```
Derivation: a load at `x` from the rear axle puts `m·x/wheelbase` on the front.
Set that equal to `ΔF` and solve for `x`. Now the engine reproduces **total +
front + rear** exactly with one positioned load. (`y_R = 0`.)

### 4.3 PER-CORNER (4 corner scales)
Add the lateral solve from the left/right residual:
```
ΔL = (M₀_fl + M₀_rl) − (P₀_fl + P₀_rl)
ΔR_side = (M₀_fr + M₀_rr) − (P₀_fr + P₀_rr)
y_R = ( ΔR_side / m_R − 1/2 ) · track     (mm from centreline, + right)
```
Derivation: a load at `y` puts right-fraction `(track/2 + y)/track` on the right
side. Set `m_R · rightFrac = ΔR_side`, solve for `y`.

⚠ **FLAG — the 4th DOF (diagonal twist).** Four corner numbers are 4 constraints;
a single point load only has 3 DOF (m, x, y). It reproduces **total, front/rear,
and left/right** — but **not** the diagonal/cross term (FL+RR vs FR+RL twist).
That un-representable remainder is real (chassis twist, uneven scale pads) but
usually small. **Proposed handling:** the leftover after fitting the point load
spills into a **static per-corner offset** (Mode B mop-up, §5). Please confirm
that's acceptable, or tell me you'd rather model a *second* point load to absorb it.

### 4.4 TOW-BALL (ball scale)
Caravan side. Residual `m_R^van = M₀_tbm − P₀_tbm`-worth is attributed to a
caravan **unaccounted load** whose longitudinal X (from coupling) is solved so its
TBM contribution matches the measured ball weight:
```
TBM contribution of load = w · (axleX − x) / axleX
```
Because TBM already feeds the vehicle's rear axle and GCM in the engine, fixing
the van's tow-ball **automatically** corrects the vehicle rear axle — no separate
vehicle step. The compare strip will show this cross-over live.

### Summary — what each level honestly buys you
| Ticket shows | Reproduced exactly | Still the model's guess |
|---|---|---|
| Total | GVM / total | front/rear split, lateral |
| + Per-axle | total + front + rear | lateral |
| + Per-corner | total + F/R + L/R | diagonal twist (→ tiny static offset) |
| + Tow-ball | coupling + (via cross-over) vehicle rear | — |

---

## 5. The unified algorithm ("BOTH", combined)

Your "BOTH" decision drops out as a single robust procedure — **positioned load
carries the bulk; a static offset mops up whatever a point load physically can't
represent:**

1. Compute the residual vector `R = M₀ − P₀` at the ticket's fidelity.
2. **Fit one positioned load** `(m_R, x_R, y_R)` per §4, **clamped to the rig
   envelope** (a load can't sit 4 m behind the bar).
3. Compute what that fitted load actually reproduces; subtract from `R` → a small
   **remainder** (the diagonal twist, any clamp overflow, any sign conflict).
4. Apply the remainder as a **static per-axle/corner offset** (Mode B).
5. User can override: *"I don't know where it is"* → skip step 2, put **all** of
   `R` into the static offset.

So the default is "mostly positioned load, with a small honest static correction
for the part geometry can't move."

---

## 6. Edge cases that need a ruling

These are where the math can misbehave; I've proposed a default for each — please
tick or correct.

1. **Negative total residual** (`m_R < 0`, model *over*-reads). A draggable
   "−20 kg load" is nonsense to a user. **Proposed:** for net-negative residual,
   skip Mode A and use a pure static offset (a quiet downward correction), labelled
   as "model bias" not "unaccounted load." OK?
2. **`m_R ≈ 0` but axles disagree** (front over, rear under, ~zero total). `x_R =
   ΔF·wb/m_R` blows up. **Proposed:** below a mass threshold (say |m_R| < 15 kg),
   don't fit a position — put the whole axle residual into the static offset. OK?
3. **`x_R` / `y_R` outside the physical rig.** **Proposed:** clamp to the
   envelope, spill the unrepresented bit to the static offset (§5 step 3).
4. **Calibration can flip a legal verdict.** Calibration changes the *predicted
   actual weight*, never the *rating* (GVM/GAWR/ATM/tow-ball limits are fixed law).
   A calibrated rig may newly read **over** a limit that the raw model read under
   (or vice-versa). That's the point — it's more honest. **Confirm** we surface
   this plainly and the existing disclaimer stays ("planning tool, calibrated to
   your figures, not a certification").
5. **Stale calibration.** If the user changes something we *can't* see (re-packs
   the tub, a wet vs dry van), the anchor drifts. **Proposed:** stamp the baseline
   with its date + the config it was weighed at, and show "calibrated N days ago"
   so they know when to re-weigh. (Versioning in P2 makes this first-class.)
6. **Tare double-count.** The existing `calibrationOverrides.caravanTareKg` (a
   tare *gear* offset) and the new residual both add mass. **Proposed:** when a
   weighbridge baseline exists, the measured tare *supersedes* the manual
   `caravanTareKg` guess for that van (don't add both). OK?

---

## 7. Worked example (check this by hand)

**Rig:** HiLux-style, `wheelbase = 3085 mm`. Config C₀ = a typical touring load.

**Model predicts P₀:** total 2780, front 1180, rear 1600 kg.
**Weighbridge M₀ (per-axle ticket):** total 2900, front 1210, rear 1690 kg.

Residuals:
```
m_R = 2900 − 2780 = 120 kg
ΔF  = 1210 − 1180 = 30 kg
ΔR  = 1690 − 1600 = 90 kg     (30 + 90 = 120 ✔ consistency)
x_R = ΔF · wb / m_R = 30 · 3085 / 120 = 771 mm forward of the rear axle
```
→ Place a **120 kg unaccounted load at x = 771 mm** (≈ mid-tub / behind the cab —
plausible for tools + recovery gear + dirt). The engine now reproduces
**2900 / 1210 / 1690 exactly.**

**Now explore C₁:** add a 40 kg drawer at the rear bar (`x = −720 mm`). The engine
recomputes with *both* the 120 kg residual load **and** the new drawer present.
Front contribution of the drawer = `40 · (−720)/3085 = −9.3 kg` (it lifts the
front), rear gets `+49.3 kg`. So calibrated output ≈ front **1201**, rear
**1739**, total **2940** — i.e. `M₀ + the modelled delta of the drawer`. We never
asked the model for an absolute; only for the drawer's *effect*, which is exactly
what it's good at.

---

## 8. Sign-off checklist (please initial / red-pen)

- [ ] §3 master formula `calibrated = M₀ + (P(C₁) − P(C₀))` is the right basis.
- [ ] §4.2 axle solve `x_R = ΔF·wb/m_R` is correct.
- [ ] §4.3 lateral solve `y_R = (ΔR_side/m_R − ½)·track` is correct.
- [ ] §4.3 diagonal-twist remainder → static corner offset is acceptable (or: model a 2nd load).
- [ ] §5 unified "positioned-load-plus-mop-up-offset" procedure approved.
- [ ] §6.1 negative residual → static-offset-as-bias ruling.
- [ ] §6.2 small-mass threshold (proposed 15 kg) for skipping the position solve.
- [ ] §6.4 calibration may flip a verdict; disclaimer stays; wording OK.
- [ ] §6.6 measured tare supersedes manual `caravanTareKg` when a baseline exists.
- [ ] §7 worked example checks out by hand.

Once these are ticked I'll implement P1 against exactly this spec. Anything you
change here, I change in the code — this doc is the contract.

---

## 9. P3 — per-model regression from contributed calibrations (BUILT; CoG math awaiting red pen)

This is the data moat: many users' weighbridge contributions, aggregated, correct
the **base** kerb estimates the model is weakest at — kerb **mass** and kerb
**CoG position** — for *everyone*, including users who never weigh. Code:
`src/lib/physics/calibration-contribution.ts` (pure, 22 unit tests). A correction
sits unused in `VehicleCalibrationCorrection` until an admin publishes it. Once
published, the **kerb-mass** part applies automatically to users who haven't
weighed; the **kerb-CoG** part stays gated behind a per-variant moderator sign-off
(the §9.5 red-pen below), so it never moves a public number until you've blessed
the math.

### 9.1 What one contribution gives us

For a weighed config **C₀** and its ticket **M₀** we recompute the model
prediction **P₀** (server-side; never trust client deltas) and derive:

- **Residual mass** `ΔM = measuredTotal − predictedTotal` — the unexplained mass.
- **Bareness** `b = kerb / measuredTotal ∈ (0,1]` — how much of what's on the
  scale is the base vehicle. `b≈1` = stripped vehicle = a clean read on the base;
  `b≈0.5` = half the weight is gear, so the base signal is swamped.
- **kerb-mass signal** = `ΔM` (raw; the aggregate, not the row, interprets it).
- **kerb-CoG-fraction signal** (needs an axle split): treat the unexplained mass
  as if it were part of the base vehicle and ask where the base mass would have
  to sit to reproduce the **measured** front axle, given the other modelled loads
  are right:

  ```
  otherFront = P₀.frontAxle − kerb · 0.45          (non-kerb modelled front load)
  f          = (measuredFront − otherFront) / (kerb + ΔM)
  ΔfracCoG   = f − 0.45                              (0.45 = VEHICLE_KERB_COG_FRACTION)
  ```

  Folding ΔM into the base is the **conservative** choice (it attributes the
  whole front/rear discrepancy to the base, not to phantom extra loads). ← ruling needed.

### 9.2 The confound (why CoG is gated and mass is not)

A single `ΔM` and `ΔfracCoG` conflate **model bias** with **real junk aboard**
(tools, water, dirt, undeclared mods). Across the crowd the idiosyncratic junk
*averages out* — but it is **not zero-mean in position**: people load the back
(tubs, drawers, tow-ball). So a naïve mean would read "everyone loads the back"
as "the base CoG sits further back." Two defences:

1. **Bareness weighting** — weight every contribution by `b`, so near-kerb
   weigh-ins dominate and fully-loaded rigs barely count. ← is `b = kerb/measured`
   the right weight, or do you want `b²` / a hard cutoff?
2. **Robust median, not mean** — one loaded outlier can't drag the estimate.

Because **mass is strictly-positive junk** too, the kerb-mass delta is *also*
biased upward by gear — bareness weighting is what makes it trustworthy. We still
auto-publish mass (it's directionally safe and easy to sanity-check), but hold
**CoG** behind your explicit sign-off per variant.

### 9.3 Aggregation

Per variant, over the **approved** pool: `correction = weightedMedian({value, b})`
for mass and (separately) CoG. Each publishes only once it has **≥ MIN_SAMPLES = 3**
bareness-positive rows. ← is N=3 enough, or do you want a higher floor for CoG?

### 9.4 How it reaches the engine

`mergeModelCorrection()` folds a published correction into `CalibrationOverrides`:
- kerb-mass → `vehicleKerbKg` when `kerbMassApplied`.
- kerb-CoG → `vehicleKerbCogFraction` (used at the kerb load in
  `computeVehicleAxles`, engine.ts) **only when `cogApplied`** — set by the
  moderator's "Apply CoG shift (sign-off)" tick.
A user's **own** weighbridge calibration always wins (we never clobber a field the
caller set), so contributors still see their measured reality, not the crowd mean.

### 9.5 Sign-off checklist (please initial / red-pen)

- [ ] §9.1 per-contribution CoG derivation (fold ΔM into the base) is sound.
- [ ] §9.2 bareness weight `b = kerb/measuredTotal` is the right confound defence.
- [ ] §9.2 keep CoG gated behind per-variant sign-off; mass may auto-publish.
- [ ] §9.3 robust weighted-median aggregation + `MIN_SAMPLES = 3` floor.
- [ ] §9.4 user's own calibration supersedes the per-model correction.

Until §9.5 is ticked, treat the CoG-fraction output as **diagnostic only**. The
plumbing, capture, math and moderation are built; flipping CoG live is one
checkbox behind your red pen.

### 9.6 Implementation guards & known limitations (so this sheet matches the code)

These are the concrete behaviours `calibration-contribution.ts` ships with — not
new sign-off items, but documented so a reviewer can reconcile §9 with the code.

**Drop / guard rules (a contribution or signal is silently discarded when):**
- **Implausible total** — measured/predicted outside `[0.5, 2.0]` → whole
  contribution dropped (likely an extra digit / wrong vehicle / units mistake).
- **Non-finite prediction** — an incomplete snapshot whose engine result is NaN/∞
  is dropped, never stored (defence behind the `.loose()` zod schema).
- **Degenerate base mass** — CoG signal skipped when `kerb + ΔM ≤ 0.5·kerb`
  (measured far under predicted = noise, not a CoG read).
- **Implausible CoG shift** — `|ΔfracCoG| > 0.30` → the CoG signal is dropped
  (the kerb-mass signal from the same ticket is kept). Keeps wild fractions out of
  the median and the moderator's view, independent of the `cogApplied` gate.
- **Zero bareness** — `kerb ≤ 0` → `b = 0`, and zero-weight rows are excluded from
  both aggregates by `weightedMedian`.

**Negative residual** (model over-reads): unlike P1 §6.1's static-bias ruling, P3
folds a negative ΔM straight into the kerb-mass median — a net-negative correction
simply *reduces* the published kerb. Directionally fine; flagged for your eye.

**Explicitly out of scope for P3:**
- **Caravan-side calibration.** `CalibrationContribution` is vehicle-only
  (`vehicleVariantId` required). Caravan tare/TBM regression is future work (ties to
  the deferred tow-ball calibration, §4.4).
- **TOWBALL-only tickets** carry no vehicle total → contribution rejected (422).

**Known limitations (documented, deferred — not blockers, but know them):**
- **No per-contributor dedup.** `MIN_SAMPLES = 3` counts *rows*, not distinct
  submitters; the share UI only de-dupes within a browser session. One actor can
  clear the gate alone. Mitigations in place: anon POST is rate-limited, and
  bareness-weighted median + moderation-gating bound the damage. A
  `duplicateFingerprint` (as other submission models carry) is the proper fix.
- **No un-publish / revert.** Approval only ever upserts a correction; there's no
  admin action to clear `kerbMassApplied` or delete a `VehicleCalibrationCorrection`.
  A skewed correction is forward-only — it moves only as new contributions outvote
  it in the median. Manual escape hatch = a DB edit. Build an "unpublish" action
  before leaning on auto-apply in production.
- **Re-approval recomputes `cogApplied` from the *current* checkbox** over the whole
  approved pool, and the queue doesn't surface the currently-published correction —
  a moderator can't see what's live before deciding. Surface it before relying on
  CoG in prod.
- **All-or-nothing moderation** — Approve/Reject act on every PENDING row for a
  variant; no per-row reject (consistent with the positions queue).
