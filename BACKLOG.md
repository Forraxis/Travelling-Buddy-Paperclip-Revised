# Master backlog — scope the overnight build from this

> A menu of candidate work, grounded in the codebase + the living docs
> (`VEHICLE_DATA_HUB.md`, `VEHICLE_DATA_FETCH.md`, `CALIBRATION_SIGNOFF.md`, CLAUDE.md) +
> this session's open threads. **Pick items into `GVM_UPGRADE_OVERNIGHT_BUILD.md` (or a new
> overnight doc) to scope a run.** Tags say what can run *autonomously tonight*:
>
> - **[local]** — buildable now, fully local (collection DB + `docs/RVD/` corpus + code). Safe to run autonomously.
> - **[scaffold]** — build the machinery but keep it **gated/advisory** (no live model, no verdict change) until Tim/keys.
> - **[tim]** — needs a Rule-11 / product decision before it's real (build can stage it gated).
> - **[n8n]** — acquisition against the live portal → must run on the **VPN/n8n**, never the sandbox.
> - **[future]** — bigger, probably its own session(s).
> - Size: **S / M / L**.

---

## A. GVM upgrades / second-stage  *(the current plan — `GVM_UPGRADE_OVERNIGHT_BUILD.md`)*
Phases 0–7 there. Core: sub-classify second-stage [local S]; `GvmUpgrade` model + `Setup`
overlay [local M]; promotion routes GVM-upgrade → upgrade record [local M]; overlay applies in
physics [scaffold/tim M]; state cap rules [scaffold/tim M]; admin + "your kit" UI [local M].

## B. Catalogue completeness & data quality
- **Promote-all base variants** [local S] — bulk-promote EXPANDED factory candidates → CATALOGUE
  (prereq for GVM attach; only 1 variant exists today).
- **baseModel cleanup** [local S] — strip trim/drive/SSM noise ("Hilux AN2 SSM 4x4" → "Hilux").
- **NEEDS_REVIEW (52) curation** [local M] — admin "set base make/model manually" action + a hub
  queue; optionally an improved heuristic pass.
- **VTA↔model-year mapping** [tim S] — candidates use the approval window, not the true MY.
- **Amendment re-review workflow** [local M] — FIGURE_CHANGED ingests → a review queue + diff view
  (the detection exists; the human surface doesn't).
- **Parser robustness** [local M] — trailer/other-category RVDs use a different layout (no "Variant
  information for" blocks); widen the splitter before any bulk import covers them.
- **Bulk-expand tooling** [n8n M] — a spec for an n8n batch-expand (paced, VPN) over the un-fetched
  skeletons; the app side (ingest, EXPANDED flip) already works.

## C. AI / spec-fetch maturation  *(mostly gated scaffolding tonight)*
- **Grounded-Claude provider** [scaffold L] — `providers/claude.ts` is a stub; implement with
  `@anthropic-ai/sdk` + web_search + structured outputs, citations → per-field `sourceUrl`. **No live
  calls** without `ANTHROPIC_API_KEY` + Rule 11.
- **AI Tier-A/B sweep + "Needs AI" queue** [scaffold M] — the trigger model (auto-on-new-ROVER +
  manual bulk + demand-driven), job wiring, queue UI. Gated off.
- **Cross-source agreement / corroboration** [scaffold M] — ≥K independent authoritative sources
  agree → CONFIRMED; disagreement → DISPUTED. Plugs into `VariantSpecProvenance`.
- **Per-field "estimated" narrowing** [local M] — connect `VariantSpecProvenance` to
  `build-physics-input` so the calculator's "Est. — confirm your plate" flags only the *specific*
  estimated fields, not the whole variant (the open `VEHICLE_DATA_FETCH.md` TODO).
- **trust-config thresholds** [tim S] — the `TODO(tim)` numbers in `trust-config.ts` (trust-tier
  weights, soft-field `MIN_SAMPLES`, plate-prompt ratio, critical-field plate-consensus N=3).
- **Plate-consensus publish** [scaffold/tim M] — ≥N agreeing owner plates → community-confirmed; the
  anti-poisoning guard.
- **Contextual plate prompt UI** [local M] — wire `decidePlatePrompt` into the calculator result.
- **User-submitted spec values (blast-radius)** [scaffold M] — personal-until-promoted; soft fields
  via the P3 moat.

## D. Data Hub UX
- **Client vehicle picker** [local L] — make→model→variant with skeletons shown + expand-on-select
  (VEHICLE_DATA_HUB §3.5); only CONFIRMED + "Est." exposed; expand routes via n8n.
- **First-class queues** [local S] — "Needs expand / Needs AI / Needs review" saved filters.
- **Bulk actions** [local M] — bulk expand / promote / classify from the hub.
- **Per-vehicle audit/history** [local S] — surface AuditLog + amendment history on the detail page.
- **Hub performance** [local S] — Postgres FTS / indexing if `contains` search gets slow at scale.

## E. Public / SEO
- **Public confirmed-spec vehicle page** [local L] — model page + variant table, **CONFIRMED-only**,
  provenance-stamped, canonicalised (decision 6). Long-tail SEO.
- **Dynamic OG images** [local M] — currently static fallback.
- **Sitemap + Search Console** [tim S] — submission is a Tim/ops task; the controls exist (disabled).
- **Disclaimer surfacing** [local S] — the §6 "not legal advice / current as of [date]" stamp near
  regulation-sourced figures + the verdict.

## F. Regulation currency  *(the big design — VEHICLE_DATA_FETCH §5)*
- **Regulation source registry** [scaffold L] — Tier A live-rule sources + Tier B horizon sources;
  fields for `tier/jurisdiction(incl NATIONAL)/scheme/status/effectiveFrom/stability`.
- **Scheduled watchers** [scaffold/n8n L] — content-diff / disappearance / supersession /
  future-effective-date / regime-classifier / stability → review tasks. Detect auto, apply manual.
- **RegulationSet maturation** [local M] — NATIONAL jurisdiction, supersession linking, grandfathering
  (the versioning machinery exists).

## G. The fuel app  *(the bigger product — mostly [future])*
- **Fuel-consumption model** [tim L] — claimed baseline (Tier B) + **real-world towing delta** from
  mass + aero + rig config (the differentiator). Physics → Tim.
- **Community real-world fuel logs** [future L] — P3-moat aggregation of actual economy by laden/towing.
- **Trip / route planning** [future L] — fuel-stop mapping, "min comfortable fuel" buffer, savings
  strategy from preferences; needs fuel-price feed + route/elevation.
- **Fuel-price feed** [future M] · **EV charging-stop planning** [future M] · **range calc** [future S].
- **Long-range tank overlay** [local M] — a tank-capacity overlay (reuses the GVM-upgrade/accessory
  overlay model) — changes range like an upgrade changes a limit.
- **Caravan Tier-B mirror** [local M] — frontal area + mass for the van side of the towing-fuel delta.

## H. Physics sign-offs  *(Rule 11 — all [tim])*
- P1 §3–7 + P3 §9.x calibration sign-offs; caravan axle-split; vertical-CoG / SSF stability
  (advisory); kerb-CoG un-gating. (See `CALIBRATION_SIGNOFF.md` / `STABILITY_SIGNOFF.md` /
  `PHYSICS_NOTES.md`.)

## I. Reports / artifacts
- **PDF report** [local M*] — Puppeteer won't install in the sandbox; needs a workaround (a hosted
  render service, or `@react-pdf`). *Investigate.
- **Contributors-on-tap per metric** [local S] — show who corroborated each figure.

## J. Testing / hardening / ops
- **E2E (Playwright) for the new admin flows** [local M] — data hub search/filter, expand, coverage,
  detail.
- **Data-hub seed/fixtures** [local S] — a deterministic seed so the hub demos without the live crawl.
- **Crawl-health monitoring** [n8n S] — alert when a run finds 0 new (the scraper-broke guard).
- **Pre-launch checklist** [tim] — prod secrets, AdSense, Resend domain, etc. (CLAUDE.md).

---

## How to use this
1. Add anything missing (Tim).
2. Mark the items to include this run → copy them into the overnight doc as ordered phases.
3. Favour **[local]** + **[scaffold]** for an autonomous overnight run; **[tim]/[n8n]/[future]**
   either stage-gated or deferred. Keep the **guardrails** (no live ROVER from the sandbox; physics
   gated; no live AI).
