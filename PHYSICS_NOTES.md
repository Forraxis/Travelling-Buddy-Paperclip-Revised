# Physics Engine — Modelling Notes & Sign-off Items

This documents the safety-critical modelling choices in `src/lib/physics/`. Per
Build-Plan Rule 11, the **caravan axle-split change below needs Tim's sign-off**
on the engineering assumptions before it should be trusted in production.

## Caravan per-axle load split (changed this round)

`CaravanResult.axle1*/axle2*` (a fixed 50/50 split that could never differ from
the GTM status) was replaced with a generic `CaravanResult.axles[]` array and a
position-aware split in `computeCaravanAxles()`:

| Axle config            | Split model                                            | Rationale |
|------------------------|--------------------------------------------------------|-----------|
| `SINGLE_AXLE`          | 1 axle carries full GTM                                | Trivial |
| `DUAL_AXLE_CLOSE_COUPLED` | Even (GTM/2 each)                                   | Load-sharing suspension (rocker/equaliser) balances static load by design |
| `TRIPLE_AXLE`          | Even (GTM/3 each)                                       | Same — load-sharing. **Previously got NO per-axle breakdown (bug).** |
| `DUAL_AXLE_SPREAD`     | Lever rule from the load CoG → can overload one axle   | Spread axles share load weakly; position matters |

The spread-axle split is what surfaces the spec §4.3 case ("one axle over while
total GTM is legal"), via the new `axle-imbalance` recommendation.

### Assumptions that need your sign-off
1. **Load-sharing → even split for close-coupled tandems and triples.** This is
   true for the standard AU caravan rocker/equaliser suspension. If a van has
   independent (non-equalising) axles, the even split understates the loaded
   axle. We have no suspension-type field to distinguish them. **Decision needed:**
   accept the load-sharing assumption for v1, or add a `suspensionType` /
   `loadSharing` field to `CaravanVariant`.
2. **Per-axle limit = GTM_limit / n.** The catalogue has no per-axle GAWR for
   caravans, so each axle's limit is the manufacturer GTM divided by axle count.
   A real per-axle rating would be more accurate. **Decision needed:** add a
   per-axle rating field, or keep the GTM/n approximation.
3. **Spread-axle lever rule uses the *total* load CoG** as the GTM application
   point (ignores that the tow-ball reaction is taken at the coupling). This is
   a standard planning-grade approximation and is directionally correct
   (nose-forward load → front group axle heavier), but the magnitude is
   approximate. Acceptable for v1?

The split direction was validated in tests (`Scenario 7b`): because the bare-van
CoG sits forward of the axle (which is *why* there's positive tow-ball mass), a
nose-forward van loads the **front** axle of a spread group more — and a tight
GTM can leave the front axle over its share while total GTM passes.

## Pre-existing items flagged in the earlier review (NOT changed — your call)

- **Vehicle kerb CoG fraction** (`VEHICLE_KERB_COG_FRACTION = 0.45`, engine.ts)
  places the unladen CoG slightly *rear* of centre. Most engine-forward 4WD utes
  carry ~55–60% of kerb on the *front* axle. If 0.45 is too low it systematically
  understates front-axle load / overstates rear. The caravan side is calibrated
  to a known TBM figure; the vehicle side is not. **Recommend one weighbridge
  comparison to calibrate.**
- **Passenger weight** is hard-coded at 80 kg/person (`PASSENGER_KG`); spec §7.2
  wants a configurable average. (`journey.passengerWeightKg` exists in calculator
  state but the engine ignores it.)
- **`payloadRemainingKg`** uses the raw `tareKg`, while `totalWeightKg` uses the
  calibrated tare — a small inconsistency if a weighbridge tare offset is set.

These are documented for decision; none were changed overnight.
