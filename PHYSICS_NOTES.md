# Physics Engine — Sign-off Review & Modelling Notes

Safety-critical core (`src/lib/physics/`). Per Build-Plan Rule 11, the changes
marked **⚠ REVIEW** below need Tim's sign-off on the math before they're trusted.

Re-run the catalogue validation any time: `npx jiti scripts/physics-harden.ts`

> ⚠️ **Awaiting sign-off — scraped caravan dataset (2026-06-24).** A large caravan catalogue was
> landed from scraped listings (caravanking + dealers + CCS): **1,194 variants, 1,039 with
> ATM/GTM**, graded RedBook (manufacturer DB) = `CONFIRMED` and dealer-corroborated =
> `ESTIMATE`/`DISPUTED`. **All flagged pending Rule-11 but LIVE in the calculator now**
> (HIGH/MEDIUM promoted to columns). A reviewer needs to know this ESTIMATE-tier body exists.
> Caveat (`CARAVAN_DATA_SOURCES.md §11`): agreed target granularity is **model + year + length**
> (floorplan/berths beneath). The floorplan/berths re-cluster is done, but **length is not yet a
> clustering dimension** and `bodyLengthMm` covers only **433/1263 (34%)** of variants — so
> different-length vans of one model/year can still merge to a median (directly relevant to the
> per-axle / TBM notes below). Closing it needs a `bodyLengthMm` backfill — Rule 11.

---

## ⚠ REVIEW — changes that need your sign-off

### 1. Caravan tow-ball-mass baseline anchored to published TBM (the big one)
**What changed:** `computeCaravan` previously placed the tare centre-of-gravity
at a fixed `0.86 × couplingToAxle`, which computes bare-van TBM as a flat **14%
of tare for every van**. The catalogue validation showed that's **~15% off the
manufacturer-published TBM on average** (only 6/20 within 5%, max 36% off) —
systematically over-reading dual-axle vans and under-reading single-axle vans.

It now anchors the tare CoG to the published figure: `tareCogX = axleX × (1 −
TBM/tare)`, so the bare-van computed TBM **reproduces the manufacturer value
exactly, per van** (falls back to 0.86 if TBM/tare data is missing).

**Why it matters:** bare TBM is the baseline for tow-ball %, the rear-axle lever
effect, and GTM — so a 15% baseline error propagated into several safety metrics.

**Evidence (`scripts/physics-harden.ts`, n=20 caravans):**

| | before (fixed 0.86) | after (anchored) |
|---|---|---|
| within 5% of published | 6/20 | **20/20** |
| mean abs deviation | 15.4% | **0.0%** |
| max deviation | 35.6% | **0.0%** |

The water/accessory delta logic and the axle split are unchanged. One test
fixture (Scenario 3) was updated because its van's published TBM sat *exactly* at
the tow-ball limit — the old under-read hid that; the new accuracy exposed it.

### 2. Position-aware caravan axle split (from the earlier change)
Replaced the cosmetic 50/50 `axle1/axle2` with a generic `axles[]`: even split for
single/close-coupled/triple (load-sharing suspension), CoG lever split for spread
tandems (surfaces "one axle over while GTM legal"). **Validation: all 20 caravans
have the correct axle count and axle loads that sum to GTM.** The load-sharing
assumption + `GTM/n` per-axle limit (no per-axle GAWR in the catalogue) are the
items to confirm — see "Assumptions" below.

---

## ✅ Done this round (safe, no sign-off needed)
- **Configurable passenger weight** — the engine ignored `journey.passengerWeightKg`
  and hard-coded 80 kg/person; it now uses the user's value (defaults to 80).
- **Payload uses calibrated tare** — `payloadRemainingKg` now uses the calibrated
  `effectiveTareKg` instead of raw `tareKg`, consistent with `totalWeightKg`.

## 🏳 Flagged, left as-is (your call)
- **Vehicle kerb CoG fraction** (`VEHICLE_KERB_COG_FRACTION = 0.45`) — places the
  unladen CoG slightly rear of centre; most engine-forward 4WD utes carry ~55–60%
  of kerb on the *front* axle, so this may understate front / overstate rear.
  **Left at 0.45 per your call** — needs a real unladen front-axle weight from a
  weighbridge to calibrate (the caravan side now has that anchor; the vehicle side
  has no published axle weights to calibrate against). Vehicle bare axle loads are
  numerically sane across all 37 catalogue vehicles (finite, positive, sum to total).

## Assumptions worth confirming
- **Load-sharing → even split** for close-coupled tandems and triples (true for
  standard AU rocker/equaliser suspension). Independent/non-equalising axles would
  need a `suspensionType` field to model differently.
- **Per-axle limit = GTM_limit / n** — the catalogue has no per-axle GAWR for
  caravans. A real per-axle rating would be more accurate.
- **Published TBM is the tare/at-rest figure** — the anchor assumes the catalogue's
  `tbmKg` is measured at tare (the manufacturer norm). If a record's TBM is an
  at-ATM figure, that van's baseline would be slightly high.
