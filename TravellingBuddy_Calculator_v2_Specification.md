# TravellingBuddy Calculator v2 — Master Specification

**Version:** 2.2
**Date:** May 2026
**Status:** Canonical reference for Phase 1 calculator rebuild
**Supersedes:** Version 2.1 of this document; Phase 1 sections of the original Master Architecture Overview (which is retained as reference for Phase 2+ platform direction)

**Changelog from 2.1:**
- Section 5.1: Vehicle and caravan variant keying updated from single-year to year-range canonical (`year_from`, `year_to`, `is_current_production`). Added exclusion constraint description for both hierarchies
- Section 7.5: Softened spec-equivalence grouping language to reflect year-range schema — picker now displays canonical ranges rather than aggregating single-year rows
- Section 9.2: Updated vehicle profile, caravan profile, and combo page slug examples to year-range form. Added slug regeneration rule. Added two new page types: vehicle model-level pages and caravan model-level pages
- New section 9.4 (year-range page structure for per-year query capture) covering variant profile pages, combo pages, and model-level pages. Subsequent subsections renumbered: 9.4→9.5, 9.5→9.6, 9.6→9.7, 9.7→9.8, 9.8→9.9, 9.9→9.10, 9.10→9.11

**Changelog from 2.0:**
- New section 7.5 (vehicle and caravan picker)
- Updated 7.2 and 7.3 (vehicle and caravan panel references to picker)
- Replaced section 7.7 (mobile composition) with full design — was a brief note in 2.0
- Replaced section 7.9 (PDF report) with full design — was a brief note in 2.0
- Replaced section 7.10 (account and saved-rig system) with full design — was a brief note in 2.0
- New section 7.8 (manual entry and community submissions)
- New top-level Section 8 (admin panel), with downstream sections renumbered
- New subsection 9.8 (editorial production model) within the renumbered SEO content engine section

---

## 1. Purpose of this document

This is the canonical product and architecture reference for the TravellingBuddy Calculator rebuild. It defines what the calculator is, who it serves, what it computes, how the data is structured, what the user interface does, how the SEO content engine works, and how the system is built and operated.

It does not define the build sequence — that lives in the companion document `TravellingBuddy_Calculator_v2_Build_Plan.md`. It does not list outstanding decisions — those live in `TravellingBuddy_Calculator_v2_Open_Decisions.md`.

This document is intended to be read by humans (Tim, future contractors, brand partners), and by AI agents (Paperclip CEO/CTO, Claude Code) as foundational context for any task they're working on.

The original platform documents (`TravellingBuddy_Master_Architecture_Overview_v1_0.md`, `TravellingBuddy_Proxmox_Setup_and_Design_System_v1_0.md`) remain in the project as reference for the eventual platform direction (Phase 2+: fuel station locator, route planning, overnight stops, marketplace). They describe the destination, not the calculator launch. Where they conflict with this document, this document wins for the calculator build.

---

## 2. Vision and positioning

### 2.1 What the calculator is

A physics-grade rig weight and compliance calculator for Australian road travellers. It evaluates whether a touring vehicle (with or without an attached caravan or trailer) is legal, safe, and well-balanced under its current load configuration.

It is the traffic-driving entry point to the broader TravellingBuddy platform. Users discover it through organic search ("can a Hilux tow a Jayco Journey?"), use it to plan or verify their setup, and convert into accounts that carry forward into Phase 2+ features (fuel planning, route optimisation, overnight stops).

### 2.2 What makes it different

Most existing Australian towing calculators check three numbers: GVM, GCM, and tow ball mass. They miss the questions that actually fail real-world rigs:

- **Front and rear axle loads.** A vehicle can be under GVM but over its rear axle limit. A heavy tow ball download lifts the front axle, reducing steering and braking authority. Most calculators don't model this.
- **Caravan tow ball mass as a function of internal load distribution.** TBM isn't fixed — it depends on where weight sits inside the van relative to the axle. A toolbar mounted on the rear bumper of a caravan can shift TBM dangerously low even though GVM, GCM, and ATM all check out.
- **Single vs. dual axle handling.** Single-axle vans put all GTM on one axle pair with tighter loading tolerances. Dual-axle vans split load across two axles with different limits.

The calculator computes longitudinal centre of gravity for both vehicle and caravan, treating them as beams supported by their axles. This is standard statics — well-understood physics — but the data needed to do it (the longitudinal position of every accessory) is not publicly available anywhere. The combination of correct physics plus deliberately collected position data is the calculator's competitive moat.

### 2.3 Who it serves

Two primary audiences, both first-class:

**Caravan and camper trailer towers.** The traditional towing audience — grey nomads, families, weekend tourers. They configure a vehicle plus a caravan plus accessories and want to know if the combination is legal.

**Touring rig owners without caravans.** 4WD tourers with rooftop tents, ute camper users with slide-on campers, van lifers with permanent fitouts, expedition builders. They have the same axle load and GVM problems as caravanners (often worse, because they can't use weight distribution hitches to recover front axle load) but no tool currently serves them. The calculator handles vehicle-only setups as a first-class case, not an afterthought.

The vehicle is the always-present subject. The caravan is an optional attachment. This framing is structural to the UI and the data model.

### 2.4 Where it sits in the platform

The calculator is Phase 1 of the broader TravellingBuddy platform. The platform vision (fuel station locator, route planning, overnight stops, marketplace, product sales) remains valid as the destination, but is deferred entirely until the calculator is launched, stable, and generating traffic.

Specifically:

- The marketplace (mobile weighbridge directory, GVM upgrade installer bookings, accessory fitter listings) is deferred until the calculator has traffic that justifies operator listings.
- The self-serve advertiser portal is deferred. At launch, brand data ingestion is admin-managed (CSV uploads, manual entry).
- All Phase 2+ features (fuel, routes, overnight stops, products) are out of scope for the calculator build.

The calculator's account system is designed to carry forward into these later phases without rework. Saved rigs in v1 become rig profiles in Phase 2; user trust tiers established in v1 carry into community moderation in later phases.

---

## 3. Product scope

### 3.1 In scope for v1 launch

- Vehicle catalogue: 100 makes/models with year-specific variants (~300–500 distinct variant records), covering the dominant Australian towing and touring fleet
- Caravan catalogue: 100 makes/models (~200–300 distinct variant records), covering majority of the Australian caravan market by volume
- Accessory catalogue: 200 accessories across all major categories with weight and longitudinal position data
- Physics engine computing 10 metrics across vehicle and caravan
- Vehicle-first UI with optional caravan attachment
- Vehicle and caravan picker — search-first hybrid with browse and recent paths
- Accessory selection flow with search, browse, and manual entry
- Recommendation engine pairing every red/amber metric with actionable guidance
- Side-profile schematic visualisation
- Top-down view as advanced feature
- User accounts with multiple saved rigs per account
- Shareable setup URLs (read-only without auth, edit with auth)
- PDF report generation for setups
- SEO content engine: vehicle profile pages, caravan profile pages, combo pages, accessory pages, touring rig pages, topic guides, state-specific guidance pages, naked calculator page
- Admin panel for catalogue management, submission moderation, sponsor management, regulation set editing, audit log, basic analytics
- Community submission flows for vehicles, caravans, and accessories with VLM-assisted moderation
- Compliance plate photo verification for vehicle/caravan submissions
- Trust tier system from existing platform docs
- Locale-aware regulation engine (federal + state hierarchical)
- Internationalisation infrastructure (next-intl, metric internal storage, currency codes, multi-domain routing prepared)
- AdSense integration on SEO pages
- Affiliate link tracking on accessories and upgrade kits
- Sponsored placement support with ACCC-compliant labelling
- PWA configuration with offline fallback for cached pages
- Capacitor wrap for iOS and Android app store presence (post-launch, but architecture supports it)

### 3.2 Explicitly out of scope at launch

- Native app (separate codebase). PWA + Capacitor wrap only.
- Vertical centre of gravity calculation. Longitudinal only at v1.
- Dynamic sway analysis. TBM-as-percent-of-ATM is the static proxy used.
- Tyre and suspension load rating verification. Assumes OEM-equivalent.
- Fastify split. All API in Next.js routes.
- CockroachDB. Postgres only at launch.
- Docker Swarm or multi-host orchestration. Single VPS at launch with home Proxmox warm standby.
- Real-time anything (WebSockets, live tracking, etc.).
- Email notifications beyond essential transactional (auth, lead magnet PDF, submission status, catalogue-update notifications for affected saved setups).
- Fuel station data, prices, or maps. Phase 3.
- Route planning. Phase 4.
- Overnight stop database or bookings. Phase 5.
- Mobile weighbridge directory. Phase 2 marketplace.
- GVM upgrade installer booking system. Phase 2 marketplace.
- Self-serve advertiser portal. Phase 1.5+.
- Social features (commenting, following, public profiles).
- Multi-region deployment. Australian primary only at launch.
- Non-English locales. en-AU only, infrastructure ready for others.
- VIN / compliance plate scan automation in user flow. Tesseract pre-fill on plate photos is in scope; OCR-driven auto-population beyond this is v1.5+.
- Top-down view in PDF report. Side-profile only at v1; extended two-page PDF deferred to v1.5.
- Folders for saved-setup organisation. Tags and search at v1; folders deferred.

### 3.3 Launch coverage targets

**Vehicles:** 80–120 distinct variants across the top 30 makes/models, all with verified GVM, GCM, kerb weight, wheelbase, and max towing capacity. At least 70% with verified front and rear axle limits. Remainder use category-template axle limits with confidence indicator.

**Caravans:** 60–80 models across the top 20 manufacturers, all with verified ATM, GTM, Tare, and TBM. At least 50% with verified coupling-to-axle distance. Remainder use body-length-based estimation with confidence indicator.

**Accessories:** 150–200 across major categories, with at least 30 from at least 2 brand partners having full verified weight + position data. Remainder have verified weights and category-template positions.

These targets are achievable in 3–4 months of focused work with modest contractor budget (under $5,000) plus Tim's own legwork. Coverage continues to grow post-launch via community submissions and additional brand partnerships.

---

## 4. The physics engine

### 4.1 What it computes

For the **tow vehicle**, six metrics:

1. **GVM** — total vehicle weight against manufacturer's Gross Vehicle Mass limit
2. **Front axle load** — sum of moments about the rear axle, divided by wheelbase
3. **Rear axle load** — sum of moments about the front axle, divided by wheelbase, with the lever effect of tow ball download added
4. **GCM** — vehicle plus caravan total against the manufacturer's Gross Combined Mass limit (only when caravan is attached)
5. **Tow ball mass as % of caravan ATM** — the static proxy for sway risk. Ideal 9–11%, dangerous below 7% or above 12%
6. **Tow ball mass against vehicle limit** — usually 350kg or 10% of caravan ATM, whichever is lower

For the **caravan**, four metrics:

1. **ATM** — caravan total weight against the Aggregate Trailer Mass limit
2. **GTM / axle load** — what the caravan's own axles carry (ATM minus tow ball mass), against the Gross Trailer Mass limit. For dual-axle vans, GTM splits across two axles with separate limits.
3. **Single-axle vs dual-axle handling** — single axles have one combined limit; dual axles split with per-axle checks
4. **Payload remaining** — ATM minus tare, minus everything loaded; can be negative

When a caravan is attached, all 10 metrics are evaluated. When the user has only a vehicle (no caravan), 5 metrics are evaluated (GVM, front axle, rear axle, plus tow ball if anything is hooked up like a bike rack with cargo, plus a qualitative vertical CoG advisory if heavy items are roof-mounted).

### 4.2 The math

Treating the vehicle as a beam on two axles separated by wheelbase L, with x = 0 at the rear axle and positive x forward to the front axle:

```
TotalWeight = kerb + Σ accessories + passengers + fuel + cargo + towBallDownload
SumOfMomentsAboutRearAxle = Σ (weight_i × x_i) for all loads
FrontAxleLoad = SumOfMomentsAboutRearAxle / wheelbase
RearAxleLoad = TotalWeight − FrontAxleLoad
```

Tow ball download sits at negative x (behind the rear axle), so its moment is negative — it subtracts from front axle load and adds to rear axle load with leverage greater than 1:1. A 350kg tow ball download on a 3,200mm wheelbase reduces front axle load by approximately 350 × 1200/3200 = 131kg and adds 481kg to the rear axle.

For the **caravan**, with x = 0 at the coupling and positive x rearward, axle position at x_axle:

```
SumOfMomentsAboutAxle = Σ (weight_i × (x_i − x_axle)) for all loads
TowBallMass = (sum of moments forward of axle − sum of moments rearward of axle) / x_axle
GTM = ATM − TowBallMass
```

This means TBM is *computed*, not assumed. Rear-mounted accessories (toolbars, bike racks, spare wheel carriers) reduce TBM. Forward-loaded items (fridges, water tanks placed forward of axle) increase TBM. The calculator catches the toolbar-on-the-rear-of-the-van case automatically.

### 4.3 The recommendation engine

Numbers alone aren't useful. Every red or amber metric is paired with one or more recommendations, ranked by likelihood-to-help. Recommendations are not generic — they are computed from the specific failure mode and the contributors to it.

Examples of recommendation logic:

**GVM over, but axle loads OK** → recommend GVM upgrade kits available for this vehicle, with expected uplift, cost range, and links to upgrade providers (affiliate revenue path).

**Rear axle over, GVM OK** → diagnose the contributors (tow ball lever effect, canopy, drawers, rear-mounted accessories). Recommend in priority order: WDH if not already used (recovers front axle load), redistributing internal vehicle load forward, lighter alternatives for the heaviest contributor.

**Front axle light from tow ball lever effect** → recommend weight distribution hitch with explanation of the physics ("a WDH transfers 30–60% of tow ball download back to the front axle"). Link to compatible WDH options (affiliate).

**TBM below 7% of ATM** → diagnose the contributors. The most common cause is rear-mounted accessories or load in the rear of the van. Recommend moving heavy items (water, batteries, tools) forward of the caravan axle. Note that internal redistribution is the only fix — the toolbar/bike rack itself is the cause.

**TBM above 12% of ATM** → recommend redistributing load rearward inside the van.

**GCM over but GVM and ATM individually OK** → explain that vehicle and caravan are individually legal but combined exceed the vehicle's GCM. Options: GVM-with-GCM-upgrade kit (some kits raise both), reduce vehicle payload, reduce caravan payload, or change vehicle.

**Single-axle van over axle limit** → explain that single axles have one shared limit. Reducing payload is the only fix; single axles cannot be upgraded.

**Dual-axle van with one axle over** → explain split loading and recommend internal redistribution to balance axles.

The recommendations are the conversion mechanism. Every one is either a path to a partner product (GVM upgrade kit, WDH, lighter canopy, suspension upgrade) or trust-building advice that brings the user back. They are not decoration.

### 4.4 What the engine deliberately does NOT compute

**Vertical centre of gravity / rollover risk.** Static longitudinal calculation only. Rollover dynamics depend on speed, manoeuvre type, suspension, tyres, and surface — outside the scope of a planning calculator. Roof-mounted items (rooftop tents, kayaks, roof racks) trigger a qualitative advisory ("significant weight high up — avoid sharp manoeuvres") but no number.

**Dynamic sway analysis.** TBM percentage is the static industry-standard proxy. Real sway dynamics are a separate, much harder problem and not within the calculator's remit.

**Tyre and suspension load rating verification.** Aftermarket tyres can have lower load ratings than OEM. Aftermarket suspension can change effective load capacity. The calculator assumes OEM-equivalent and notes this in advanced view footnotes. Phase 1.5+ feature.

**Real-time legal compliance.** The calculator gives best-effort estimates. It is explicitly not a substitute for a weighbridge or a licensed engineer's assessment. The disclaimer banner appears on every results view, prominently and non-dismissably.

### 4.5 Calibration

Manufacturer-published kerb weight is "dry" — the vehicle as it leaves the factory with minimal fluids and no driver. Real-world kerb weight is typically 30–80kg heavier. Caravan tare is similarly under-stated by manufacturers, often by 50–150kg.

The calculator supports user-supplied **weighbridge calibration**: the user enters an actual measured weight from a weighbridge and the engine offsets all calculations from the calibrated baseline. This is also a hook into the Phase 2 mobile weighbridge directory ("your last calibration was 18 months ago and you've added 3 accessories — find a mobile weigh service").

Accessory weights stored in the catalogue are *installed weights* (including mounting hardware), not bare-product weights. Brand data ingestion explicitly requests installed weight per fitment.

### 4.6 Performance

The engine runs in the browser as pure TypeScript. Stateless, deterministic, ~5ms per calculation. No API call, no spinner. Every slider movement, every accessory addition, triggers a recalculation with no perceptible latency.

This is critical for the user experience. The "feels alive" property — drag the fuel slider and watch the rear axle load bar shift — is half the wow factor and depends entirely on instant recalculation.

The engine is a pure module (`src/lib/physics/`) with no side effects, no I/O, no React dependencies. It accepts a configuration object and returns a result object. The UI layer wraps it in React state and hooks.

---

## 5. Data model

### 5.1 Core entities

**Vehicle hierarchy:** `VehicleMake` → `VehicleModel` → `VehicleVariant`. The variant is the unit of all regulatory data. Variants are keyed by specification across a contiguous model-year range. The variant carries:

- `year_from`, `year_to` (inclusive integer years), `is_current_production` (boolean)
- GVM, GCM, kerb weight, max towing capacity
- Front axle limit (GAWR-F), rear axle limit (GAWR-R)
- Wheelbase (mm)
- Front overhang, rear overhang, total length
- Fuel tank capacity
- Body type (dual-cab ute, wagon, troopcarrier, etc.)
- Drivetrain (4×4, 4×2, AWD)
- Transmission (manual, automatic)
- Fuel type
- Provenance and confidence (verified, estimated, community)
- Saved-setup snapshot fields used by section 7.10 (Account and saved-rig system) for graceful catalogue removal handling

A unique constraint enforces non-overlapping year ranges per `(model_id, variant_name)` tuple via a Postgres exclusion constraint. Year-specific anomalies (e.g. a one-year max TBM bump) are modelled by splitting a range into two or more rows with the anomaly year(s) carrying their own row.

**Caravan hierarchy:** `CaravanMake` → `CaravanModel` → `CaravanVariant`. Similar structure. Variants are keyed by specification across a contiguous model-year range. The variant carries:

- `year_from`, `year_to` (inclusive integer years), `is_current_production` (boolean)
- ATM, GTM, Tare, TBM (manufacturer-published)
- Axle configuration (single, dual close-coupled, dual spread, triple)
- Coupling-to-axle distance, axle spacing (tandem only)
- Body length, overall length
- Fresh water capacity, grey water capacity
- Gas bottle config
- Body type (caravan, camper trailer, hybrid, pop-top)
- Provenance and confidence

A unique constraint enforces non-overlapping year ranges per `(model_id, variant_name)` tuple via a Postgres exclusion constraint, equivalent to the vehicle variant constraint.

**Accessory:** `AccessoryBrand` → `Accessory`. Each accessory carries:

- Category (bullbar, canopy, drawer system, rooftop tent, fridge, lithium battery, recovery gear, water tank, etc.)
- Installed weight (kg, including mounting hardware)
- Mounting locations (foreign keys to MountingLocation entities — see below)
- Position type (verified, category-template, community)
- Per-vehicle fitment records (which vehicles have confirmed fit, which have estimated fit)
- Sub-accessory parent reference (e.g. winch is a sub-accessory of bullbar)
- Optional capacity/fill fields (for tanks)

**Mounting locations** are first-class entities. A bullbar mounts at "front bumper". A drawer system mounts at "rear cargo area". A rooftop tent mounts at "roof rack". These define the longitudinal positions used by the physics engine, parameterised per vehicle (a Hilux SR5's "rear cargo area" position is different from a 79 Series Troopcarrier's).

**RegulationSet:** Hierarchical. AU-federal, AU-NSW, AU-VIC, AU-QLD, AU-WA, AU-SA, AU-TAS, AU-NT, AU-ACT at launch. Each regulation set is versioned (see section 8.5) and carries: GVM upgrade rules, towing licence thresholds, trailer brake requirements, length limits, overhang limits, towing speed limits per road class, regulatory references with URLs, effective date.

**User and saved setups:** `User` → `SavedSetup`. SavedSetup carries: vehicle reference + entity-spec snapshot, optional caravan reference + entity-spec snapshot, accessories list with positions and quantities, journey assumptions (fuel, passengers, cargo, water), tags, share token, audit metadata.

**Submissions:** `Submission` → `SubmissionPhoto`. Each submission carries: submitter user, submission type (vehicle, caravan, accessory), submitted values (JSON), photos with object-storage URLs, OCR pre-fill data (Tesseract output), VLM extraction result (Qwen3.6 output as structured JSON), VLM gatekeeper assessment with reasoning, status (draft, queued, approved, rejected, deferred), moderator decision metadata.

**Trust tier** is an enum on `User` (New, Contributor, Trusted, Moderator) with progression rules captured in section 7.8 (manual entry and submissions).

### 5.2 What this enables

- The physics engine sees a single, clean object graph
- Catalogue browse is straightforward joins
- SEO pages generate from variant, accessory, and combination cross-products
- Submissions land as proposed entities pending moderation
- Provenance tracking enables data-quality stratification and trust signals to users
- Versioned regulation sets enable audit accountability
- Saved-setup snapshots enable durability across catalogue churn

---

## 6. Data acquisition

### 6.1 Strategy

The data is the moat. The launch coverage targets in section 3.3 are achievable through a combination of:

- **Manufacturer scraping** for vehicle and caravan published specs (GVM, GCM, kerb, ATM, etc.)
- **Compliance plate verification** during community submissions — the legal source of truth for vehicle regulatory data
- **Brand partnerships** for verified accessory weight and longitudinal position data
- **Tim's lived knowledge and contacts** in the Australian touring community

### 6.2 Sources at launch

- **Manufacturer websites** for vehicle specs (Toyota, Ford, Mazda, Isuzu, Mitsubishi, Nissan, Volkswagen, etc.)
- **Caravan manufacturer websites** for caravan specs (Jayco, Coromal, Roadstar, Avan, Concept, etc.)
- **Brand partner CSV uploads** for verified accessory data (admin-managed at launch)
- **Compliance plate photos** from user submissions, OCR-extracted with VLM verification (see section 7.8)
- **Community submissions** for the long tail (rare variants, less common accessories)

**Explicitly not doing at launch:** RedBook commercial licence. Cost doesn't fit the constraints, and the manufacturer-direct + compliance plate approach gets to high-quality data without licensing dependency. Phase 2+ conversation.

### 6.3 Data quality at launch

The calculator launches with a deliberate quality stratification. Confidence indicators are surfaced in the UI:

- **Verified data** — manufacturer-supplied or measured. Highest confidence. Displayed without caveats.
- **Estimated data** — from category templates or inferred from similar variants. Surfaces an "estimated" indicator. The metric output gets an "estimated" qualifier.
- **Community data** — user-submitted, awaiting full moderation. Surfaces a "community-submitted" indicator. Used but flagged.

The UI is honest with the user about data quality. Honest data quality reporting builds trust and creates social motivation to upgrade entries through verified contribution.

---

## 7. UI architecture

### 7.1 Layout pattern

**Desktop (≥1024px):** Two-column layout. Left column (60%) holds vehicle panel on top, optional caravan panel below. Right column (40%) holds the verdict, schematic, metric grid, recommendations, and actions. Right column is sticky on scroll so the verdict and schematic remain visible as the user works through accessories.

**Tablet (768–1023px):** Same two-column structure with adjusted proportions (55%/45%).

**Mobile (<768px):** Single column with sticky bottom results bar that expands into a full results sheet. See section 7.7 for the full mobile composition.

### 7.2 The vehicle panel

The vehicle panel is always present (vehicle is the always-required subject).

Top: vehicle selection. The vehicle picker (described in section 7.5) opens from a "Select your vehicle" card in the empty state, and from a "Change" link on the compact card once a vehicle is selected. Selected state shows variant title, year span, and key specs (GVM, GCM, max tow) in an ~80px card so the panel does not reflow when a selection is made.

Below: journey assumptions — fuel level (slider or preset buttons with kg readout), passengers (counter with configurable average weight), vehicle cargo (kg input).

Below: accessories section. Lists fitted accessories as compact chips showing name and weight. Each chip is removable. "+ Add accessory" opens the accessory picker slide-over. Sub-accessories (e.g. winch on bullbar) display nested under their parent.

### 7.3 The caravan panel

Optional. Default state when no caravan is attached: a dashed-border "+ Add caravan or trailer" prompt taking minimal vertical space. Tapping it opens the caravan picker.

When attached: similar structure to vehicle panel — selection at top (using the same picker component as vehicle, parameterised for caravans — see section 7.5), journey assumptions in the middle (fresh water, grey water, gear inside), accessories section at the bottom. Explicit "remove" action collapses the panel back to the prompt state.

The caravan panel is visually subordinate to the vehicle panel — smaller, more muted treatment, "optional" tag. This reinforces that the vehicle is the primary subject.

### 7.4 The right column

Top to bottom:

**Verdict banner.** Full width, colour-coded. Single-line for one issue ("Hilux SR5 — over rear axle by 90 kg"), summary for multiple ("3 issues — see details below"). Identifies the rig by name. Always visible at the top of viewport when scrolled.

**Schematic.** Side-profile rendering of the vehicle (and caravan if attached). Vertical bars under each axle showing load relative to limit, colour-coded. Coloured dots at accessory positions, sized loosely by weight. The schematic is the screenshot artefact — designed to be self-contained when clipped, with rig identifier and TravellingBuddy attribution.

Schematic uses stylised iconographic silhouettes — generic shapes per body type (dual-cab ute, wagon, troopcarrier, single-axle van, dual-axle van, pop-top, etc.), not photorealistic per-model illustrations.

**Metric grid.** Single stacked column on desktop (the right column is too narrow for two-up bars when the vehicle/caravan panels are stacked on the left). Each metric is one bar: name, current value, limit, headroom-or-deficit, colour-coded fill. Tappable — tap any metric to expand contributors inline.

When no caravan is attached, the grid shows only vehicle metrics (5 of them). When caravan is attached, all 10.

**Contributors-on-tap.** Tapping a metric expands an inline panel showing the top contributors to that metric, sorted by contribution magnitude. "Tow ball lever effect: +428 kg, canopy + drawers: +180 kg, spare wheel on rear bar: +45 kg, passengers (rear seats): +85 kg." Each item has remove or edit actions where appropriate.

**Recommendations.** Maximum three at a time, ranked by likelihood-to-help. Each is a card with problem statement, suggested action, CTA. CTAs link to upgrade kits, WDH options, or other commercial paths. Sponsored placements are eligible to appear within recommendations with explicit "Sponsored" labels, ranked within their relevance tier.

**Advanced toggle.** Prominent button. Off by default. When on, expands an advanced panel showing raw axle loads, moments, weight distribution percentages, calibration offsets, methodology notes, and the top-down view. The advanced panel can be long without overwhelming the default user because the user opts into it.

**Top-down view (within advanced).** Top-down silhouette rendering of vehicle and caravan with left-right offset visualisation. Shows lateral weight distribution. Forward-looking feature for tyre load calculation in v1.5+.

**Weight breakdown table (within advanced or as a standalone collapsible).** Itemised list of every weight contributor with kg, position, and which axle/metric it loads. Sortable. Exportable.

**Action bar at bottom.** Save setup, share link, download PDF report.

### 7.5 The vehicle and caravan picker

The picker is a slide-over from the right on desktop (480px wide, matching the accessory picker's pattern) and a full-screen modal sliding up from the bottom on mobile. It serves both the vehicle and caravan panels via the same component, parameterised by entity type. The picker resolves a make/model/variant selection through three paths that all terminate in the same selected state, and the user can move between paths within a single picker session without losing context.

**Search.** A search input at the top of the picker accepts free-text queries fuzzy-matched across make, model, variant, and year. Results stream in below the input, debounced. Each result row shows a silhouette or photo, the full-qualified variant name (e.g. "Toyota Hilux SR5 Dual Cab 4×4 Auto"), a year span, a key-spec strip (GVM, GCM, max tow, kerb), and a confidence badge for non-verified data. Result ordering: exact-token matches, then prefix matches, then fuzzy, with admin-curated popularity breaking ties at launch (auto-computed from saved-setup counts once signal is available). Result count caps at 15 with a "See all" footer link that drops the user into Browse mode pre-filtered to the matched entity.

Recent selections appear as a section within the search empty state (when the input is empty) — for anonymous users persisted locally, for authenticated users with saved rigs the saved rigs surface at the top under "Your rigs" separated from generic recents. The picker's mode model is "search by default with shortcuts surfaced contextually" rather than tabbed navigation.

**Browse.** A make grid (~25 cards with logos, alphabetical with the top 8–10 popular makes pinned under a "Popular" header) leads to a model list, then to a variant list. Three taps to selection in the worst case. Each step shows a back chevron and breadcrumb so depth is honest rather than buried.

**The variant list.** Filter chips run above the variant rows on a single horizontally-scrollable line: year (multi-select), body, drivetrain, transmission, fuel — only chips that yield non-empty results are shown, so users do not hunt for valid combinations. Variant rows display the variant's canonical year range (`year_from`–`year_to`, or `year_from`–present for current-production variants). For variants with split ranges due to year-specific anomalies (e.g. a one-year TBM bump), the picker presents adjacent ranges as separate rows; the user selects the row covering their model year. A spec-equivalence grouping pass is retained as defensive logic in the variant-list query for cases where two adjacent ranges share regulatory data after the anomaly year — these are visually merged in the picker for cleanliness but remain separate canonical rows. Selection resolves to a single `variant_id`; saved rigs and calculations reference this regardless.

**Submit-vehicle / submit-caravan.** A persistent footer in the picker reads "Vehicle not listed? Submit your vehicle." (or the caravan equivalent). It routes into the community submission flow (see section 7.8) and is shown in all empty states and at the bottom of every results list.

**Selected state.** When a variant is resolved, the picker closes and the panel header collapses to an ~80px compact card: silhouette/photo at left, two-line title + spec strip in the centre, ghost-styled "Change" link at right that re-opens the picker. The compact card occupies similar vertical real estate to the empty-state "Select your vehicle" card so the panel does not reflow vertically when a selection lands — important for the sticky right column not jumping.

**Mobile.** The picker becomes a full-screen modal sliding from the bottom of the viewport, dismissed by top-right X or downward swipe. Filter chips remain horizontally scrollable. The submit-vehicle CTA pins to the bottom safe area. The compact selected-state card carries the same dimensions on mobile as on desktop.

**Caravan parameterisation.** The component differences for caravans: body type filter is more prominent (caravan / camper trailer / hybrid is the user's first mental cut); spec-equivalence grouping uses ATM, GTM, Tare, TBM, axle configuration, and body length; popularity ordering surfaces Jayco, Coromal, Roadstar, Avan, and Concept prominently in Browse given weaker brand recognition further down the long tail.

**VIN / compliance plate scan.** Not in v1. The text-search and browse paths cover the dominant case; OCR pipeline work is deferred to v1.5+.

### 7.6 The accessory picker

Slide-over from the right on desktop, full-screen on mobile. Triggered by "+ Add accessory" in either panel.

Contents:

- Search input at the top with placeholder "Search brand, model, or type"
- Below search: when no query, a category browser (grid of categories with icons and counts of fitting accessories)
- When a query is active: live results list, ranked by fitment quality (Confirmed fit > Likely fit > Generic) then by relevance
- Each result shows: brand and model name, category, weight, fitment badge, sponsored label if applicable, price range if available
- "Can't find it?" link at the bottom opening the manual entry form (see section 7.8)
- "Show only confirmed fit / show all" toggle for power users

Tapping a result opens the **confirm-and-add card** — typically as a side panel within the slide-over, or on mobile as a stacked screen within the picker:

- Accessory headline: brand, model, description
- Default installed weight (with override field if "custom installation" toggle is on)
- Position display (read-only for confirmed-fit, editable for community/generic)
- For tanks: capacity and fill level slider
- For multi-quantity items: quantity input
- For accessories with mounting locations: parent selection (which fitted accessory it mounts to)
- Impact preview: "Adding this bullbar will increase your front axle load by 78 kg. Your front axle will sit at 1,258 / 1,400 kg." With visual bar preview.
- "Often added with this" — co-occurrence-based recommendations (no pay-to-play in this section)
- Confirm and Add / Cancel actions

### 7.7 Mobile composition

The mobile layout is a deliberate single-column design rather than a degraded desktop. Half the calculator's traffic is mobile; users are at dealerships, at campsites, in bed making real decisions on small screens. The pattern relies on three constraints: the verdict must remain reachable while configuring, all picker contexts use the same modal language, and standard mobile conventions (iOS sheet semantics, share sheet, 44pt touch targets) carry the load rather than custom invention.

**Top app bar.** A non-sticky thin bar (~56pt) at the top of the viewport with title "Calculator" left and a save/account icon right. Scrolls with content. Provides a stable surface for future Help or Settings links without UI redesign.

**Configuration column.** Vertical stack: vehicle panel (empty-state "Select your vehicle" card or compact selected-state card with Change link, then journey assumptions, then accessories chip list with "+ Add accessory"), then caravan panel (empty-state dashed "+ Add caravan or trailer" prompt at minimal height, or full panel with caravan-specific assumptions and accessories when attached), then ~88pt of bottom spacing so the last interactive element is not hidden under the sticky results bar.

**Sticky bottom results bar.** Pinned to the bottom of the viewport with safe-area accommodation. ~72pt total height (60pt content + safe area). Hidden until a vehicle is selected; appears with a fade/slide on first selection. Collapsed contents: status indicator at left (filled circle, colour-coded green/amber/red), one-line verdict centre ("All clear", "Over rear axle 90 kg", "3 issues"), chevron-up at right. Tapping or swiping up the bar expands it.

**Expanded results sheet.** Slides up from the bottom to ~85–90% of viewport height. Top corners rounded with a drag handle. Internally scrollable. Content order: verdict banner, schematic, metric grid (single column, all bars stacked), recommendations, advanced section (collapsible accordion containing top-down view, raw numbers, methodology), action bar at sheet bottom (Save Setup, Share, Download PDF). Dismissal: tap outside the sheet, pull down on the drag handle, or tap a Close X in the sheet header. Collapsed bar reappears on dismiss.

**Picker modals.** Vehicle, caravan, and accessory pickers all use the same shell: full-screen modal sliding from the bottom with sheet semantics (drag handle, swipe-down dismiss, top-right close X). The accessory picker's confirm-and-add is a stacked screen within the picker (back chevron returns to results, "Confirm and Add" closes the picker). Manual entry stacks one further level. Modal stacking depth caps at two levels — confirm-and-add is the terminal action. The bottom results bar is intentionally covered while a picker is open; results awareness during selection is not the priority in those contexts.

**Touch targets and gestures.** 44×44pt minimum hit area on all interactive elements. Accessory chips are tappable across the full chip for "remove" with the X as visual cue. Filter chips on variant lists carry 8pt vertical padding around the 36pt visual height for hit zones. Slider thumbs are 28pt visual with 44pt hit zones. Pull-down dismisses all sheet contexts. Swipe-up expands the bottom results bar (in addition to tap). Swipe-back navigation between pickers is not used — explicit back chevron only.

**PDF distribution.** Native share sheet via Web Share API with file payload (`navigator.share({ files, title, text })`) on supporting browsers. iOS routes through the system share sheet — AirDrop, Mail, Messages, Save to Files. Android does the same on Chrome and Samsung Internet. Fallback for unsupported browsers: trigger a standard download. The action bar in the expanded results sheet gives users explicit control over which path.

**Schematic adaptation.** In the results sheet, schematic renders at full content width. Side-profile silhouette is the primary visual; axle gauges remain readable; accessory dot diameter compresses if needed for clarity. If accessory dots cannot render legibly at the smallest viewports, a numbered legend below the schematic carries the position information. This is a build-time decision driven by actual rendering, not predeclared. Top-down view stays in the advanced section of the results sheet — power-user surface, opted into.

**Anonymous save.** On mobile, Save Setup writes to localStorage silently for anonymous users with a claim-on-signup pathway (see section 7.10). This treatment is the same on desktop; it is documented here because mobile users are disproportionately anonymous at first interaction.

### 7.8 Manual entry and community submissions

Every picker has a submission entry point — accessory picker offers "Can't find it? Add it manually", vehicle and caravan pickers offer "Vehicle not listed? Submit your vehicle". Submissions exist in three flows that share a common scaffold (capture → photo → confirm → status) but differ in rigour and in how they interact with the calculator immediately.

**Accessory submissions** are the fast path. The user encounters a missing fridge slide or canopy and needs to keep working. The flow steps are: category selection (single tap, pre-selected if entry was from a category-filtered context), brand autocomplete with inline new-brand option, model name and weight in kg with mounting-hardware helper text, optional position with mounting location and a coarse five-position slider over a generic side-profile, optional photo upload, sharing toggle defaulted on. On submit, the accessory is created at community tier and is immediately usable in the submitter's calculation. If the sharing toggle is off, the accessory is private to the submitting user. If on, it is queued for moderation and eligible for promotion to canonical.

**Vehicle submissions** are structured-capture and rigorous. Make and Model autocomplete against existing entities with inline new-make/new-model options, and pre-populate from picker context where present. Year is a numeric stepper. Variant name is free text. Body type, drivetrain, transmission, fuel type are required dropdowns. The compliance plate photo is the primary evidence and the flow leads with it; an explainer with example image guides users to where the plate is located. OCR runs in two passes: a fast Tesseract pre-fill provides instant form values that the user verifies and corrects, then a Qwen3.6 VLM pass runs asynchronously after submission for moderator-grade extraction and gatekeeper assessment. The user does not wait for the VLM pass. Manual entry covers fields not on the plate: wheelbase, overhangs, total length, fuel tank capacity. The vehicle becomes immediately usable in the submitter's own calculation at community tier with an "awaiting review" badge; it does not appear in others' search results until approved.

**Caravan submissions** follow the same scaffold as vehicles with these differences: axle configuration is a required dropdown captured early in the flow, geometry section adds coupling-to-axle distance and axle spacing (tandem only) and body length and overall length, caravan-specific fields cover fresh water, grey water, and gas bottle config, and OCR expectations are lower because caravan compliance plates lack a standard format. The Qwen3.6 VLM pass is more important than for vehicles because it can extract from non-standard plate layouts that defeat Tesseract.

**Photo capture.** The same mechanism serves all three flows. Mobile uses native camera capture via `<input type="file" accept="image/*" capture="environment">` with progressive enhancement to MediaStream API for live capture in supporting browsers. Live capture provides a guidance overlay rectangle, hold-steady indicator using motion API, auto-capture on stable framing with manual fallback, and preview-before-commit. Desktop uses drag-drop plus file picker with the same preview step. Pre-upload processing resizes to 1600px on the long edge, JPEG re-encode at quality 85, EXIF strip for privacy. Server-side validation checks for blur, minimum dimensions, and runs an OCR pre-pass for vehicle and caravan plates with actionable failure messages. Photos are stored in S3-compatible object storage (Cloudflare R2 at launch), linked to submission record, retained indefinitely for moderation audit.

**The OCR and gatekeeper pipeline.** Three tiers process every submission with a photo:

Tier 1 is synchronous Tesseract running in the user flow, providing instant form pre-fill on the OCR confirmation step. Coarse but fast, fully replaceable by the user's edits.

Tier 2 is asynchronous Qwen3.6-35B-A3B extraction, dispatched as a BullMQ job on submission. The model receives the photo and the user-submitted form values and returns structured JSON: extracted fields with per-field confidence scores, identified discrepancies between extracted values and submitted values, and a holistic gatekeeper assessment covering plate authenticity, value plausibility, anomaly flags, and a recommended action (auto-approve / queue with reasoning / auto-reject with reasoning). The extraction and gatekeeper outputs are returned in a single VLM round-trip per submission — thinking mode enabled to allow reasoning before structured output.

Tier 3 is the moderation outcome routing: high-confidence-clean assessments combined with Trusted+ submitter tier auto-approve and promote to canonical immediately; New/Contributor submissions and any submission flagged by the gatekeeper queue for human moderator review with the VLM reasoning surfaced in the moderation UI. The auto-approve gate is two-factor: trust tier AND VLM clean. Either insufficient triggers human review.

**Trust tier integration.** First approved submission promotes the user to Contributor. Five approved submissions with no rejections in 30 days and account age of 60+ days promote to Trusted. Moderator tier is invite-only by Tim. These thresholds are configurable in admin and may be tuned post-launch based on observed quality data. A subtle "X submissions away from Trusted" indicator in the account dashboard provides motivation without inappropriate gamification.

**Status surface.** The account dashboard's Submissions section lists submissions per type with statuses: Pending review (oldest first with estimated wait), Approved (linked to live entry), Rejected (with reason and edit-and-resubmit affordance), Drafts (auto-saved partial submissions, expiring after 30 days). Email notifications default on for approval, rejection, and trust tier promotion; user can opt out per category. In-app banners are always shown.

**Duplicate detection.** Backend fingerprinting at submission: vehicles by make+model+year+body+drivetrain+transmission, caravans by make+model+year+body+axle config, accessories by brand+normalised model name. Likely duplicates are surfaced mid-submission as "We may already have this — is this what you mean?" with a link to the existing entry and a "Mine is different" override that flags dup-suspicion to moderators. Duplicate detection is augmented for accessories and vehicles by visual similarity scoring against existing photos through the VLM pass — not blocking, but surfaced to moderators.

**Anonymous users** cannot submit. The submission entry points prompt sign-up with a value-proposition message; the user's intended submission persists in localStorage and resumes after sign-up.

### 7.9 PDF report

The PDF is the viral artefact — emailed to partners, taken to dealerships as ammunition, posted in caravan and 4WD forums, printed and stuck on fridges. Every PDF in circulation is a backlink and a brand impression. Three constraints define the design: a one-page A4 hard rule, monochrome printability, and the QR code as the conversion surface back to the live setup.

**Layout.** A4 portrait, generated server-side. Top to bottom on one page:

Header strip (~80px) — TravellingBuddy logo and wordmark left, generation date and report URL right, with a subtle horizontal rule below. Title block (~50px) — setup name on the first line, rig identifier (vehicle make/model/variant + caravan if applicable) on the second line in lighter weight. Verdict banner (~70px) — colour-coded background with status icon, verdict text, and bold black text; the colour reinforces but icon and text carry meaning in monochrome. Schematic (~140–180px) — high-resolution side-profile rendering with vertical axle bars (load relative to limit), accessory dots sized loosely by weight with numeric labels matching the accessories list below. Top-down view is reserved for a v1.5 extended PDF and is not included in the v1 single-page artefact. Metric grid (~250px) — all ten metrics as horizontal bars in a two-column × five-row layout, metric name and value/limit per row, hatched overlay at amber/red states for monochrome distinction. Top 3 recommendations (~120px) — numbered, each with a bold title and one-sentence action, pulled from the recommendation engine in priority order. Setup details (~120px) — two-column compact layout, accessories list (numbered to match schematic dots, sub-accessories indented) on the left, journey assumptions on the right, accessories truncated at 8 items with "+N more on the live setup" link if longer. Footer (~60px) — disclaimer text left, TravellingBuddy attribution and URL centre, QR code (~50×50px at 300dpi) right.

**Visual treatment.** Sans-serif throughout, system stack with Inter or similar webfont fallback. Sizes: body 10pt minimum, metric labels 9pt minimum, bar values 11pt, verdict 14–16pt, title 14pt, headers 18pt. No text below 9pt including disclaimer. Colour palette reuses design tokens (`--tb-primary`, `--tb-success`, `--tb-warning`, `--tb-danger`). Every colour-coded element pairs with a hatching pattern, icon, or text label so monochrome retains all information.

**Monochrome compatibility test.** Built into the generation pipeline as an automated check on a representative sample setup: render the colour PDF, generate a greyscale conversion, run pixel comparison to verify no information is colour-only. Catches regressions when new fields or styles are added.

**Generation pipeline.** Server-side via a Next.js API route. The print template HTML uses the same React components as the calculator's right column — verdict banner, schematic, metric bars — wrapped in print-specific layout chrome. Puppeteer (headless Chromium) renders the HTML at 300dpi A4 portrait with `print-color-adjust: exact` to preserve background colours. PDF bytes return with appropriate cache headers.

**Caching.** Saved setups have stable URLs and the rendered PDF caches on the server with a content hash, invalidated on setup edit. Anonymous setups loaded via URL query string regenerate on each request — caching them yields negligible savings against meaningful storage cost given query-string variability.

**QR code.** ~50×50px at 300dpi, error-correction level M (15% recovery — enough to survive a printed-and-photographed-with-phone round-trip), encoding the live setup URL. Plain QR for v1; branded variant (logo overlay) is a v1.5+ enhancement. The brand impression on the printed page comes from the wordmark and the URL text, not the QR itself.

**Truncation behaviour.** Accessories list cap at 8 items with overflow indicator. Recommendation list capped at 3. If verdict text exceeds two lines (rare with the recommendation-engine output), it truncates with the full text remaining accessible on the live setup. No other field on the page is variable in length.

**Disclaimer.** Working text, subject to legal review before launch:

> *"This calculation is indicative only, based on manufacturer-published specifications and user-provided data. It is not a substitute for compliance verification by a licensed engineer or vehicle modifier. Confirm all values against your vehicle's compliance plate and applicable state regulations before towing. TravellingBuddy is not liable for decisions made on the basis of this calculation."*

### 7.10 Account and saved-rig system

Users can save multiple rigs to their account, share read-only URLs with others, and fork shared setups to their own account for editing. The account system is built on stable primitives (saved setups, share tokens, audit log) and exposes the texture below.

**Authentication.** Email/password and Google OAuth via NextAuth v5. JWT sessions. Profile carries name, email, home state (drives regulation context), notification preferences, trust tier (see section 7.8).

**Saved setup organisation.** Flat list with tags and search at v1, no folders. Tags are lightweight, multi-assign, user-defined ("daily driver", "weekend wagon", "big lap 2027", "spouse's setup"). The "My Setups" dashboard view is a list with name, rig identifier (vehicle + caravan summary), verdict status badge, last edited date, and tag chips. Sortable by name, last edited, or verdict status. Filterable by tag. Search across name, tags, and rig identifier. Folders are a deferred enhancement available as a future phase if heavy users emerge from analytics; the data model can accommodate folders without rework.

**Setup naming.** Auto-named on first save with the format `{vehicle short name}{ + caravan short name if present} {month} {year}` — e.g. "Hilux SR5 + Journey 21.65 May 2026" or "79 Series Troopcarrier May 2026". Inline-edit on the setup card and in the setup detail header (click name, type, escape or click-away saves). No rename modal. Duplicate names are allowed; share tokens are the identifiers, not names.

**Setup duplication.** A "Duplicate" action on the setup card and in the setup detail menu creates a copy with " (copy)" suffix. Duplicates carry over vehicle, caravan, accessories, journey assumptions, and tags. Duplicates do not carry over share tokens (new setup, new token) or audit trail (clean slate). Useful for "what if" exploration — duplicate the current setup, swap the caravan, compare verdicts.

**Catalogue removal handling.** Saved setups carry an entity-spec snapshot captured at each save (vehicle spec, caravan spec, accessory specs as JSON). When a referenced catalogue entity is removed (rare — bad data corrections, deduplication, manufacturer recalls), the saved setup uses the snapshot for verdict computation rather than the canonical entity. The setup displays a banner: "{Entity name} is no longer in our catalogue. Your setup still calculates against the data we had on {date}. Edit to replace." Editing is constrained: the user can keep the snapshotted entity (useful for owners of older or rare vehicles) or replace it with a current catalogue entity — not both. Sharing carries the banner forward to recipients. PDF generation includes a small "based on archival data" footnote next to the affected entity.

**Notification preferences.** Email notifications, default on at signup, individually configurable in account settings. Four event categories:

- Submission approved
- Submission rejected (with reason)
- Trust tier promoted
- Saved setup affected by catalogue update

Explicitly excluded: notifications when others edit shared setups (no surveillance creep), general platform announcements (handled out-of-band, opt-in only), marketing or promotional content. In-app banners surface the same events for users who opt out of email.

**Account deletion.** Self-serve via account settings. Two-step confirmation (modal explaining consequences, second confirm via typed username). Behaviour on deletion:

- User account marked deleted, immediately stops being able to log in
- Personal data (name, email, password hash, notification preferences) hard-deleted within 30 days
- Saved setups hard-deleted within 30 days
- Submitted catalogue entities retained with submitter attribution anonymised to "Former contributor" — contributed data has utility for others and was given in good faith; user removal does not retroactively strip the catalogue
- Audit log entries retained with submitter identity replaced by "deleted user (id: hash)" — accountability requirements supersede individual deletion at the audit layer
- Share tokens for the user's setups resolve to a "this setup is no longer available" page rather than broken links

The 30-day grace period provides a buffer for accidents and legal compliance.

**Data export.** Account settings → Export my data. Returns a JSON file containing profile data, saved setups (full configuration), submission history, moderation actions involving the user, notification preferences. Generated on request and emailed when ready (typically within minutes). Privacy-Act-compliant.

**Anonymous save and claim-on-signup.** Anonymous users clicking Save Setup persist their setup to localStorage with a generated UUID. A subtle banner at the top of the saved setup view notes "Saved on this device. Sign up to save permanently and access from any device." On signup completion, the application checks localStorage for unclaimed anonymous setups; if found, displays a one-screen prompt: "We found {N} setup(s) saved on this device. Add them to your account?" — listing each (name, rig identifier, last edited) with per-setup checkboxes defaulted on, plus a Skip option. Selected setups migrate to the new user's account; localStorage entries clear. Skipped setups remain in localStorage until explicitly cleared. Anonymous setups are explicitly device-local — saving on phone does not surface on desktop. The Save banner makes this limitation explicit; signing up is the documented resolution.

**Share tokens.** Setup-level share tokens generate URLs at `/setup/share/{token}` where token is a 12–16 character base62 opaque string. Read-only by default — anyone with the token can view the setup and interact with the calculator (change accessories, see verdicts update) but cannot save changes back to the original. A "Save your version" button on shared setups forks the setup into the visitor's account, prompting sign-in or sign-up if necessary. Setup owners can revoke a share token in setup settings, which generates a new token; old links 404 with a "this setup is no longer shared" page. No granular per-recipient sharing permissions at v1. Shared setup pages set `noindex` so share URLs are not crawled or ranked — public profile pages carry SEO weight; user setups are private-by-default in the SEO sense.

---

## 8. Admin panel

The admin panel is critical-path for v1 launch. Without it, catalogue management, submission moderation, sponsor configuration, and regulation set maintenance all require direct database access — viable for a few dozen vehicles but not for 500. The admin panel is also where the VLM gatekeeper's reasoning becomes operationally useful: moderators triage flagged submissions with VLM analysis attached, rather than reviewing every submission from scratch.

The admin panel is built into the same Next.js application as the public calculator, served under `/admin/*` routes with authentication-gated access. Forms reuse public submission components with admin-extra fields exposed (provenance, override controls, audit metadata). The build win is that admin is "submission flow with extra fields and no moderation gate" rather than a duplicate UI tree.

### 8.1 Information architecture

A persistent left sidebar with five top-level sections, each with sub-routes:

- **Catalogue:** Vehicles, Caravans, Accessories, Brands, Categories, Mounting locations
- **Submissions:** Pending review queue, Approved history, Rejected history, All submissions search
- **Sponsorship:** Sponsors, Placements, Schedule
- **Operations:** Regulation sets, Audit log, Sitemap controls, Feature flags
- **Analytics:** Calculator usage, Submission stats, Search and SEO

A persistent top bar holds: cross-entity search across catalogue and submissions, notification icon for moderation queue depth (badge count), account menu. Section visibility is gated by user role.

### 8.2 Catalogue editing

Three editing modes per entity type, used for different scales of work.

Entity-by-entity forms are the default. Click into a vehicle, caravan, accessory, brand, or category. Edit form. Save. Audit trail records the change. Forms reuse the public submission components with admin-extra fields exposed: provenance source (manufacturer scrape, manual entry, partner CSV, community submission), fitment quality override, sponsored status flag, manual confidence override, status (active, discontinued, placeholder).

Inline editing in list views supports bulk-touch edits on simple fields. Toggling "edit mode" on a list makes cells clickable; edits accumulate; save-all-or-revert-all commits at list level. Common cases: updating sponsorship status across 20 accessories, correcting category assignments in batch, marking variants as discontinued.

CSV upload tooling supports bulk catalogue ingestion. Each entity type has a published schema. Uploads parse and validate row-by-row, surface errors inline with row numbers, allow correction in the UI or re-upload, and commit as a transactional batch on confirm. Partial commits are not allowed. CSV upload is the launch-tier brand partner intake mechanism (admin-managed, no self-serve partner portal in v1) and is also how scraped data lands once scrapers are operational.

### 8.3 Moderation queue

The centrepiece admin surface and where the VLM gatekeeper pattern earns its keep.

The list view shows pending submissions sorted by priority — items the VLM flagged for human attention first, with a separate spot-check tab for VLM auto-approved items. Each row shows: entity type, submitter name with trust tier badge, submission date and age, photo thumbnail, VLM verdict badge (Likely good / Mixed signals / Likely problematic / No assessment) with a one-line summary, quick-action buttons (approve, reject, open detail). Filter chips above the list cover entity type, submitter trust tier, VLM verdict, and submission age. A search box finds specific submissions by submitter or entity name.

The detail view opens a two-column layout. Left column shows the submission as the user submitted it — form fields, photo, declared values, all read-only. A toggle reveals OCR-extracted values from Tesseract pre-fill and from the VLM extraction; discrepancies are colour-highlighted. Right column shows the VLM gatekeeper output as expandable structured reasoning blocks: plate authenticity assessment, value-vs-photo cross-check, anomaly notes, duplicate suggestions with linked candidates. The gatekeeper's recommended action sits at the top with a confidence score.

An action bar below the columns provides: Approve, Reject (with reason picker — common reasons preset, free text fallback), Edit-and-approve (opens the submission as an editable form for correction before approval), Mark-as-duplicate (links to existing entry, treats this as non-additive), Defer (returns to queue). All moderation actions write to the audit log with moderator identity, action, reason, and a snapshot of the VLM reasoning that informed the call.

A spot-check tab surfaces VLM auto-approved submissions sampled at 20% (configurable in admin) for moderator review. The VLM clears these immediately at submission time but the spot-check provides confidence in the auto-approve gate. Moderators can flick through, confirm, or revoke (which demotes the entry to community tier with a correction). Spot-check feedback informs VLM prompt refinement over time.

Batch actions in the list view: select multiple, apply approve/reject/defer. Batch-approve is gated on the VLM having a clean assessment for all selected items — the moderator cannot accidentally approve a problematic submission via a batch operation.

### 8.4 Sponsor management

Sponsors are entities (the brand or business). Placements are bookings — what entity gets what treatment for what dates at what tier. Sponsor list shows status, billing reference, contact, and current placement count. Sponsor detail provides placement history, contact and billing edit. Placement creation is a multi-step form: select sponsor, select scope (specific accessory, accessory category, vehicle type, upgrade pathway), select tier (featured-fit, category-top, recommendation-pinned), select date range, optional admin note. Validation prevents conflicting placements (two sponsors at "category-top" on the same category, same dates). Placement schedule view renders a calendar/Gantt-style visualisation across 90 days. ACCC compliance is enforced at the rendering layer — every sponsored placement renders with "Sponsored" labelling regardless of admin configuration. No toggle exposes "hide sponsored label" because that toggle would be illegal.

### 8.5 Regulation set editing

Each regulation set (AU-federal, AU-QLD, AU-NSW, etc.) has a dedicated edit page organised by topic: GVM upgrade rules, towing licence thresholds, trailer brake requirements, length limits, overhang limits, towing speed limits per road class, regulatory references with URLs. Each field has helper text describing what it affects in calculations and recommendations, a "last updated" timestamp, and a "source URL" to the regulatory reference being implemented.

Regulation sets are versioned. Saving changes creates a new version with a configurable effective date. Calculations use the version current-as-of-now. Historical versions remain queryable for audit. This matters for accountability — when a user disputes a calculation outcome, the audit case must point to "we updated this rule on date X based on amendment Y."

### 8.6 Analytics surfaces

Three dashboards, each with date-range and filter controls.

Calculator usage: total calculations, unique users, top vehicles, top caravans, top accessory categories, common configurations, ratio of red/amber/green outcomes, conversion to save-setup, conversion to share, PDF download counts.

Submission stats: submissions per period by type, approval rates, rejection reasons distribution, time-to-moderation, VLM auto-approve accuracy (auto-approved → spot-check confirmed vs revoked), trust tier distribution, top contributors.

Search and SEO: top in-calculator search queries (vehicle, caravan, accessory), top Google Search Console referrers via API integration, combo page performance (impressions, clicks, CTR by combo), indexation health.

Plausible covers external traffic and referrer analytics. In-product events (calculations, saves, shares, PDF downloads) write to the application database for the dashboards above. Separation keeps no sensitive funnel data leaving the platform.

### 8.7 Audit log

Every change to canonical entities, every moderation action, every regulation set version, every sponsor placement creation or edit. Filter by actor, action type, entity type, date range. Search by entity ID. Each row links to the affected entity for context. The audit log is read-only — entries are never edited or deleted. Corrective actions create new audit entries that supersede prior ones. This is critical for accountability around moderation decisions and safety-impacting data changes.

### 8.8 Permissions model

Two roles at launch.

**Admin (Tim)** has full access to all sections and is the sole authority for regulation set edits, sponsor management, and feature flags.

**Moderator** has submission queue access (read, approve, reject, edit-and-approve), Catalogue read-only, Audit log read-only on their own actions and submissions they moderated. No access to Sponsorship, Operations, or cross-cut Analytics. Catalogue corrections must flow through the moderation pipeline (edit-and-approve on a submission, or a new admin-created submission) — moderators do not have direct catalogue write access. This keeps audit and accountability paths clean.

A future Editor role for paid contractors handling bulk data work is explicitly Phase 1.5+. The two-role model covers v1.

---

## 9. SEO content engine

### 9.1 Strategy

The calculator is the conversion destination. SEO content is what gets users there. The strategy is to dominate specific long-tail queries (combo queries, vehicle-with-accessory queries) where competition is weak, hold our own on educational queries, and not chase generic competitive queries we won't win.

The page taxonomy uses programmatic *structure* with substantive *content*. Pages aren't generated as SEO bait — they're generated as fully-functional calculator instances pre-loaded with the relevant subject matter, with hand-crafted explanatory content combined contextually.

### 9.2 Page types and URL structure

**Calculator landing** — `/calculator/`. Naked calculator, no pre-fill. Targets generic "GVM calculator" / "towing weight calculator" queries.

**Vehicle profile pages** — `/vehicles/{make-slug}/{model-slug}/{variant-slug}/`. Example: `/vehicles/toyota/hilux/sr5-dualcab-4x4-auto-2018-2024/`. One per vehicle variant. Targets "[vehicle] towing capacity" / "[vehicle] GVM specs" / "[vehicle] axle limits." Variant slug rule: `{variant-name-slug}-{yearFrom}-{yearTo}` for closed ranges; `{variant-name-slug}-{yearFrom}-current` for current-production variants. When a variant is superseded or its `year_to` advances, the slug regenerates and a 301 redirect is created from the prior slug. Slug changes are audit-logged.

**Caravan profile pages** — `/caravans/{make-slug}/{model-slug}/{variant-slug}/`. Example: `/caravans/jayco/journey/journey-21-65-2021-2024/`. One per caravan variant. Variant slug rule: `{variant-name-slug}-{yearFrom}-{yearTo}` for closed ranges; `{variant-name-slug}-{yearFrom}-current` for current-production variants. When a variant is superseded or its `year_to` advances, the slug regenerates and a 301 redirect is created from the prior slug. Slug changes are audit-logged.

**Vehicle model-level pages** — `/vehicles/{make-slug}/{model-slug}/`. Example: `/vehicles/toyota/hilux/`. One per vehicle model. Shows all variants of the model grouped by variant-name, with each variant displayed as a row showing year range and key specs, and linking to its variant profile page. Targets generation-agnostic queries like "[make] [model] specs", "[make] [model] towing capacity", "[make] [model] variants comparison". Also serves as the destination for the "see all variants" overflow link from variant profile pages (per section 9.4).

**Caravan model-level pages** — `/caravans/{make-slug}/{model-slug}/`. Example: `/caravans/jayco/journey/`. Same structure as vehicle model-level pages, applied to caravans.

**Combo pages** — `/can-a/{vehicle-slug}/tow/{caravan-slug}/`. Example: `/can-a/toyota-hilux-sr5-dualcab-4x4-auto-2018-2024/tow/jayco-journey-21-65-2021-2024/`. The headliner SEO content. Generated only for plausible combinations (vehicle towing capacity vs caravan ATM with reasonable margin). At launch coverage targets, this produces 2,000–4,000 plausible combo pages.

**Accessory profile pages** — `/accessories/{brand-slug}/{accessory-slug}/`. Example: `/accessories/arb/sahara-bullbar/`. One per accessory. Targets "[accessory] weight" / "[accessory] [vehicle] fitment."

**Touring rig pages** — `/touring-setups/{vehicle-slug}/`. Example: `/touring-setups/79-series-troopcarrier/`. Targets the no-caravan touring rig audience. Shows typical builds, common gotchas, GVM upgrade paths.

**Vehicle + accessory combination pages** — `/setups/{vehicle-slug}/with-{category-slug}/`. Example: `/setups/toyota-hilux-sr5-2024/with-rooftop-tent/`. Targets "[vehicle] with [accessory category]" queries.

**Topic guides** — `/guides/{topic-slug}/`. Example: `/guides/gvm-explained/`. Hand-written editorial articles. 30–50 at launch, growing over time.

**State-specific guidance** — `/{state-code}/{topic-slug}/`. Example: `/qld/gvm-upgrade-rules/`. State-specific regulatory content with calculator integration.

### 9.3 Page content structure

Each combo page contains:

**Generated from data:**
- Hero verdict and rig summary
- Schematic visualisation
- All 10 metric bars with values
- Comparison sidebar (alternative caravans this vehicle could tow, alternative vehicles for this caravan)
- Internal links to vehicle profile, caravan profile, related combos
- Structured data (FAQPage and Vehicle schemas)

**Hand-crafted paragraph fragments combined contextually:**
- Explanatory introduction tailored to the combo's characteristics (vehicle type, caravan size, axle config, GVM headroom, GCM headroom)
- Discussion of typical concerns for this combination
- Notes on common upgrade paths or accessories used with this combo

The paragraph fragments are written as a corpus of ~100 fragments at launch (50–100 words each, so 5,000–10,000 words of crafted content total). The combo page assembly engine selects relevant fragments based on combo characteristics and stitches them. This produces substantive content per page without writing thousands of unique articles.

Topic guides are hand-written articles in full. No fragment assembly. 30–50 articles at launch covering the major regulatory concepts (GVM, GCM, ATM, VSB14, ADR towing rules), state-specific guidance for the major states, accessory category guides (bullbars 101, choosing a canopy, lithium battery basics), and related decision content.

### 9.4 Year-range page structure for per-year query capture

Vehicle and caravan profile pages cover variants whose canonical schema spans a contiguous model-year range (see section 5.1). Per-year search query volume — searches like "2021 Hilux SR5 towing capacity" rather than "Hilux SR5 towing capacity" — is captured through on-page structure rather than URL fragmentation. Each profile page must include:

- **Title tag** containing make, model, variant, and year range in `(year_from–year_to)` or `(year_from–present)` form
- **Meta description** explicitly enumerating each year covered (or stating "and current production models" for in-production variants), plus headline regulatory figures
- **H1** containing make, model, variant, and year range
- **Lead paragraph** explicitly enumerating each year covered. Plain-prose enumeration ("if your Hilux is a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 model") is the load-bearing signal for per-year query matching
- **Year selector affordance** above the spec table — small inline component listing each covered year as a visual chip set with a "all these years share the same specifications" caption
- **FAQ section with FAQPage JSON-LD** containing question-answer pairs keyed to per-year, per-headline-metric combinations. Capped at 12–15 entries per page. Selection priority: most-recent-year × each headline metric, then earliest-year × each headline metric, then middle years × headline metrics distributed across remaining slots. Each entry's question contains the year and metric tokens; each answer states the figure and reinforces the canonical range with phrasing such as "unchanged from 2018 onward"
- **Vehicle / Vehicle-derived JSON-LD** with `productionDate` carrying the range as ISO 8601 interval, `vehicleModelDate` carrying the most recent year
- **Adjacent-range internal links** to older / newer same-variant-name ranges (one per direction maximum; older = same model_id + same name + year_to < this.year_from, take maximum year_to; newer = same model_id + same name + year_from > this.year_to, take minimum year_from)
- **Variant sibling internal links** under a hybrid model: prominent links to siblings whose year coverage overlaps with this variant's range (same model_id + different name + range overlap on at least one year); plus a "see all variants" overflow link to the model-level page showing full variant history regardless of year overlap
- **Self-canonical** link with no per-year alternate URLs

**Combo pages** inherit the year-range structure on both the vehicle and caravan sides. Specifically:

- **Title:** `Can a {Make} {Model} {Variant} ({yearFromV}–{yearToV|present}) tow a {CaravanMake} {CaravanModel} {CaravanVariant} ({yearFromC}–{yearToC|present})?`
- **Lead paragraph:** cross-product year enumeration of both sides in plain prose ("This combination applies to a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 Hilux paired with a 2021, 2022, 2023, or 2024 Journey 21.65.")
- **FAQ section:** per-(year-pair, verdict-aspect) entries within the same 15-entry cap. Selection priority: (most-recent vehicle year × most-recent caravan year) × each verdict-aspect (GVM headroom, GCM headroom, towing capacity, TBM verdict), then (most-recent vehicle year × each other caravan year) × headline verdict-aspect, then (each other vehicle year × most-recent caravan year) × headline verdict-aspect, then mid-range pairs × headline verdict-aspect distributed evenly until cap is reached

The same structural template applies to caravan profile pages, with the headline metrics adjusted (ATM, GTM, TBM, body length).

**Model-level pages** (vehicle and caravan, per section 9.2) follow a different page structure since they aggregate multiple variants:

- **Title:** `{Make} {Model} — All Variants, Specifications & Towing Capacity` (vehicles) or `{Make} {Model} — All Variants and Specifications` (caravans)
- **Meta description:** Brief model overview with the count of variant ranges covered
- **H1:** `{Make} {Model}`
- **Lead paragraph:** Brief model context — when first introduced (earliest `year_from` across all variants), body types available, generation context if known. No per-year enumeration at the model level (that's the variant pages' job)
- **Variant table:** All variants grouped by variant-name, sorted within each group by `year_from` descending. Each row shows variant name, year range (in `{yearFrom}–{yearTo}` or `{yearFrom}–present` form), key headline specs (GVM, GCM, max tow for vehicles; ATM, GTM, TBM for caravans), and a link to the variant profile page
- **Internal links:** to the most popular combo pages featuring any variant of this model, to relevant accessory category pages, to topic guides covering this model's segment
- **Calculator CTA:** Links to `/calculator/` with no pre-fill (no specific variant to pre-select at the model level)
- **JSON-LD:** `ItemList` of `Vehicle` entities, one per variant, with each variant's `productionDate` interval
- **Self-canonical** link

Model-level pages capture generation-agnostic queries that variant profile pages would not rank well for ("Toyota Hilux specs" without a year or trim qualifier). They also provide the landing destination for the "see all variants" overflow link from variant profile pages.

### 9.5 Pre-fill mechanism

Every SEO page eventually leads the user to the calculator with state pre-loaded.

Calculator URL pattern: `/calculator?v={vehicle-slug}&c={caravan-slug}&a={accessory-slug-list}&p={passenger-count}&fuel={pct}`

The URL is parseable and shareable. SEO landing pages construct these URLs in their CTAs ("Try this in the calculator"). User-shared setups use a similar URL pattern with a setup ID for stored configurations. Both mechanisms produce calculators pre-loaded with state — the SEO landing path doesn't require any backend save.

### 9.6 Plausibility filter for combo pages

To avoid generating thousands of nonsense combinations:

- Vehicle's max towing capacity must be ≥ caravan's ATM × 0.8 (allows for 25% over-capacity combos because users search those to verify they're not legal)
- Vehicle's body type must be compatible with caravan's size class (a Suzuki Jimny doesn't get a combo page with a 22-foot tandem caravan)
- Some combinations may be allowed even if implausible, when search volume justifies it (Search Console signals will inform this post-launch)

Filter is configurable in admin so it can be tuned based on observed search patterns.

### 9.7 Sitemap and indexation

Tiered sitemaps. High-value pages (calculator, top-100 vehicle profiles, top-100 caravan profiles, top-50 combo pages, all topic guides, all state guidance pages) in the primary sitemap. Long-tail pages (less common combos, deep accessory pages) in secondary sitemaps.

Sitemaps generated daily from the database. Submitted to Google Search Console. Indexation monitored with structured data testing.

robots.txt allows all content pages, blocks admin and API routes. Shared setup URLs (`/setup/share/{token}`) carry `noindex` headers (per section 7.10).

### 9.8 Structured data

Per page type:

- Vehicle pages: Vehicle schema (vehicleConfiguration, weight, dimensions)
- Caravan pages: similar Vehicle schema with caravan-specific properties
- Combo pages: FAQPage schema with question/answer format
- Accessory pages: Product schema (brand, weight, price)
- Topic guides: Article schema (author, datePublished, dateModified)
- HowTo guides: HowTo schema where applicable

This is mechanical work but it's the difference between "your page is a result" and "your page has a featured snippet."

### 9.9 Editorial production model

The SEO content engine relies on three classes of authored content: paragraph fragments that compose into programmatic pages, hand-written topic guides, and ongoing editorial maintenance. Total authoring burden at launch is approximately 50,000–80,000 words. The production model is hybrid by design — Tim authors voice-critical material directly, and LLM-assisted drafting handles long-form first passes that Tim then edits substantively.

**Paragraph fragment corpus (~100 fragments at 50–100 words each).** Tim authors directly. Fragments compose into thousands of programmatic pages, so voice and accuracy at the fragment level have compounding effect. The fragment library is structured as a tagged corpus: each fragment carries metadata describing the conditions under which it applies (vehicle body type, caravan size class, GVM headroom range, axle configuration, common upgrade pathway). The combo page assembly engine selects relevant fragments deterministically and stitches them in a fixed order. Fragments are written to be standalone but to flow when combined.

**Topic guides (30–50 articles at launch, ~800–2,000 words each).** Hybrid authoring workflow per guide:

1. Tim writes a brief — title, target keyword, key points to cover, regulatory references to cite, audience notes
2. LLM produces a first draft from the brief (Claude or Qwen3.6 — Tim's choice per draft based on output preference; Qwen3.6 keeps the workflow self-hosted at zero marginal cost)
3. Tim edits substantively for voice, accuracy, fact-checking, Australian-specificity, and lived-experience details
4. Editorial review pass before publishing

Per-guide effort approximates 2 hours of Tim's time including brief, drafting orchestration, and editing. Pure LLM output without substantive editing is explicitly not acceptable — voice consistency and Google's helpful-content signals require human authorship at the editing layer.

**Editorial style guide.** Authored by Tim before the fragment corpus, treated as the first content artefact. Captures: tone (knowledgeable but not condescending; direct; calm; doesn't catastrophise), Australian-specificity (en-AU spelling, ADR/VSB14/state authority references, Australian terminology used carefully), specificity over abstraction (concrete examples, real vehicles and caravans, specific kilograms and scenarios), honesty about uncertainty (state variance, indicative-not-authoritative, data quality tiers), and an explicit list of phrases and patterns to avoid (stock content-farm transitions, hedge language without substance, generic AI-sounding prose). The style guide is a 2–3 page working document and is the first thing produced in the authoring phase.

**Topic guide categories at launch.**

- Regulatory concepts (8–10 guides): GVM, GCM, ATM, GTM, Tare, TBM, VSB14, ADR towing rules, state-by-state regulatory differences, compliance plate reading, trust tier transparency.
- State-specific guidance (8 guides, one per state and territory): AU-NSW, AU-VIC, AU-QLD, AU-WA, AU-SA, AU-TAS, AU-NT, AU-ACT — each covering licence requirements, GVM upgrade rules, towing speed limits, registration considerations, citing official state government sources.
- Accessory category guides (8–12 guides): bullbars, canopies, lithium battery basics, rooftop tents, recovery gear, water systems, solar setups, towing mirrors, tyre selection, suspension upgrades, electrical essentials, communications.
- Decision and educational content (6–10 guides): GVM upgrade decision and cost, choosing a tow vehicle for a caravan size, caravan vs camper vs hybrid, building a touring 4WD without a caravan, common towing mistakes, weighing at a public weighbridge, pre-trip safety checklist.

Specific guide titles within each category are determined during the authoring phase informed by Search Console data and forum question frequency. Authoring sequence is regulatory concepts first (highest-volume queries, most reusable content), state guidance second (state-targeted SEO unlock), accessory categories third, decision content fourth.

**Content management.** Topic guides are stored as markdown files in `src/content/guides/` with frontmatter (title, slug, description, category, tags, last_updated, regulatory_references). Fragments are stored as YAML in `src/content/fragments/` with the metadata schema for combination logic. State guidance is stored as markdown in `src/content/state-guidance/{state-code}/`. Build pipeline reads files at build time via MDX processor and generates static pages via Next.js SSG. Content updates require deployment, which is acceptable at editorial cadence (weeks, not minutes). The repo-as-CMS approach gives free version control, PR-based quality gates, and zero engineering scope at the CMS layer. An admin-panel CMS layer is a deferred enhancement available as a future phase if editorial volume grows beyond Tim's solo authoring.

**Update cadence.** Regulatory concepts reviewed annually and on legislative change. State guidance reviewed every six months. Accessory categories reviewed every 12–18 months. Decision content reviewed every 12 months with example refreshes. Tim performs quarterly review passes across all categories in the first year; cadence and ownership may split as a contributor model emerges post-launch.

**Translation-readiness.** Content directory structure and frontmatter schema support additional locales without rework. Fragment metadata uses regulatory-set codes that translate cleanly across markets. Topic guides are inherently locale-specific — a US-locale version is re-authored against US regulations, not translated. The infrastructure is locale-aware; corpus expansion to other locales is a separate workstream tied to geographic expansion.

### 9.10 Internal linking

Dense, automatic internal link graph:

- Vehicle profile links to all caravans it can tow (via combo pages)
- Caravan profile links to all vehicles that can tow it
- Accessory profile links to all vehicles it fits
- Topic guides cross-link to relevant vehicle/caravan/accessory pages
- Combo pages link to related combos (similar vehicle, similar caravan)
- State guidance pages link to upgrade paths and combos relevant to that state

Internal linking is generated from the database, not hand-maintained.

### 9.11 Performance

Core Web Vitals are an SEO ranking factor. The calculator pages need to load fast despite being rich and interactive:

- SSR/SSG for initial page render (combo pages and profile pages are statically generated with ISR)
- Calculator JavaScript bundle is code-split and deferred until the user interacts
- Schematic SVG is server-rendered for the initial state, then re-renders client-side on interaction
- Image optimisation via Next.js Image component
- Cloudflare caching for static assets

Performance targets: LCP < 1.5s, CLS < 0.1, FID < 100ms.

---

## 10. Internationalisation readiness

### 10.1 Strategic posture

At launch: Australian only. en-AU locale, AU regulations, AU vehicle/caravan/accessory data, AU primary domain (`travellingbuddy.com.au`).

Architecture is built so that future expansion (US, EU) is a configuration and data-loading exercise, not a rewrite. Step sideways, not rewrite. The cost of building this at launch is roughly 10–15% additional dev effort. The cost of retrofitting later is approximately a rewrite.

### 10.2 What's i18n-ready at launch

**Translation infrastructure.** All user-facing strings via `next-intl`. No inline English in components. Default locale en-AU. No additional locales loaded at launch.

**Unit handling.** All weights stored in kg, all distances in mm internally, all volumes in litres. UI display layer converts to imperial units when locale dictates. No raw number output without unit-aware formatting.

**Currency.** Stored as Decimal value plus ISO 4217 code. AUD at launch. UI formats per locale.

**Regulation sets.** Hierarchical, data-driven. AU-federal and AU-state-specific sets at launch. Calculator engine accepts a regulation set as input. Adding a US-federal or EU regulation set is data work, not engine modification.

**Vehicle and caravan market scoping.** Every vehicle and caravan record has a `market` field. AU at launch. User locale determines which records are searchable. Adding US-spec vehicles in the future doesn't pollute the AU catalogue.

**Multi-domain routing prepared.** Next.js middleware routes by domain. `travellingbuddy.com.au` is the active domain at launch. The `.au`, `.co`, single-L variants 301 redirect to canonical via Cloudflare. Future US/EU domains plug into the same routing pattern.

**SEO content per market.** Combo pages, profile pages, and topic guides are scoped by market. AU content lives under the AU domain. Future US content lives under a future US domain (or a `/us/` subpath, decision deferred).

### 10.3 What's NOT built at launch

- No US/EU regulation sets created
- No translations beyond en-AU
- No US/EU domains acquired
- No imperial unit display options (the toggle exists in code, defaults to off)
- No non-AU vehicle/caravan/accessory data
- No content (topic guides, state guidance) in any language other than en-AU

These all become turn-on-when-needed work. The infrastructure exists; the content does not.

---

## 11. State-by-state Australian regulations

### 11.1 Why this matters

Australian state and territory transport authorities have meaningfully different rules:

- GVM upgrade caps and certification requirements differ (QLD generally caps at 10% over OEM; NSW has different rules; some states accept SSM-certified upgrades that go higher)
- Towing speed limits vary by road class and jurisdiction
- Licence requirements at certain GCM thresholds differ
- Trailer brake requirements have state-level interpretation
- Maximum vehicle-plus-trailer length and overhang allowance vary

Capturing this is not just additional accuracy — it's a real product depth that no other Australian calculator handles.

### 11.2 How state context is captured

User's home state is part of their profile. Anonymous users default to a federal/conservative interpretation (apply the strictest rule when rules differ) with a banner: "Showing federal limits — pick your state for state-specific rules."

A state selector lives in the navbar (small "QLD ▼" indicator clickable to change). When changed, the calculator re-evaluates with the new state's regulation set.

### 11.3 What state context affects

**Yes:**
- Which GVM upgrade options are surfaced (state-legal options ranked first, with annotations)
- Recommendation language ("In QLD, GVM upgrades above 10% may require additional engineering certification")
- Compliance verdict footnotes (when a state rule affects the verdict)
- Linked guidance (state-specific URLs to authoritative sources)
- Which state guidance pages get prominent internal linking

**No:**
- Core physics (axle loads, GVM, GCM, TBM are physics and manufacturer specs, not law)
- The 10 metrics evaluated
- The verdict banner's headline conclusion (legal/over-limit on physical metrics is determined by manufacturer ratings, not state law)

State is a *contextual layer* on top of the federal compliance check, not a replacement for it.

### 11.4 SEO implication

State-specific guidance pages — `/qld/towing-rules/`, `/nsw/gvm-upgrade-rules/`, etc. — are part of the page taxonomy. They target state-specific regulatory queries and link inward to the calculator with state pre-set.

---

## 12. Technical architecture

### 12.1 Stack

**Application:** Next.js 16 (App Router). Single application handling SSR, SSG, API routes, calculator engine. TypeScript throughout.

**Database:** PostgreSQL 16 on a single host. Not CockroachDB. The calculator workload is read-dominated catalogue data with infrequent user writes — well within Postgres single-instance capacity for years of growth.

**ORM:** Prisma. Schema in `prisma/schema.prisma`. Migrations versioned in `prisma/migrations/`. Seed scripts in `prisma/seed/`.

**Cache and queues:** Redis. Used for session storage, rate limiting on submission endpoints, and BullMQ job queues (submission VLM processing, photo upload post-processing, sitemap regeneration triggers). BullMQ is in scope at launch — the VLM submission pipeline (section 7.8) requires async job processing.

**Auth:** NextAuth.js v5 with Prisma adapter. Email/password and Google OAuth. JWT sessions.

**Styling:** Tailwind CSS with the design tokens from the existing platform docs (see `/mnt/project/TravellingBuddy_Proxmox_Setup_and_Design_System_v1_0.md` Section 9). shadcn/ui components for base UI primitives.

**Charts and visualisations:** Recharts for the bar gauges. Custom SVG for the side-profile and top-down schematics (no library — direct SVG generation from React components).

**Forms:** React Hook Form + Zod for validation.

**i18n:** next-intl. All user-facing strings via `t()` calls. Translation files per locale, en-AU at launch.

**PDF generation:** Puppeteer (headless Chromium) rendering the same React components used in the calculator's right column, wrapped in a print template. See section 7.9 for the full PDF specification.

**OCR (sync, in user flow):** Tesseract.js for instant compliance plate pre-fill.

**VLM (async, moderation pipeline):** Qwen3.6-35B-A3B running on the on-premises Proxmox box across 3× 7900 XTX GPUs, served as a dedicated calculator service instance (vision-enabled, short-context) separate from Tim's existing dev-assistance instance. Reachable from the production VPS via Cloudflare Tunnel. See section 12.7 below for the AI infrastructure detail.

**Object storage:** S3-compatible — Cloudflare R2 at launch — for submission photos linked to submission records and accessed by the VLM gatekeeper pipeline.

**Email:** Resend for transactional email (auth, lead magnet, submission status notifications, catalogue-update notifications).

**Analytics:** Plausible Analytics, self-hosted on the existing VPS, for external traffic and referrer. In-product events (calculations, saves, shares, PDF downloads) write to the application database for the admin analytics dashboards (section 8.6).

**Error tracking:** Sentry, integrated into Next.js client and server.

### 12.2 What's NOT in the stack at launch

- No Fastify split. All API in Next.js route handlers.
- No CockroachDB. Postgres only.
- No Docker Swarm. Single VPS, no orchestration.
- No microservices. Modular monolith.
- No WebSockets. The calculator is request-response.
- No GraphQL. REST API where API is needed.

The lean stack is a deliberate decision. The platform vision documents (in the existing project files) describe a heavier architecture with CockroachDB clusters and Docker Swarm — that architecture is the destination for Phase 2+ when fuel polling, route planning, and real-time features arrive. The calculator does not need it and will not pre-build it.

BullMQ has moved from out-of-scope (in v2.0 of this spec) to in-scope, on the basis that the VLM submission pipeline requires async job processing. The async pattern is small and well-bounded.

### 12.3 Hosting

**Primary:** Existing AU VPS (10 vCPU, 38GB RAM, 200GB storage). Hosts the Next.js application, Postgres database, Redis, Plausible Analytics. Other client sites continue on this VPS as they currently do.

**AI inference (Proxmox):** On-premises Proxmox box (dual EPYC 7713, 1TB RAM, 3× 7900 XTX GPUs) hosts the Qwen3.6-35B-A3B model as two service instances. The calculator service instance handles VLM extraction and gatekeeper inference for submission moderation. Reachable from the production VPS via Cloudflare Tunnel — no inbound port exposure, no public IP. See section 12.7.

**Warm standby:** Tim's home Proxmox box. Receives Postgres streaming replication (asynchronous, low bandwidth). Application code deployed and ready to run. Connected to Cloudflare via Cloudflare Tunnel.

**CDN and edge:** Cloudflare in front. Caches static assets aggressively. Caches HTML for SEO pages with appropriate TTLs (combo pages, profile pages — long TTL with revalidation; calculator page — short TTL because it's interactive). Always Online enabled for cached content during origin outages. DDoS protection. SSL termination.

**Backups:** Postgres automated daily backups to S3-compatible storage (Hetzner Storage Box, Backblaze B2, or AWS S3 Sydney). Retention: 30 days. Tested restore process. Submission photos in R2 backed up via R2's native retention.

**Monitoring:** UptimeRobot or Better Stack for external uptime monitoring (60-second checks). SMS alerts to Tim. Sentry for application error tracking. Plausible for traffic monitoring. AI inference service exposes Prometheus metrics scraped by the existing monitoring VM (token throughput, queue depth, GPU utilisation).

### 12.4 Failover

**Manual failover only.** No automated DNS health checks, no active-active load balancing.

When the primary VPS is detected as down (UptimeRobot alert, or Tim notices):

1. Tim verifies the outage isn't transient (waits ~5 minutes for recovery)
2. Promotes Postgres replica on home Proxmox box to primary
3. Starts the Next.js application on the home box (already deployed, pre-configured)
4. Updates Cloudflare to route origin traffic to the home Cloudflare Tunnel
5. Verifies the calculator is accessible and the database is consistent

Total recovery time: 10–15 minutes if Tim is at a keyboard.

When the primary VPS is recovered:

1. Tim verifies primary is stable
2. Re-syncs Postgres from home box back to primary (the home box has been authoritative during the outage)
3. Updates Cloudflare to route back to primary
4. Restarts replication in the original direction (primary → home)

A written runbook captures the exact commands. Worth writing during calm operations, not during the next outage.

The AI inference service is not on the failover path — submission VLM processing degrades gracefully during AI service outages (submissions queue with Tier 1 Tesseract data and process when service returns). Not user-blocking.

**Upgrade trigger:** When traffic or revenue justifies a paid VPS warm standby (probably 6–18 months post-launch), migrate the standby off the home box onto a paid second VPS in a different data centre. This is a Phase 2 conversation; not at launch.

### 12.5 Build structure

A single Next.js project organised by feature module:

```
src/
  modules/
    calculator/      # calculator engine wrapper, recommendation engine, hooks
    catalogue/       # vehicle/caravan/accessory browse, search, filtering
    setup/           # user setup CRUD, share, PDF export, snapshot capture
    admin/           # admin panel, moderation queue, sponsor management, regulation sets
    submissions/     # community submission flows, photo upload, VLM client
    auth/            # auth wrappers, session helpers
    seo/             # page templates for SEO content (vehicle, caravan, combo, etc.)
    regulation/      # regulation set lookups, state context, versioning
  components/
    ui/              # base shadcn/ui components
    schematic/       # side-profile and top-down rig diagrams (screen + print variants)
    metrics/         # bar gauges, status banner, contributors panel
    accessory-picker/  # the accessory picker slide-over
    entity-picker/   # the vehicle/caravan picker (parameterised)
    pdf-template/    # print template components for PDF generation
  app/               # App Router pages
  content/           # markdown/YAML content (guides, fragments, state-guidance)
    guides/
    fragments/
    state-guidance/
  lib/
    db.ts            # Prisma client
    physics/         # the calculation engine (pure module)
      types.ts
      axleLoads.ts
      towBallMass.ts
      moments.ts
      verdict.ts
      recommendations.ts
      __tests__/     # comprehensive test suite
    vlm/             # VLM client SDK (OpenAI-compatible API wrapper)
    ocr/             # Tesseract.js integration
    pdf/             # Puppeteer orchestration, monochrome compatibility test
    storage/         # R2 / S3 client for photo upload
    queue/           # BullMQ job definitions
    i18n/            # next-intl configuration
  prisma/
    schema.prisma
    migrations/
    seed/
```

The `lib/physics/` module is the safety-critical core. Pure TypeScript functions. No React, no I/O, no side effects. Comprehensive test coverage with calibrated test scenarios. Changes require explicit review.

The `modules/` structure preserves extraction boundaries from the existing platform docs. If a future scaling need extracts `submissions` or `admin` into a separate service, the module is already cleanly bounded.

### 12.6 Operational baseline

Before launch:

- Cloudflare configured with caching rules, WAF rules, Always Online enabled
- Cloudflare Tunnel from VPS to Proxmox AI inference service configured and authenticated
- Postgres backups automated and tested with a real restore
- R2 bucket configured with appropriate retention and access policies
- Home Proxmox box configured with Cloudflare Tunnel and replication
- AI inference VM configured on Proxmox with GPU pass-through, ROCm, vLLM/SGLang serving Qwen3.6-35B-A3B as two service instances
- UptimeRobot configured with alerts to Tim's phone
- Sentry integrated and reporting
- Plausible installed and tracking
- Failover runbook written and rehearsed once

After launch, ongoing:

- Daily backup verification (alert if backup fails)
- Weekly check of indexation health in Google Search Console
- Monthly review of error rates in Sentry
- Monthly review of analytics in Plausible
- Quarterly review of VLM gatekeeper accuracy (spot-check sampling outcomes)
- Brand outreach and data acquisition continuing in parallel as a separate workstream

### 12.7 AI inference infrastructure

The platform runs Qwen3.6-35B-A3B (Unsloth Q4_K_XL GGUF) on the on-premises Proxmox box across 3× 7900 XTX GPUs (72GB VRAM total) as two distinct service instances:

**Service A — Coding/dev assistance.** Long-context configuration (1M tokens via YaRN), text-only mode (`--language-model-only`), tuned for Tim's agentic coding work. This service pre-dates the calculator and is unaffected by calculator workloads.

**Service B — Calculator content service.** Vision-enabled, short-context (16K), tuned for structured-extraction and gatekeeper tasks. Serves the submission VLM pipeline (section 7.8) via BullMQ jobs originating in the production VPS. Reachable via Cloudflare Tunnel from the VPS — no inbound port exposure, no public IP.

GPU pinning via `HIP_VISIBLE_DEVICES` separates the services: Service A occupies two GPUs for tensor-parallel inference with its large KV cache; Service B occupies one GPU as a single-GPU deployment.

Serving stack: vLLM or SGLang (Tim's choice based on operational fit) on ROCm 6.2+. Both services expose OpenAI-compatible API endpoints on different ports. Operational metrics (token throughput, queue depth, GPU utilisation) exposed as Prometheus metrics scraped by the existing monitoring VM.

This service is platform infrastructure spanning future workloads beyond the calculator — caravan brochure parsing, accessory product page extraction, regulatory document review, and route guide content moderation are all future use cases of the same service. The calculator is the first consumer.

---

## 13. Monetisation surfaces

### 13.1 Revenue streams at launch

1. **Google AdSense** on SEO content pages (combo pages, vehicle profiles, caravan profiles, topic guides). Not on the calculator itself or the user dashboard. Ads are display-only, contextual.

2. **Affiliate links** on accessories (with tracked clicks) and GVM upgrade kits (with tracked clicks). Embedded in recommendations, in accessory profile pages, in upgrade pathway cards.

3. **Sponsored placements** within the calculator's recommendations and the accessory picker. ACCC-compliant labelling. Sponsored placements never override fitment-quality ranking.

4. **Lead magnet PDF** for email capture. Building a mailing list for future monetisation (newsletter, direct affiliate offers).

### 13.2 Revenue streams deferred

- Booking commissions (mobile weighbridge, GVM installer, accessory fitter) — Phase 2 marketplace
- Direct product sales — Phase 6+
- Self-serve advertiser portal subscriptions — Phase 1.5+
- Caravan park / overnight stop booking commissions — Phase 5

### 13.3 Sponsored placement principles

These are non-negotiable design rules for sponsored content:

- Every sponsored placement is labelled "Sponsored" adjacent to it (ACCC requirement)
- Sponsored content is ranked within its fitment-quality tier, never above a better-matched alternative
- Sponsored accessories have the same data quality requirements as organic accessories — sponsorship doesn't bypass moderation
- "Often added with this" recommendations use honest co-occurrence data only, not pay-to-play
- Affiliate links are clearly identifiable through link styling and clear context
- The disclaimer and methodology sections explain how recommendations are ranked

These rules prioritise user trust over short-term revenue. Trust is the product's moat in this space; trading it for incremental sponsorship revenue would degrade the entire calculator's credibility.

---

## 14. Trust and moderation

The trust tier system from the existing platform docs (Section 7) carries forward unchanged at the tier level, with the integration detail captured in section 7.8:

- **Tier 0 — New User:** All submissions queued for moderation
- **Tier 1 — Contributor:** First approved submission triggers promotion. Auto-approve still requires VLM-clean assessment for low-risk content (per the two-factor gate in section 7.8).
- **Tier 2 — Trusted:** 5+ approved submissions, no rejections in 30 days, account age 60+ days. Auto-approve for VLM-clean submissions across all entity types subject to spot-check sampling at 20%.
- **Tier 3 — Moderator:** Manually assigned by Tim. Approve/reject submissions, edit-and-approve, mark-as-duplicate. Read-only catalogue access (per section 8.8).

Vehicle and caravan submissions follow the same two-factor auto-approve gate as accessories — no special "always queue" rule for these entity types now that the VLM gatekeeper provides structured assessment. The gate is "Trusted+ AND VLM clean" regardless of entity type.

Automated validation augmenting the VLM pipeline:
- Vehicle GVM/GCM cross-referenced against known manufacturer ranges for that make/model
- Caravan ATM/Tare cross-referenced against typical ranges for that body type
- Accessory weights flagged if outside plausible range for category
- Profanity filter on all text fields
- Photo presence validation (compliance plate photos required for vehicle/caravan submissions)

These run before VLM dispatch as a fast pre-filter; failures route to human review with the validation reason attached.

---

## 15. Security and compliance

- All traffic over HTTPS (enforced via Cloudflare).
- API rate limiting on submission and write endpoints (Redis-backed sliding window).
- Input validation with Zod on every API route.
- SQL injection prevention via Prisma parameterised queries.
- XSS prevention via React's default output encoding. No `dangerouslySetInnerHTML` with user content.
- CSRF protection via NextAuth's built-in tokens for auth routes; SameSite cookies elsewhere.
- Secrets in environment variables, never committed.
- Postgres bound to localhost or private network. Authentication required.
- Admin routes behind authentication with admin role check.
- AI inference endpoint reachable only via Cloudflare Tunnel from the production VPS — no public exposure.
- Rate limiting on auth endpoints to prevent credential stuffing.
- Privacy policy compliant with Australian Privacy Act 1988.
- Cookie consent: no banner needed if only Plausible (cookieless). Banner if any cookie-setting tracking is added.
- Data retention: community submissions retained indefinitely (historical value). Submission photos retained indefinitely for moderation audit. User account data deletion within 30 days of request (see section 7.10).
- ACCC-compliant labelling on all sponsored content.
- Calculator disclaimer prominent and non-dismissable on every results view.
- GVM upgrade information includes inline disclaimer about indicative pricing and licensed modifier requirement.
- Photo EXIF stripping on upload (privacy — strips GPS coordinates).

---

## 16. Performance targets

| Metric | Target | Measurement |
|---|---|---|
| Lighthouse Performance Score | ≥ 90 | Combo pages, profile pages, calculator |
| Largest Contentful Paint | < 1.5s | 4G connection |
| Cumulative Layout Shift | < 0.1 | All pages |
| First Input Delay | < 100ms | Calculator interactions |
| Calculator recalculation latency | < 10ms | Slider drag, accessory toggle |
| Vehicle catalogue search | < 200ms | With Postgres index |
| Schematic SVG render | < 50ms | From state change to painted update |
| PDF generation (saved setup, cached) | < 500ms | Server-side cache hit |
| PDF generation (cold) | < 3s | Server-side render and return |
| Combo page initial render | < 1.5s | SSG + Cloudflare cache hit |
| VLM extraction round-trip (async, non-blocking) | < 60s | BullMQ job p95, Service B |

---

## 17. What this document does not cover

The following are referenced but not detailed here. They live in companion documents or are tracked as open decisions:

- **Build sequence and task breakdown** — `TravellingBuddy_Calculator_v2_Build_Plan.md`
- **Outstanding decisions** — `TravellingBuddy_Calculator_v2_Open_Decisions.md`
- **Brand outreach materials and data partnership templates** — Tim's parallel workstream, not engineering
- **Visual design specifics beyond design tokens** — design tokens in existing platform doc Section 9; component-level design happens during build
- **Phase 2+ platform features** — existing platform docs are the reference

---

*— End of Master Specification —*
