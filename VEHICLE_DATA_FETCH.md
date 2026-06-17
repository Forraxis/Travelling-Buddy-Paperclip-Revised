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
6. **Pre-existing caravan leak (out of scope tonight).** While fixing the vehicle
   COMMUNITY-leak, I found the **caravan** service (`caravan.service.ts`:
   `listVariantsByModel` / `search` / `listVariantsFiltered`) has the same missing
   `status: 'CATALOGUE'` filter — COMMUNITY caravans can leak on public caravan
   listings/API. Not touched (this run is vehicles-only); worth a follow-up. The
   public combo page is already guarded (both sides checked).
7. **Not status-filtered, but appear unused publicly:** `findVariantByYear` /
   `findVariantsInRange` in `vehicle.service.ts` lack a status filter. I found no public
   route wiring them, so I left them; double-check before relying on them publicly.

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

---

# Design extension — multi-tier verification, GVM upgrades & regulation currency

> **Status:** AGREED DIRECTION with Tim (design conversation), **NOT yet built**. This
> supersedes the simpler "single admin tick = corroborated" model for compliance-critical
> fields. Everything here is captured as spec; the numeric thresholds and the per-state
> rules are **Tim's Rule-11 sign-off**.

## 1. Corroboration = cross-source *agreement*, not a single tick

A compliance-critical field (GVM / GCM / front+rear axle / tow-ball / braked towing) is
**corroborated when ≥2 *independent* authoritative sources report the exact same value**
(exact-match for nameplate figures, not a tolerance band). Agreement is far harder to fake
than a single citation, and **disagreement is the most valuable output** — it points
straight at the field to check. This generalises the P3 calibration moat (many independent
weigh-ins → robust consensus) from *users* to *sources*.

Refined gating policy:

- A figure **parsed directly from a structured authoritative document** (a ROVER consumer
  report, a manufacturer spec table) → **auto-corroborates** — the value came from the
  source, with no LLM transcription step that could hallucinate it.
- A figure **stated in LLM text** (even web-grounded) → still needs cross-source agreement
  or an admin tick.
- A **vendor / forum** source → **never** auto-corroborates a critical field (the
  LandCruiser axle-limit trap: the only sources were 4×4 GVM-upgrade vendors).

## 2. Evidence hierarchy (strongest → weakest)

| Tier | Source | Role |
| --- | --- | --- |
| 1 | Compliance plate (VLM-confirmed) | Per-rig truth — the only thing correct for *this* vehicle |
| 2 | **ROVER consumer report (factory VTA)** | Authoritative structured spine — carries all 6 critical fields incl. axle limits |
| 2 | ROVER **second-stage** VTA | GVM/GCM upgrades, attributed to the modifier |
| 3 | Manufacturer spec sheet | Corroborates + pre-2021 vehicles |
| 4 | State bulletins / VSB14 | Edge cases, approvals |
| 5 | **Claude + web search** | Locator/matcher + gap-filler + pre-2021 path — **not** the source of the number |
| 6 | RedBook / commercial | Soft-field corroboration (scraping restricted by ToS) |
| 7–8 | Users / vendors | Personal-only / never auto-corroborate criticals |

## 3. ROVER (the "clean data" route) — locate vs. extract

ROVER (the federal RVSA approvals portal; RAV is the register) publishes an **Approval
Consumer Report** per Vehicle Type Approval (`VTA-XXXXXX`) for every variant approved for
sale since ~mid-2021. The report is pure engineering data: **factory tare, max GVM, max GCM,
front/rear maximum axle capacities, braked towing limit** — including the axle limits that
are otherwise unpublished.

**Architectural principle: the LLM locates the document, a deterministic parser extracts the
figure.** Claude (grounded) finds the right VTA / consumer-report URL; a table parser
(`pdfplumber` primary, the existing Tesseract + Qwen-VLM pipeline as fallback) pulls the
numbers from the actual government document. **The model never *states* a compliance figure**,
so the hallucination risk that drove the whole gating design disappears for any
ROVER-covered vehicle.

- **Category targeting** (maps to `VehicleBodyType`): **MC** = off-road passenger 4WDs
  (LandCruiser/Patrol/Prado/Everest → wagon/SUV/troopie); **NA** = ≤3.5 t utes + light vans
  (Hilux/Ranger/D-Max/79-series/HiAce); **NB1** = 3.5–4.5 t (RAM/Silverado/F-truck +
  Sprinter/Crafter camper bases).
- **Strategy shift:** this enables a **bulk authoritative import** by category, not
  one-car-at-a-time AI fetch. AI becomes the matcher + gap-filler, not the data source —
  cheaper and far more trustworthy.
- **Coverage boundary (be honest about it):** ROVER ≈ **2021+**. The pre-2021 back-catalogue
  (100-series, 80, GU Patrol — exactly the rigs people tow with) is **not** in ROVER →
  manufacturer archives / AI / plate. Never imply ROVER authority for a vehicle it doesn't
  cover.
- **Hard parts:** VTA↔consumer-variant mapping (one VTA can span trims) is where false
  corroboration lives; "disagreement" can be legitimate MY/sub-variant granularity, not
  error.

## 4. GVM upgrades — a *limit overlay*, not an accessory

**Core physics point:** a GVM upgrade changes your *limits*, not your *load*. An accessory
can only add mass; it cannot move the ceiling. Modelling an upgrade as an accessory would add
~30 kg of springs but still test the verdict against the factory GVM → the user "fails" while
legally rated higher. **Wrong.** The upgrade must act at the **variant-limit level**.

Split the two things users conflate — they are legally opposite:

| Action | Changes | Model as |
| --- | --- | --- |
| Heavier springs / airbags, **no certification** | Mass + ride height. **Limits unchanged.** | **Accessory** (placed load) |
| **Certified** GVM upgrade (second-stage plate / engineer cert) | **Limits** (+ small mass) | **Limit overlay** (kit/cert) |

An upgrade is **not** `GVM += delta` — each field comes from the approval independently:
GVM (almost always ↑), axle limits (often re-rated), **GCM (only sometimes — pre-rego can,
post-rego/engineer usually cannot)**, braked towing (sometimes constrained), plus a small
component **mass** and a slight CoG/ride-height change (advisory stability only). The
GCM-doesn't-move case is the headroom trap the calculator's GCM enforcement is built to
catch.

### Three upgrade pathways (ROVER only sees the first two)

| Pathway | Figures from | On ROVER? | UI | GCM? | Scope |
| --- | --- | --- | --- | --- | --- |
| Pre-rego second-stage manufacturer | Second-stage VTA | ✅ | Dropdown | can ↑ | National |
| Post-rego SSM kit | SSM approval | sometimes | Dropdown | usually not | mostly national |
| **State engineer / Approved-Person** (e.g. QLD AP) | Engineer cert + **state cap rule** | ❌ never | **Custom** | usually not | **State-scoped; interstate recognition risk** |

The engineer pathway is **a primary path, not an edge case** (a large chunk of the real
fleet). For these the **cert/modification plate is the only authority** — no register to
cross-check — so the plate prompt is most central here.

- **UI:** "Have a GVM upgrade? → pick your kit (ROVER second-stage VTAs for *this* vehicle)
  / **enter custom**." Custom = the plate path (snap the second-stage/cert plate → OCR
  auto-fills), marked **estimated** (reusing Phase-6 plumbing) until plate-confirmed.
- **Data model:** an upgrade table attached to the base variant —
  `{ modifierName, vtaNumber|engineerRef, gvmKg, gcmKg, front/rearAxleLimitKg, maxTowingKg,
  addedMassKg, isPreRego, certifiedState, pathway, sourceUrl }` (one row per approval, shared
  CATALOGUE for kits). The **setup** (per-rig) carries `appliedGvmUpgradeId` *or* a custom
  override → two owners of the same base vehicle differ only here (clean blast-radius fit).
  `build-physics-input` applies the overlay's limit set + mass delta.
- **Worked example (Tim's own rig):** QLD AP sign-off, state cap = **lower of +300 kg or
  +10% of base GVM** → +280 kg (the 10% governed). Captured as a *custom engineer-cert
  overlay* with `certifiedState=QLD`. The **headroom (+280 kg)** and the **actual spring mass
  (~15–25 kg)** are *two independent fields* — don't conflate them.

### State cap rules — a feature, not just validation

"Lower of +X kg or +Y% of base GVM" is computable. On custom entry the app can sanity-check
("QLD: lower of +300 kg or +10% → your +280 kg is within spec ✓") and flag implausible
entries. Caps live as **versioned `RegulationSet` data**, advisory until Tim ticks them.
Because the user has a `homeState`, the app can also warn on **interstate recognition** ("this
upgrade was certified in QLD — recognition in NSW isn't guaranteed; confirm before relying on
it"). No other AU calculator does this.

## 5. Regulation source registry + currency safeguards

A naive watcher (hash a known doc, diff it) only catches change *within* the current
framework. A move to a national scheme originates *elsewhere* (a federal bill, an NTC reform
paper, a ministers' communiqué) 1–2 years before the rule doc changes or is withdrawn. So the
registry has **two tiers**, and the system motto is **detect automatically, apply manually,
date everything.**

### Tier A — live rule sources (extract figures + caps)

| Jurisdiction | Source / certifier scheme |
| --- | --- |
| Federal | RVSA 2018 + Road Vehicle Standards Rules (legislation.gov.au); **VSB14** National Code of Practice; RAV/ROVER |
| NSW | TfNSW Vehicle Standards Information (VSI); **VSCCS** certifier scheme |
| QLD | TMR Code of Practice; **Approved-Person (AP)** scheme |
| VIC | Dept of Transport vehicle-mod guidance; **VASS** signatory scheme |
| SA | DIT vehicle standards |
| WA | DoT WA vehicle standards (own GVM-upgrade stance) |
| TAS / NT / ACT | State Growth / MVR / Access Canberra |

> Watch the **certifier schemes** (VSCCS / VASS / AP) separately from the cap-rule docs — a
> state restructuring or withdrawing a signatory scheme is itself a regime change and shows
> up on the scheme page, not the rule page.

### Tier B — horizon sources (early warning, "before it happens")

- **Federal Register of Legislation** — RVSA & Rules amendments (publish with a *future*
  effective date).
- **Parliament bill tracker** — bills amending the RVSA.
- **Dept of Infrastructure** consultation hub / Regulatory Impact Statements.
- **National Transport Commission (NTC)** reform agenda — most likely origin of a national
  scheme.
- **Infrastructure & Transport Ministers' Meeting** communiqués.
- **NHVR** — existing national-harmonisation precedent.

### Safeguards (registry fields + watcher triggers — never auto-apply)

Per source row: `tier (LIVE_RULE | HORIZON)`, `jurisdiction` (incl. first-class
**`NATIONAL`**), `scheme`, `url`, `docType`, `contentHash`, `lastChecked/Changed`,
`status (ACTIVE | UNDER_REVIEW | SUPERSEDED | WITHDRAWN)`, `supersededBySourceId`,
`effectiveFrom`, `futureEffectiveFrom`, `stability (STABLE | IN_FLUX)`, `extractedRuleRef`.

The scheduled watcher (reuse BullMQ) raises a **review task** on:

1. **Content diff** (normal case) — AI does a grounded extract + diff with citation.
2. **Disappearance** — URL 404 / redirect / "withdrawn" → high priority; stop showing a dead
   rule.
3. **Supersession language** — "replaces / superseded by…" → auto-link old→new.
4. **Future effective date** — capture it, **pre-stage** the change, warn users "rule
   changing on [date]," flip on the date.
5. **Regime classifier (AI, grounded over Tier B):** *"Any proposed/announced change to how
   light-vehicle GVM upgrades are certified in AU — national scheme, new federal instrument,
   a state dropping its certifier pathway? Summarise with sources + timeframe."* Heads-up
   only → tracking item.
6. **Stability flag** — a source under active consultation is `IN_FLUX`; the app shows extra
   caution on rules sourced from a moving target.

### Designed for its own obsolescence

`NATIONAL` is a valid jurisdiction from day one; a source can be **repointed** (old→new
linked) without losing history; a framework-wide cutover is just *effective-dating a NATIONAL
rule that supersedes the state rules* — same versioning machinery, no migration scramble.
**Grandfathering** falls out for free: Tim's QLD 280 kg cert is evaluated against the rule in
force on its issue date, even after a national scheme lands. The reuse: a flagged change is a
**candidate regulation update** in the moderation queue — the same fetch → candidate → review
→ promote → **version** pipeline as vehicle specs, on `RegulationSet` / `RegulationSetVersion`
(already versioned with `effectiveDate` / `changeSummary` / `createdBy`).

## 6. Legal disclaimer (user-facing — required)

Surface near regulation-sourced figures, the GVM-upgrade entry, and the verdict:

> **Compliance guidance — not legal advice.** TravellingBuddy endeavours to keep its vehicle
> data and state/territory & federal regulation information accurate and up to date, but laws
> vary by jurisdiction, change over time, and recognition of a modification (e.g. a GVM
> upgrade) is **not guaranteed across state and territory borders**. This tool provides
> general guidance only and may be out of date or incomplete. **It is your responsibility to
> do your own research and verify your vehicle's compliance with your state or territory road
> authority and/or a licensed certifier before relying on these results.** Your vehicle's
> compliance plate and your certifier's documentation are the authority for your specific
> vehicle. Figures are shown with their source and the date they were last reviewed.

(Show the "current as of [date] — source: [link]" stamp alongside any regulation-derived
figure so the disclaimer is concrete, not boilerplate.)

## 7. Rule-11 items this opens for Tim

- Cross-source **agreement threshold** (K sources, which tiers count) + exact-match vs
  tolerance *per field tier*.
- **GCM behaviour per upgrade pathway** (pre-rego vs post-rego/engineer) — the default when a
  cert doesn't state GCM.
- **Per-state cap rules** (seed order: Federal + QLD first, then NSW/VIC by population) and
  whether the app *validates* against them vs only records.
- **Interstate-recognition** wording + how strongly to warn.
- Final **disclaimer** wording sign-off (legal).

---

# Vehicle catalogue acquisition — initial list + staying current

> **Status:** AGREED DIRECTION with Tim, **NOT yet built**. This is the practical plan for
> *populating* the catalogue (vs the trust/verification model above).

## 1. High-level decision: ROVER is the list AND the data (2021+)

For ~2021-onward vehicles, ROVER solves both problems at once. We do **not** source a vehicle
list and then go find data for each — the **Published Approvals Directory IS the enumerable
list** (filter by category MC / NA / NB1), and each entry's **Approval Consumer Report IS the
authoritative data** (tare / GVM / GCM / front+rear axle / braked towing). One source, list +
figures, no LLM transcription of the numbers.

### Three-layer list strategy

| Layer | Vehicles | List source | Data path |
| --- | --- | --- | --- |
| **1. Core (2021+)** | Current / recent | **ROVER directory** by category (MC/NA/NB1) | ROVER consumer report → parse |
| **2. Prioritisation** | *Which to do first* | Popularity — known tow rigs + new-vehicle sales (VFACTS/FCAI) | (orders layer 1; doesn't replace it) |
| **3. Pre-2021 back-catalogue** | Older rigs (100-series, 80, GU Patrol) | **Demand-driven** — a user searches a vehicle we don't have | The grounded-Claude fetch → admin review → plate-upgrade pipeline already built |

Layer 3 matters: the back-catalogue is huge and uneven, so we **let user demand be the list**
— a search-miss triggers the candidate fetch, an admin reviews, the plate is the trust
upgrade. (This sits alongside the catalogue's existing paths: seed, admin CSV upload, admin
form, user submissions. ROVER is the new *bulk authoritative* one.)

### Launch recommendation

**Curate the popular tow-rig shortlist first, fully and accurately** (~30–50 variants: Hilux,
Ranger, D-Max, BT-50, Triton, LandCruiser 70/300, Prado, Patrol, Everest, MU-X, RAM
1500/2500, Silverado, F-150…), backed by ROVER data — then bulk-fill the rest of MC/NA/NB1
behind it. A calculator where the top tow vehicles are *exactly right* beats one with 3,000
half-matched entries.

### Ingestion flow (reuses the built machine)

```
crawl ROVER directory (filter MC/NA/NB1)
  → for each VTA: fetch Approval Consumer Report (PDF)
    → deterministic table parser (pdfplumber; Qwen-VLM fallback)
      → VehicleSpecCandidate (per-field, sourced; structured-parse = auto-corroborated)
        → admin review/promote → CATALOGUE variant
```

Claude's only job here is the fuzzy part (match a VTA to a consumer-facing variant, fill
gaps) — **never stating a compliance number.** PDF/OCR/VLM + BullMQ infra already exists (from
compliance-plate submissions).

### Immediate next step — a one-vehicle ROVER pilot

Before any bulk crawl, prove the path end-to-end on **one real 2021+ vehicle** (the mock
fixture is a 2005 100-series, which *isn't* in ROVER — use a current one, e.g. Ranger or
LC300): find its VTA, fetch + parse the consumer report, run candidate → review → promote.
De-risks the parser + matching before scaling. Build it as a `SpecVerifier`/ingestion source
against a **saved sample report first** (no live scraping until the parser is proven).

## 2. Staying current with ROVER

A scheduled crawl is right, but it must be **incremental** and watch for **three** kinds of
change, not just new records.

### Incremental crawl — high-water mark, not full re-crawl

ROVER VTAs are sequential and the directory is date-sortable, so the job keeps a **high-water
mark per category** (last VTA / published-date seen) and only pulls what's newer. Cheap,
polite, fast — new vehicles caught within a week of approval.

### Three currency concerns

| What changes | How often | Detection | Cadence |
| --- | --- | --- | --- |
| **New approvals** (models, MY updates, variants) | continuously | scan forward from high-water mark | **weekly** |
| **Amended approvals** (figure corrected, variant added to a VTA) | rare | content-hash the imported consumer reports | monthly |
| **Withdrawn / superseded** (approval revoked/replaced) | rare | a held VTA 404s / marked superseded | monthly + flag |

Amendment + withdrawal are the easy-to-forget cases — a "new records only" crawl would
silently keep showing a corrected figure or a pulled approval.

### Same machine, scheduled

- A **BullMQ repeatable (cron) job** — same infra as the regulation watcher.
- New/changed records → `VehicleSpecCandidate` → review/promote → **version**. Idempotent:
  dedupe by VTA, re-runs never duplicate.
- Every imported variant carries its `VTA` + report URL + import date → re-verifiable, and
  stamped "sourced from ROVER VTA-XXXX, imported [date]."
- The same crawl picks up **new second-stage approvals**, so the GVM-upgrade dropdown stays
  current too.

### The safeguard people miss — detect when *our crawler* breaks

ROVER will change its HTML/portal someday. A crawl that silently returns zero new records
looks identical to "no new vehicles this week." So the job needs **crawl-health monitoring**:
if a run finds zero new records for N consecutive weeks when it normally finds some, or
parser extraction-confidence drops, **raise an alert** — the scraper is probably broken, not
the world. (The bigger "is ROVER/RAV itself being restructured/replaced" question rides on
the Tier-B horizon watch in the regulation section above.)

## 3. Gate-level decision (working default — Tim to confirm)

How much human gate on **authoritative structured ROVER imports**?

- **Working default: auto-promote with audit + spot-check** for the structured ROVER parse
  *specifically* — the figure is parsed from the government document (no LLM in the number),
  so new records flow to CATALOGUE automatically with a full audit trail and Tim samples a
  review. Fast, scales.
- The **manual review gate stays** for the **Claude-grounded** path and the **user-submitted**
  path (where a model or a person *states* a figure).

Recorded as the working default; flip to "PENDING → batch-approve" if Tim wants tighter
control on bulk imports.

## 4. Rule-11 / open items for this plan

- Confirm the **gate level** above (auto-promote-with-audit vs batch-approve for ROVER).
- **Launch scope:** curated popular shortlist first (recommended) vs full MC/NA/NB1 crawl.
- **VTA ↔ consumer-variant mapping** rules (one VTA can span trims) — where false
  corroboration / mis-matches live; needs a matching + spot-check policy.
- **Crawl-health alert thresholds** (N weeks of zero, extraction-confidence floor).
