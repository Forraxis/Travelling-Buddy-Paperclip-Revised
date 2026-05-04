# TravellingBuddy Calculator v2 — Open Decisions

**Version:** 1.2
**Date:** May 2026
**Status:** Active — items here are unresolved and need decisions before or during build

**Changelog from 1.1:**
- Item #1 (Year-range vs single-year variant schema) resolved and moved to the resolved section — year-range canonical adopted. See `TravellingBuddy_Calculator_v2_YearRange_Schema_PATCH.md` for detailed reasoning
- Remaining pending items renumbered (former items #2–#9 are now #1–#8)
- Updated cross-reference for editorial content resolved entry (spec section 9.8 → 9.9 after renumbering)

**Changelog from 1.0:**
- Items #1 through #7 resolved and integrated into the master specification (now in the resolved section below)
- New item added: Year-range vs single-year variant schema (the highest-priority remaining blocker for build resumption)

---

## Purpose

This is the parking lot. Decisions that haven't been made yet but need to be, capture-and-tracked here so they don't get forgotten and don't muddle the canonical specification.

When a decision lands, it moves into `TravellingBuddy_Calculator_v2_Specification.md` and is removed from this document.

When a new question arises during build, it gets added here.

---

## Pending strategic / design decisions

### 1. Brand outreach materials and data partnership templates

**Status:** Tim's parallel workstream — not engineering

**Context:** Brand partnerships (ARB, TJM, Ironman, etc.) are how verified accessory position data enters the catalogue. This work happens outside the build engineering. Tim owns it.

**What needs producing (outside this engineering scope):**
- Outreach email templates for first contact
- Pitch deck or one-pager explaining the calculator and the value to brand partners
- CSV template that brands fill in with their product data
- Mock-up showing "your bullbar in the calculator" for the pitch
- Data partnership agreement (legal terms for data sharing)
- Onboarding process (how a partnered brand's data gets into the catalogue)

**Suggested approach:** This is real work but it happens in parallel with the build, owned by Tim, not by AI agents. The build needs the data ingestion mechanism (admin CSV upload, manual entry forms) — that's part of admin panel design, now resolved — but the relationship management is outside the build.

**Priority:** High for the business, separate from engineering. Tim should start this once the data model is locked (which it now is).

---

### 2. Visual design specifics beyond design tokens

**Status:** Tokens defined, component visuals pending

**Context:** The existing platform docs (`TravellingBuddy_Proxmox_Setup_and_Design_System_v1_0.md` Section 9) define design tokens — colours, typography, spacing scale, border radii. Component-level visual design happens during build but some patterns need decision.

**What needs deciding:**
- Schematic visual style refinement (silhouette library, accessory dot styling, axle gauge appearance)
- Top-down view visual style
- Metric bar styling (height, animation timing, transitions)
- Accessory chip styling (compact form, sub-accessory nesting)
- Verdict banner specifics (icon usage, contrast for accessibility)
- Loading and skeleton states
- Empty states (no setup, no caravan, etc.)
- Error states (data load failure, calculation error edge case)

**Suggested approach:** Resolve component-by-component during build, drawing on existing token system for consistency.

**Priority:** Low-Medium. Iterates during build.

---

### 3. Geographic expansion timing and approach

**Status:** Deferred — not for launch

**Context:** Tim raised expansion to US/EU as a future consideration. Master spec captures the i18n-readiness posture (build for one market, structurally ready for more). Actual expansion timing and approach is deferred.

**What needs deciding when the time comes (probably 12–24 months post-launch):**
- US first or EU first (different markets, different challenges)
- Subdomain pattern vs. separate root domains
- Content translation strategy (machine + human review, full human, contractor agency)
- Local data partnerships (different brands per market)
- Marketing and customer support implications
- Whether to build a US or EU instance from the same codebase or fork
- Currency and payment processing if commerce arrives

**Suggested approach:** Don't think about this at launch beyond keeping the i18n infrastructure in place. Revisit when AU is launched and successful.

**Priority:** Low for launch. Note that the "low" doesn't mean unimportant — it means we don't act on it now.

---

### 4. Specific accessory category coverage at launch

**Status:** Tim's workstream, partner-driven

**Context:** Master spec sets ~150–200 accessories at launch with at least 30 from 2+ brand partners. The specific categories prioritised at launch depend on partnership progress and search-volume signals. Not an engineering decision; informs Tim's outreach order.

**Priority:** Medium for the business. Engineering can proceed without this resolved (admin CSV upload accepts any category schema).

---

### 5. Phase 2+ feature scoping

**Status:** Deferred until calculator v2 launches

**Context:** The platform vision (fuel station locator, route planning, overnight stops, marketplace, product sales) is documented in the original platform docs. Detailed scoping of Phase 2+ features happens after calculator launch, informed by traffic patterns, user feedback, and revenue trajectory.

**Priority:** Low. Not for now.

---

## Operational / pre-launch open items

### 6. Failover runbook authoring

**Status:** Pending

The failover process is documented at high level in master spec Section 12.4 but the actual runbook (exact commands, screenshots, timing) needs to be written. Best done after the home Proxmox standby is configured and a dry-run failover has been performed.

**Priority:** High before launch. Not before that.

---

### 7. Pre-launch QA checklist

**Status:** Will be defined in build plan Phase 17

**Context:** The build plan's penultimate phase covers pre-launch verification. The specific checklist of what to verify gets developed alongside the build and may evolve based on what's been built.

**Priority:** Build-plan-managed.

---

### 8. Launch announcement and marketing kickoff

**Status:** Tim's workstream

**Context:** Going live needs a coordinated announcement (caravan and 4WD forums, Facebook groups, email outreach to brand partners with whom data partnerships are forming). Not engineering scope but worth flagging here so it doesn't get forgotten.

**Priority:** High at launch time. Tim owns.

---

## Items that have been resolved

(Newest first.)

- ✅ **Year-range vs single-year variant schema:** Year-range canonical (option 2). `VehicleVariant` and `CaravanVariant` carry `year_from`, `year_to`, and `is_current_production` fields. Postgres exclusion constraint prevents overlapping ranges per (model, variant-name) tuple. Year-specific anomalies handled by range-splitting at admin level. Saved rigs reference `variant_id` regardless and are unaffected. Slug pattern uses `{name}-{yearFrom}-{yearTo}` for closed ranges and `{name}-{yearFrom}-current` for in-production variants. Picker spec-equivalence grouping (spec section 7.5) becomes near-no-op for the common case but remains as defensive logic for anomaly-split rows. SEO page structure handles per-year query capture via title, lead-paragraph year enumeration, year-selector affordance, and FAQPage schema entries — see spec section 9.4 (added in this patch). See `TravellingBuddy_Calculator_v2_YearRange_Schema_PATCH.md` for detailed reasoning and the patch set this resolution applied.
- ✅ **Account and saved-rig system specifics:** flat-list-with-tags organisation, auto-named setups with inline rename, duplication action, snapshot-based handling for catalogue removal, four notification categories with per-event opt-out, self-serve account deletion with 30-day hard-delete and submission anonymisation, JSON data export, anonymous setup as localStorage with claim-on-signup flow, opaque share tokens with read-only-and-fork pattern. See spec section 7.10.
- ✅ **Editorial content scope and authoring approach:** hybrid model with Tim authoring fragment corpus and style guide directly, LLM-assisted drafting with substantive editing for topic guides, markdown-in-repo content management for v1 (admin CMS deferred), 30–50 guides across regulatory concepts / state guidance / accessory categories / decision content with authoring sequenced regulatory-first. See spec section 9.9.
- ✅ **PDF report design:** one-page A4 portrait with hard length rule, side-profile schematic only (top-down deferred to v1.5 extended PDF), Puppeteer generation reusing calculator React components, monochrome compatibility test built into pipeline, plain QR linking to live setup URL, disclaimer stub for legal review pre-launch. See spec section 7.9.
- ✅ **Admin panel detailed design:** five-section IA (Catalogue, Submissions, Sponsorship, Operations, Analytics), three catalogue editing modes (forms, inline, CSV), moderation queue with VLM reasoning surfaced and 20% spot-check sampling on auto-approves, versioned regulation sets, two-role permissions model. See spec section 8.
- ✅ **Manual entry / community submission flows:** three-flow scaffold (accessory fast-path, vehicle structured-capture, caravan with extra geometry) sharing photo capture mechanism. OCR pipeline is three-tier: synchronous Tesseract for instant pre-fill, asynchronous Qwen3.6-35B-A3B extraction + gatekeeper combined in a single VLM call, two-factor auto-approval (Trusted+ AND VLM clean). See spec section 7.8.
- ✅ **Detailed mobile composition:** single column with sticky bottom results bar expanding into a full results sheet; thin non-sticky top app bar; pickers as full-screen modals from the bottom with stacked confirm-and-add; PDF via native share sheet; advanced as collapsible accordion within the results sheet. See spec section 7.7.
- ✅ **Vehicle and caravan selection at scale:** hybrid search-first picker (slide-over on desktop, full-screen modal on mobile) reused across vehicle and caravan, with spec-equivalence grouping at presentation time and admin-curated popularity at launch. See spec section 7.5.
- ✅ Physics scope: axle loads and longitudinal CoG IN, vertical CoG and dynamic sway OUT
- ✅ Vehicle-first framing (vehicle always present, caravan optional)
- ✅ Top-down view as advanced feature
- ✅ Honest co-occurrence for "often added with this" — no pay-to-play
- ✅ Mounting locations model (Option 3 from accessory composition discussion)
- ✅ Locale-aware regulation engine with hierarchical state model
- ✅ Lean stack: Postgres + Next.js, no CockroachDB or Docker Swarm at launch
- ✅ Single VPS plus home Proxmox warm standby with Cloudflare Tunnel
- ✅ Manual failover only, no automated active-active at launch
- ✅ Top 100 launch coverage with community submissions for tail
- ✅ Brand outreach as parallel workstream, admin-only data entry at launch
- ✅ PWA + Capacitor wrap, no separate native app codebase
- ✅ AU only at launch, i18n-ready for step-sideways expansion
- ✅ Multiple saved rigs per account
- ✅ AdSense + affiliate + sponsored placements at launch; marketplace and product sales deferred
- ✅ One task in flight at a time during build (no parallel branches per Paperclip experience)
- ✅ AI inference infrastructure: Qwen3.6-35B-A3B on Proxmox 3× 7900 XTX, two-service deployment (coding + calculator), Cloudflare Tunnel access from VPS. See spec section 12.7.
- ✅ BullMQ in scope at launch (was deferred in v2.0 spec) — required for VLM submission pipeline async processing.

---

*— End of Open Decisions —*
