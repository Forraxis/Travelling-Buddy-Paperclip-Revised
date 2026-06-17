# Vehicle Data-Fetch — pipeline status + TODO

AI/admin-assisted vehicle-spec ingestion. Built overnight on `feature/vehicle-data-fetch`
(design: auto-memory `vehicle-data-fetch-design.md`; plan: repo-root `OVERNIGHT_HANDOVER.md`).

> **Status:** the *machine* (schema → provider → admin fetch/review/gate/promote →
> verdict honesty) is built and proven with a **mock** provider. **No AI model was
> run; no real catalogue data was created.** Live fetch + the user-trust/plate path
> are scaffolded with conservative defaults and enumerated below.

## What's built (mock-proven, tested)

| Area | Where |
| --- | --- |
| Candidate sidecar schema (per-field provenance) | `prisma` — `VehicleSpecCandidate`, `VehicleSpecCandidateField`, enums `SpecFieldConfidence`, `SpecFetchProvider` |
| Provider layer (interface + mock + qwen + claude-stub) | `src/lib/spec-fetch/` (`providers/`, `index.ts`) |
| Field catalogue + compliance-critical set | `src/lib/spec-fetch/fields.ts` |
| Promotion gate (uncorroborated critical → blocked w/o override) | `src/lib/spec-fetch/gating.ts` |
| Candidate→variant mapper | `src/lib/spec-fetch/promotion.ts` |
| Admin console (fetch / review / edit / gate / promote / reject / unpublish) | `src/app/admin/catalogue/vehicles/spec-fetch/` |
| Async qwen job (registered, **gated off**) | `src/lib/workers/spec-fetch.worker.ts`, `src/lib/queue.ts` |
| Verdict honesty ("Est. — confirm your plate") | `src/lib/physics/types.ts`, `engine.ts`, `build-physics-input.ts`, `RightColumn.tsx` |
| Trust/plate scaffold + config | `src/lib/spec-fetch/trust-config.ts`, `plate-prompt.ts` |

**Demo (mock):** Admin → Catalogue → **Spec Fetch** → enter `Toyota` / `LandCruiser 100`
/ `2005` → Fetch. The LandCruiser fixture returns GVM/GCM/towing HIGH + axle limits
LOW (vendor-only). The axle limits are compliance-critical + uncorroborated, so
**Promote is blocked** until you tick "corroborated" on each, or record an override.
Promote → a CATALOGUE `VehicleVariant` is created (ModerationAction + AuditLog written).

## Key decisions made overnight (reversible — flag if you disagree)

- **Candidate ≠ variant.** Candidates live in their own table and never materialise a
  `VehicleVariant` until promotion → they cannot leak into public search/calculator.
  (This resolved the Phase-3 visibility pre-check by construction rather than adding a
  `DRAFT` enum state.)
- **Promotion reuses the *mechanics* of the moderation approve path** (transaction +
  ModerationAction + AuditLog), creating a CATALOGUE variant directly rather than going
  through a `VehicleSubmission` row (the candidate table is the holding-pen).
- **`response_format: json_schema`** (not GBNF) constrains the qwen output.
- Output value stored as a **canonical string** in the sidecar; the promotion mapper
  parses to the typed column. `null` = "not found", never `0`.

## ⚠️ For Tim (Rule 11 / product / ops)

1. **GCM enforcement — already OK (no action, just confirming).** The verdict engine
   *does* enforce GCM as a hard constraint when a caravan is present
   (`engine.ts`: `gcmKg = vehicleTotal + caravanTotal` vs `vehicle.gcmKg`, added to the
   overall verdict). The LandCruiser "GVM 3260 + tow 3500 = 6760" case is caught.
2. **Possible gap to confirm (NOT changed):** `maxTowingCapacityKg` is read into the
   physics input but **never compared** in the verdict — only caravan ATM (vs the van's
   own rating) and GCM are. So "trailer loaded mass > vehicle's max braked towing" isn't
   currently a metric. Decide whether it should be (it's a real legal limit). Physics →
   your call; left untouched.
3. **Numeric thresholds need sign-off** (all marked `TODO(tim)` in `trust-config.ts`):
   trust-tier weights, soft-field `MIN_SAMPLES` for specs, plate-prompt proximity ratio.
4. **Tolerance bands** for corroborating *measured* fields (vs exact-match for nameplate
   fields) — physics, your call.
5. **API key for real data.** `ANTHROPIC_API_KEY` (grounded Claude path) — the real data
   source. `QWEN_*` is for pipeline testing only (ungrounded → hallucinates → always gated).

## Remaining build (scaffolded, not wired)

- [ ] **Claude (grounded) provider** — `providers/claude.ts` is interface-only. Implement
      with `@anthropic-ai/sdk` + web_search + structured outputs; map citations →
      per-field `sourceUrl`. Needs `ANTHROPIC_API_KEY`.
- [ ] **Live qwen/claude fetch wiring.** Today the admin action rejects non-MOCK. To
      enable: (1) `SPEC_FETCH_LIVE_ENABLED=true`, (2) have `fetchCandidate` enqueue on
      `specFetchQueue` for QWEN/CLAUDE instead of erroring (worker `runSpecFetchJob`
      already exists + is gate-tested), (3) prefer CLAUDE for real data.
- [ ] **Per-field provenance on promoted variants.** Verdict honesty currently flags
      *all* limits of a COMMUNITY/estimated variant (variant-level signal). Once a
      promoted CATALOGUE variant can carry which specific fields were estimated/
      uncorroborated, narrow `deriveEstimatedLimits` (`build-physics-input.ts`) to those
      fields. (Schema follow-up — e.g. a provenance sidecar on the variant.)
- [ ] **User-submitted spec values (blast-radius).** Personal-only until promoted; soft
      fields aggregate via the **P3 moat** (`calibration-contribution.ts`:
      `collapseByFingerprint` + `weightedMedian` + `MIN_SAMPLES`, trust-tier weighted);
      critical fields require plate/admin (never headcount); disputes instead of
      overwrites. Config shape in `trust-config.ts`; numbers need Tim.
- [ ] **Contextual plate prompt UI.** `plate-prompt.ts` decides *whether/which* (pure,
      tested). Wire `decidePlatePrompt` into the calculator result (compute each metric's
      `usageRatio` + `limitEstimated`) and render a value-first, OCR-auto-fill prompt —
      never gate the calculator behind it.
- [ ] **Caravans.** This run is vehicles only; mirror for caravan specs later.
