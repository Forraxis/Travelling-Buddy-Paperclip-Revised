# TravellingBuddy Calculator v2 — Year-Range Variant Schema PATCH

**Version:** 1.0
**Date:** May 2026
**Status:** Draft for review before integration

---

## Context

This patch resolves Open Decision #1 (year-range vs single-year variant schema) in favour of **year-range canonical** (option 2 from the open-decisions framing). The decision affects Build Plan tasks 1.2 and 1.3, scrapers in Phase 2, admin CRUD in Phase 11, SEO page templates in Phase 12, and slug strategy in spec section 9.2.

The reasoning, in short: the per-year approach inflates combo pages (the headline SEO bet) by 5–10× with zero unique content per duplicated URL, which is the exact pattern Google's helpful-content / spam-policy direction has been demoting since 2024. Year-range consolidates link equity, produces a more authoritative reference page per spec-equivalent vehicle, and captures per-year query volume through title/H1/FAQ structure rather than URL fragmentation. Part 1 below sketches that page structure to verify the per-year capture claim is achievable in practice.

Phase 1 schema is complete in the Build Plan but no catalogue data has been seeded, so this is an empty-table migration — low risk.

---

## Part 1: How a year-range page captures per-year query volume

This part exists so that the SEO claim — "you don't need URL fragmentation to capture per-year search volume" — is verifiable rather than handwave. The structure below is what a year-range vehicle profile page needs to look like for the claim to hold. If the structure is sound, the per-year capture is achieved through on-page signals; if it isn't, the schema decision needs revisiting.

### 1.1 Worked example

Subject: 2018–2024 Toyota Hilux SR5 Dual Cab 4×4 Auto. Spec is identical across these seven model years; this is the canonical "duplication is real" case.

**URL:** `/vehicles/toyota/hilux/sr5-dualcab-4x4-auto-2018-2024/`

**Title tag:**
> Toyota Hilux SR5 Dual Cab 4×4 Auto (2018–2024) — GVM, GCM & Towing Specs | TravellingBuddy

**Meta description:**
> Full specs and towing capacity for the 2018, 2019, 2020, 2021, 2022, 2023, and 2024 Toyota Hilux SR5 Dual Cab 4×4 Auto. GVM 3050kg, GCM 5850kg, max tow 3500kg. Run your setup through the calculator.

**H1:**
> Toyota Hilux SR5 Dual Cab 4×4 Auto — Specifications (2018–2024)

**Lead paragraph (first 160 characters carry weight):**
> The Toyota Hilux SR5 Dual Cab 4×4 Auto produced between model years 2018 and 2024 shares identical regulatory specifications. The figures below apply if your Hilux is a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 model.

The explicit per-year enumeration in plain prose is the load-bearing signal. Google's matching gives weight to year tokens appearing in proximity to the variant name, and the lead paragraph satisfies this cleanly without keyword-stuffing.

**Spec table:** GVM, GCM, kerb, max tow, GAWR-F, GAWR-R, wheelbase, max TBM, fuel tank, dimensions. Single canonical block.

**H2: Which Hilux SR5 years does this apply to?**

Body covers the year range explicitly, plus a "different generation? See [link to 2015-2017 page]" link and "different variant? See [link to SR5 manual / SR5 single cab / etc.]". This is also where year-specific anomalies live if a range is split: "Note: 2021 models manufactured between January and June carry a different max TBM rating — see [2021 H1 SR5 page]." The vast majority of pages won't have this.

**FAQ section with FAQPage schema:**

The FAQ is doing the heavy lifting for per-year capture. It's also rendered as `FAQPage` JSON-LD so eligible answers can show as featured snippets keyed to per-year queries.

```jsonld
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the towing capacity of the 2024 Toyota Hilux SR5 Dual Cab 4×4 Auto?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The 2024 Toyota Hilux SR5 Dual Cab 4×4 Auto has a maximum braked towing capacity of 3,500 kg and a maximum tow ball download (TBM) of 350 kg. These figures are unchanged from the 2018 model year onward."
      }
    },
    {
      "@type": "Question",
      "name": "What is the GVM of the 2023 Toyota Hilux SR5 Dual Cab 4×4 Auto?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The 2023 Toyota Hilux SR5 Dual Cab 4×4 Auto has a GVM (Gross Vehicle Mass) of 3,050 kg. This applies to all model years 2018 through 2024."
      }
    }
    // ... one Q per (year × headline metric) combination, capped at ~12-15 entries
  ]
}
```

The FAQ entries are templated and generated programmatically — one per (year, headline-metric) pair, capped at a sensible number (the spec's existing per-page FAQ budget). Year tokens explicitly enumerated; metric values consistent across them; "unchanged from X onward" language reinforces the canonical range.

**Year selector affordance (UI + content signal):**

Above the spec table, a small inline component:
> **Which year is your Hilux?** [2018] [2019] [2020] [2021] [2022] [2023] [2024]
>
> All these years share the same specifications.

User-facing: confirms to the visitor they're on the right page. Bot-facing: the year tokens are now in the visible content alongside the variant name.

**Structured data — Vehicle schema:**

```jsonld
{
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": "Toyota Hilux SR5 Dual Cab 4×4 Auto",
  "brand": { "@type": "Brand", "name": "Toyota" },
  "model": "Hilux SR5",
  "vehicleConfiguration": "Dual Cab 4×4 Auto",
  "vehicleModelDate": "2024",
  "productionDate": "2018/2024",
  "weight": { "@type": "QuantitativeValue", "value": 2110, "unitCode": "KGM" },
  "vehicleEngine": { "@type": "EngineSpecification", "fuelType": "Diesel" }
  // ... regulatory fields
}
```

`productionDate` carries the range as ISO 8601 interval. `vehicleModelDate` carries the most recent year (the value the variant_id resolves to per spec section 7.5). One Vehicle entity, range-aware.

**Internal linking:**

- To adjacent ranges: "Older Hilux SR5? See the [2015–2017 SR5 page]" (auto-generated from query: same model, same variant-name, year_to < this.year_from, closest match)
- To variant siblings: "Different variant? [SR5 Manual] [SR5 Single Cab] [SR-5 Extra Cab]"
- To combo pages: "[X] caravans this Hilux can tow"
- To upgrade content: "GVM upgrade options for the Hilux SR5"
- Calculator CTA pre-filled with this variant_id

**Canonical:**

`<link rel="canonical" href="https://travellingbuddy.com.au/vehicles/toyota/hilux/sr5-dualcab-4x4-auto-2018-2024/">`

Self-canonical. Per-year hash anchors (`#year-2024`) do not produce alternate URLs.

### 1.2 Why this captures per-year volume

A query like "2021 Hilux SR5 towing capacity" reaches Google's matcher. The matcher looks for documents that contain "2021", "Hilux", "SR5", and "towing capacity" with strong proximity. The page above contains:

- "2021" in title meta description, lead paragraph, year selector, and FAQ entry
- "Hilux SR5 Dual Cab 4×4 Auto" in title, H1, lead, table headers, FAQ entries
- "towing capacity" in title, H1, FAQ entry, and the spec table label
- The figure 3,500 kg at the top of the spec table, in the FAQ answer, and in the structured data

Proximity is tight in the FAQ Q/A pair which is structured as a clean question-answer match for the search query. That FAQ entry is also eligible for featured-snippet display, which is the highest-value SERP placement.

The mechanism that *would* fail per-year capture: a page that mentions only "2018–2024" as a range and never enumerates years individually. Google does match year ranges, but less reliably than explicit year tokens. The patch above ensures every individual year appears in plain text and structured data.

### 1.3 Edge case: open-ended ranges (current production)

For variants in current production (e.g. 2018–present), the schema carries `is_current_production = true` and `year_to` reflects the highest known model year. The page renders:

- Title: "Toyota Hilux SR5 Dual Cab 4×4 Auto (2018–present) — ..."
- Slug: `sr5-dualcab-4x4-auto-2018-current`
- Lead paragraph enumerates years up to and including current model year, with " and current production models" suffix
- FAQ includes the current model year explicitly

When the variant is superseded, an admin action sets `is_current_production = false` and locks `year_to`. The slug regenerates to a closed-range form (e.g. `sr5-dualcab-4x4-auto-2018-2024`), with a 301 redirect from the old `-current` slug. Audit log captures the change.

When `year_to` advances (e.g. 2018–2024 becomes 2018–2025 on confirmed model-year carryover), the slug regenerates similarly with 301 from the prior slug. This is rare — once or twice a year per current-production variant.

### 1.4 Closing on the SEO mechanism

The on-page structure above gives the page a stronger reference quality than a per-year alternative for two reasons. First, the comprehensive coverage range and explicit year enumeration mean the page reads as authoritative on the variant across its production span — Google's measurable engagement signals (dwell time, scroll depth, click-through to calculator) are higher on comprehensive references than on thin per-year pages. Second, the consolidated link equity from internal links (combo pages, fragments, topic guides) all pointing to one URL produces a higher-authority page than seven thinly-linked alternatives.

The trade-off is the ~5–15% of per-year query traffic that may prefer a year-specific URL over a year-range URL even when both rank. That's the bet. The combo page consolidation gain — measured in absolute page count reduction and content-thinness elimination — outweighs it cleanly.

---

## Part 2: Patches by document

### 2.1 Open Decisions — move item #1 to resolved

**Action:** Remove item #1 from the "Pending strategic / design decisions" section. Add the following entry to the "Resolved decisions" section (or whatever the resolved section is named in the current document).

**Resolved entry text:**

> ✅ **Year-range vs single-year variant schema:** Year-range canonical (option 2). `VehicleVariant` and `CaravanVariant` carry `year_from`, `year_to`, and `is_current_production` fields. Postgres exclusion constraint prevents overlapping ranges per (model, variant-name) tuple. Year-specific anomalies handled by range-splitting at admin level. Saved rigs reference `variant_id` regardless and are unaffected. Slug pattern uses `{name}-{yearFrom}-{yearTo}` for closed ranges and `{name}-{yearFrom}-current` for in-production variants. Picker spec-equivalence grouping (spec section 7.5) becomes near-no-op for the common case but remains as defensive logic for anomaly-split rows. SEO page structure handles per-year query capture via title, lead-paragraph year enumeration, year-selector affordance, and FAQPage schema entries — see spec section 9.X (added in this patch). See `TravellingBuddy_Calculator_v2_YearRange_Schema_PATCH.md` for detailed reasoning and the patch set this resolution applied.

### 2.2 Master Spec section 5.1 — replace variant keying language

**Locate:** The paragraph beginning "**Vehicle hierarchy:** `VehicleMake` → `VehicleModel` → `VehicleVariant`. The variant is the unit of all regulatory data. Variants are keyed by year × specification..."

**Replace with:**

> **Vehicle hierarchy:** `VehicleMake` → `VehicleModel` → `VehicleVariant`. The variant is the unit of all regulatory data. Variants are keyed by specification across a contiguous model-year range. The variant carries:
>
> - `year_from`, `year_to` (inclusive integer years), `is_current_production` (boolean)
> - GVM, GCM, kerb weight, max towing capacity
> - Front axle limit (GAWR-F), rear axle limit (GAWR-R)
> - Wheelbase (mm)
> - Front overhang, rear overhang, total length
> - Fuel tank capacity
> - Body type (dual-cab ute, wagon, troopcarrier, etc.)
> - Drivetrain (4×4, 4×2, AWD)
> - Transmission (manual, automatic)
> - Fuel type
> - Provenance and confidence (verified, estimated, community)
> - Saved-setup snapshot fields used by section 7.10 (Account and saved-rig system) for graceful catalogue removal handling
>
> A unique constraint enforces non-overlapping year ranges per `(model_id, variant_name)` tuple via a Postgres exclusion constraint. Year-specific anomalies (e.g. a one-year max TBM bump) are modelled by splitting a range into two or more rows with the anomaly year(s) carrying their own row.

**Apply the same change to caravan hierarchy paragraph immediately following**, replacing year-keyed wording with `year_from` / `year_to` / `is_current_production` and adding the same exclusion constraint note.

### 2.3 Master Spec section 7.5 — soften spec-equivalence grouping language

**Locate:** The paragraph beginning "**The variant list.** Filter chips run above the variant rows..."

**Within that paragraph, replace:**

> Variant rows are spec-equivalence-grouped at presentation time: rows sharing model, variant name, and all regulatory fields (GVM, GCM, kerb, max tow, GAWR-F, GAWR-R, wheelbase, max TBM) are presented as one row spanning their inclusive year range. The underlying variant_id resolved on selection is the most recent year in the range, unless the user expands an inline year picker on rows where year-specific selection is needed for confirmation. Spec-equivalence grouping is a presentation-layer aggregation — the canonical `VehicleVariant` schema is unchanged by it. (Whether the schema itself should adopt year ranges is a separate decision tracked in open decisions.)

**With:**

> Variant rows display the variant's canonical year range (`year_from`–`year_to`, or `year_from`–present for current-production variants). For variants with split ranges due to year-specific anomalies (e.g. a one-year TBM bump), the picker presents adjacent ranges as separate rows; the user selects the row covering their model year. A spec-equivalence grouping pass is retained as defensive logic in the variant-list query for cases where two adjacent ranges share regulatory data after the anomaly year — these are visually merged in the picker for cleanliness but remain separate canonical rows. Selection resolves to a single `variant_id`; saved rigs and calculations reference this regardless.

### 2.4 Master Spec section 9.2 — update slug examples and add model-level page type

**Locate:** The bullet "**Vehicle profile pages** — `/vehicles/{make-slug}/{model-slug}/{variant-slug}/`. Example: `/vehicles/toyota/hilux/sr5-2024/`. ..."

**Replace example URL with:** `/vehicles/toyota/hilux/sr5-dualcab-4x4-auto-2018-2024/`

**Add immediately after the slug example:**

> Variant slug rule: `{variant-name-slug}-{yearFrom}-{yearTo}` for closed ranges; `{variant-name-slug}-{yearFrom}-current` for current-production variants. When a variant is superseded or its `year_to` advances, the slug regenerates and a 301 redirect is created from the prior slug. Slug changes are audit-logged.

**Apply the same patch to the caravan profile pages bullet** (use a caravan example such as `/caravans/jayco/journey/journey-21-65-2021-2024/`).

**For combo pages**, update the example to use range-form variant slugs:

> `/can-a/toyota-hilux-sr5-dualcab-4x4-auto-2018-2024/tow/jayco-journey-21-65-2021-2024/`

**Add two new page-type bullets to section 9.2**, inserted immediately after the caravan profile pages bullet (and before the combo pages bullet):

> **Vehicle model-level pages** — `/vehicles/{make-slug}/{model-slug}/`. Example: `/vehicles/toyota/hilux/`. One per vehicle model. Shows all variants of the model grouped by variant-name, with each variant displayed as a row showing year range and key specs, and linking to its variant profile page. Targets generation-agnostic queries like "[make] [model] specs", "[make] [model] towing capacity", "[make] [model] variants comparison". Also serves as the destination for the "see all variants" overflow link from variant profile pages (per section 9.4).
>
> **Caravan model-level pages** — `/caravans/{make-slug}/{model-slug}/`. Example: `/caravans/jayco/journey/`. Same structure as vehicle model-level pages, applied to caravans.

**Note for integration:** Make-level pages (`/vehicles/{make-slug}/`) are intentionally NOT added in this patch. Make-level URLs that resolve via direct exploration should 404 or redirect to the make-filtered Browse view in the picker; SEO value of make-level pages is low for the target audience (people search for specific models, not whole brands) and the duplication-of-purpose with the picker's Browse mode would be high. This decision is not surfaced as an open question — it's resolved by exclusion. If make-level pages become desirable post-launch based on Search Console signals, they can be added then.

### 2.5 Master Spec — new subsection 9.X on year-range page structure

**Insert as new subsection after 9.3** (Page content structure), titled "9.4 Year-range page structure for per-year query capture" — and renumber subsequent subsections accordingly (9.4 Pre-fill mechanism → 9.5, 9.5 Plausibility filter → 9.6, etc.).

**Subsection content:**

> Vehicle and caravan profile pages cover variants whose canonical schema spans a contiguous model-year range (see section 5.1). Per-year search query volume — searches like "2021 Hilux SR5 towing capacity" rather than "Hilux SR5 towing capacity" — is captured through on-page structure rather than URL fragmentation. Each profile page must include:
>
> - **Title tag** containing make, model, variant, and year range in `(year_from–year_to)` or `(year_from–present)` form
> - **Meta description** explicitly enumerating each year covered (or stating "and current production models" for in-production variants), plus headline regulatory figures
> - **H1** containing make, model, variant, and year range
> - **Lead paragraph** explicitly enumerating each year covered. Plain-prose enumeration ("if your Hilux is a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 model") is the load-bearing signal for per-year query matching
> - **Year selector affordance** above the spec table — small inline component listing each covered year as a visual chip set with a "all these years share the same specifications" caption
> - **FAQ section with FAQPage JSON-LD** containing question-answer pairs keyed to per-year, per-headline-metric combinations. Capped at 12–15 entries per page. Selection priority: most-recent-year × each headline metric, then earliest-year × each headline metric, then middle years × headline metrics distributed across remaining slots. Each entry's question contains the year and metric tokens; each answer states the figure and reinforces the canonical range with phrasing such as "unchanged from 2018 onward"
> - **Vehicle / Vehicle-derived JSON-LD** with `productionDate` carrying the range as ISO 8601 interval, `vehicleModelDate` carrying the most recent year
> - **Adjacent-range internal links** to older / newer same-variant-name ranges (one per direction maximum; older = same model_id + same name + year_to < this.year_from, take maximum year_to; newer = same model_id + same name + year_from > this.year_to, take minimum year_from)
> - **Variant sibling internal links** under a hybrid model: prominent links to siblings whose year coverage overlaps with this variant's range (same model_id + different name + range overlap on at least one year); plus a "see all variants" overflow link to the model-level page showing full variant history regardless of year overlap
> - **Self-canonical** link with no per-year alternate URLs
>
> **Combo pages** inherit the year-range structure on both the vehicle and caravan sides. Specifically:
>
> - **Title:** `Can a {Make} {Model} {Variant} ({yearFromV}–{yearToV|present}) tow a {CaravanMake} {CaravanModel} {CaravanVariant} ({yearFromC}–{yearToC|present})?`
> - **Lead paragraph:** cross-product year enumeration of both sides in plain prose ("This combination applies to a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 Hilux paired with a 2021, 2022, 2023, or 2024 Journey 21.65.")
> - **FAQ section:** per-(year-pair, verdict-aspect) entries within the same 15-entry cap. Selection priority: (most-recent vehicle year × most-recent caravan year) × each verdict-aspect (GVM headroom, GCM headroom, towing capacity, TBM verdict), then (most-recent vehicle year × each other caravan year) × headline verdict-aspect, then (each other vehicle year × most-recent caravan year) × headline verdict-aspect, then mid-range pairs × headline verdict-aspect distributed evenly until cap is reached
>
> The same structural template applies to caravan profile pages, with the headline metrics adjusted (ATM, GTM, TBM, body length).
>
> **Model-level pages** (vehicle and caravan, per section 9.2) follow a different page structure since they aggregate multiple variants:
>
> - **Title:** `{Make} {Model} — All Variants, Specifications & Towing Capacity` (vehicles) or `{Make} {Model} — All Variants and Specifications` (caravans)
> - **Meta description:** Brief model overview with the count of variant ranges covered
> - **H1:** `{Make} {Model}`
> - **Lead paragraph:** Brief model context — when first introduced (earliest `year_from` across all variants), body types available, generation context if known. No per-year enumeration at the model level (that's the variant pages' job)
> - **Variant table:** All variants grouped by variant-name, sorted within each group by `year_from` descending. Each row shows variant name, year range (in `{yearFrom}–{yearTo}` or `{yearFrom}–present` form), key headline specs (GVM, GCM, max tow for vehicles; ATM, GTM, TBM for caravans), and a link to the variant profile page
> - **Internal links:** to the most popular combo pages featuring any variant of this model, to relevant accessory category pages, to topic guides covering this model's segment
> - **Calculator CTA:** Links to `/calculator/` with no pre-fill (no specific variant to pre-select at the model level)
> - **JSON-LD:** `ItemList` of `Vehicle` entities, one per variant, with each variant's `productionDate` interval
> - **Self-canonical** link
>
> Model-level pages capture generation-agnostic queries that variant profile pages would not rank well for ("Toyota Hilux specs" without a year or trim qualifier). They also provide the landing destination for the "see all variants" overflow link from variant profile pages.

### 2.6 Build Plan task 1.2 — vehicle entity schema

**Locate:** Task 1.2 deliverables list. The bullet beginning "  - `VehicleVariant` model: id, modelId, year, name, slug, GVM (kg)..."

**Replace with:**

> - `VehicleVariant` model: id, modelId, year_from (int), year_to (int), is_current_production (boolean, default false), name, slug, GVM (kg), GCM (kg), kerb weight (kg), max towing capacity (kg), front axle limit (kg), rear axle limit (kg), wheelbase (mm), front overhang (mm), rear overhang (mm), total length (mm), max tow ball download (kg), fuel tank capacity (L), fuel type enum, market enum (default 'AU'), created_at, updated_at
> - Validation: `year_to >= year_from`; if `is_current_production` is true, `year_to` reflects the highest known model year and must be `<=` current calendar year + 1
> - Postgres exclusion constraint preventing overlapping year ranges per `(model_id, name)`:
>
> ```sql
> ALTER TABLE "VehicleVariant"
> ADD CONSTRAINT no_overlapping_year_ranges
> EXCLUDE USING gist (
>   "modelId" WITH =,
>   "name" WITH =,
>   int4range("year_from", "year_to" + 1) WITH &&
> );
> ```
>
> (Requires `btree_gist` extension. Migration must enable it: `CREATE EXTENSION IF NOT EXISTS btree_gist;`)

**Update the migration name** to `vehicle-entities-year-range`.

**Add to "Manual review questions":**

> - Is the `btree_gist` extension enabled?
> - Does the exclusion constraint reject an attempt to insert an overlapping range (test by inserting two rows with year_from=2018,year_to=2024 and year_from=2022,year_to=2025 for the same model+name — the second should fail)?
> - Is `is_current_production` properly defaulting to false?

### 2.7 Build Plan task 1.3 — caravan entity schema

**Apply the equivalent changes** to the `CaravanVariant` model definition: replace `year` with `year_from`, `year_to`, `is_current_production`. Add the same exclusion constraint scoped to `(modelId, name)` for caravans. Update migration name to `caravan-entities-year-range`. Add equivalent manual-review questions.

### 2.8 Build Plan Phase 2 — catalogue scraper guidance

**Add a note to the Phase 2 introduction** (or to the relevant scraper task once Phase 2 tasks are defined):

> Scrapers extract coverage range as a first-class output. Where a manufacturer source publishes specifications under a single page covering multiple model years (the common case for Toyota, Isuzu, Mazda truck/ute pages), the scraper extracts `year_from`, `year_to`, and a flag indicating whether the page implies current production. Where specifications change mid-range (rare; typically captured in a model's revision notes or a sub-page), the scraper emits multiple variant rows representing the split. Single-year scrape outputs are valid (year_from = year_to) for cases where the source publishes year-by-year detail, but the catalogue layer's deduplication pass collapses adjacent identical rows into a range during ingestion review.

### 2.9 Build Plan Phase 11 — admin CRUD additions

**Add to Phase 11's variant CRUD task scope:**

> - Variant edit form exposes `year_from`, `year_to`, and `is_current_production` as discrete fields with validation per spec 5.1
> - "Split this range" admin action: takes a year within the variant's range and produces two or three new variant rows (before-anomaly, anomaly-year(s), after-anomaly), with regulatory data initially copied from the source row for editor review
> - "Advance year_to" admin action: increments `year_to` on a current-production variant (typical use: new model year confirmed identical to prior year). Regenerates slug; creates 301 redirect from prior slug; audit-logs the change
> - "Close current production" admin action: sets `is_current_production = false`, locks `year_to`, regenerates slug from the `-current` form to the closed-range form, creates 301 redirect, audit-logs
> - Overlap validation on save: relies on the database exclusion constraint; UI surfaces the constraint error in a clear way ("This range overlaps with an existing variant covering YYYY–YYYY")

### 2.10 Build Plan Phase 12 — page template guidance

**Add to Phase 12's vehicle and caravan profile page template tasks:**

> Vehicle and caravan profile page templates must implement the per-year query capture structure per spec section 9.4. Specifically:
>
> - Title, H1, meta description, lead paragraph generation must enumerate each year in the variant's range explicitly (no "2018–2024" alone in lead-paragraph plain text — must include "2018, 2019, 2020, 2021, 2022, 2023, and 2024" as enumeration)
> - Year selector affordance component renders chips for each year covered
> - FAQ generator produces (year × headline-metric) entries up to the 12–15 entry cap; selection priority order per spec section 9.4
> - JSON-LD generators produce both FAQPage and Vehicle entities, with `productionDate` set to the ISO 8601 interval
> - Adjacent-range link queries follow the heuristic in spec section 9.4 (one per direction maximum)
> - Variant sibling links use the hybrid model: strict-overlap siblings displayed prominently, "see all variants" overflow link to the model-level page
>
> Combo page templates inherit this structure on both vehicle and caravan halves. Title format, lead-paragraph cross-product enumeration, and FAQ entry priority order per spec section 9.4.

**Add new Phase 12 sub-task: Model-level page templates**

**Phase:** 12
**Estimated duration:** 4–6 hours
**Depends on:** Phase 1 catalogue schema (year-range), Phase 2 catalogue data layer

**Context:** Model-level pages (`/vehicles/{make}/{model}/` and `/caravans/{make}/{model}/`) aggregate all variants of a model into a single landing page. They capture generation-agnostic search queries and serve as the destination for the "see all variants" overflow link from variant profile pages. Page structure per spec section 9.4 (model-level pages subsection).

**Deliverables:**
- `src/app/vehicles/[make]/[model]/page.tsx` route with SSG
- `src/app/caravans/[make]/[model]/page.tsx` route with SSG
- Model-level page template component (parameterised by entity type)
- Variant aggregation query: groups all variants of the given model by variant-name, sorts within group by `year_from` descending
- Variant table component rendering name, year range (closed or `-present` form), headline specs, and link to variant profile page
- Lead paragraph generator using model-level data (earliest `year_from`, body types covered, variant count)
- Internal links generator for popular combo pages and accessory categories
- JSON-LD generator producing `ItemList` of variant entities
- generateMetadata producing title, description, canonical
- Sitemap entry generation for model-level URLs in the secondary sitemap (per spec section 9.6 tiering)

**This task does NOT:**
- Implement per-variant detail rendering (that's the variant profile page task)
- Add admin UI for managing model-level page content (the page is purely generated from catalogue data)
- Implement make-level pages (`/vehicles/{make}/`) — explicitly out of scope per spec section 9.2

**Acceptance criteria (mechanical):**
- All variant rows render with correct year-range formatting
- Variants are correctly grouped by variant-name and sorted by year_from descending within each group
- "See all variants" links from variant profile pages resolve correctly to the model-level page
- Sitemap includes model-level URLs
- `npm run build` and `npm run type-check` succeed

**Manual review questions:**
- Does the variant table render sensibly for models with high variant counts (e.g. Hilux with all body/drivetrain/transmission combinations across multiple generations)?
- Is the lead paragraph reading naturally for both old discontinued models and current-production models?
- Are popular combo page links surfacing the most-trafficked combos (or sensible defaults pre-launch)?

---

## Part 3: Migration approach

Phase 1 schema is complete in the Build Plan but no catalogue data has been seeded. The migration is therefore an empty-table ALTER pattern, low risk:

1. Enable `btree_gist` extension
2. `ALTER TABLE` to add `year_from`, `year_to`, `is_current_production` columns
3. (No backfill needed — empty table)
4. `ALTER TABLE` to drop `year` column
5. Add the exclusion constraint
6. Update slug generation logic (Phase 12 dependency, but defines slug at insertion time)
7. Regenerate Prisma client; rerun type-check and build

If any seed data has been inserted for development purposes, the backfill is trivial: `year_from = year, year_to = year, is_current_production = false` per row, then drop `year`. The exclusion constraint adds cleanly because no overlaps exist by construction.

---

## Part 4: Resolved decisions

The following decisions were made by Tim in the design session and are integrated into this patch's instructions above. Recorded here for traceability.

### 4.1 Current production status encoding

**Decision:** Explicit `is_current_production` boolean column on `VehicleVariant` and `CaravanVariant`.

**Rationale:** More explicit than a sentinel `year_to` value (NULL or 9999). Slug-generation logic reads cleaner. The extra column cost is negligible. NULL semantics for "open-ended range" would conflict with the exclusion constraint's `int4range` semantics (which requires a defined upper bound).

**Implementation note:** The exclusion constraint uses `int4range("year_from", "year_to" + 1) WITH &&`, which requires a non-null `year_to`. For current-production variants, `year_to` reflects the highest known model year and advances when a new model year is confirmed identical (see 4.2 below). The `is_current_production` flag controls slug form and page-content rendering only.

### 4.2 Slug pattern for current-production variants

**Decision:** Use `-{yearFrom}-current` slug form for variants with `is_current_production = true`. Slug remains stable as `year_to` advances annually. A single 301 redirect is created at end-of-production when the slug regenerates from `-current` form to closed-range form.

**Rationale:** Stability of URL through a variant's production life keeps inbound link authority concentrated. Annual 301 churn (under an explicit-year_to slug pattern) would be gratuitous and accumulates small authority losses across the catalogue. URL-content drift (under a never-regenerate pattern) erodes trust over time. The single 301 at end-of-production is unavoidable but small.

**Implementation note:** Three slug events to handle:

1. **`year_to` advances on a current-production variant** (e.g. 2024 → 2025 confirmed identical): slug does not change. No 301.
2. **Production closes** (admin sets `is_current_production = false`, locks `year_to`): slug regenerates from `-{yearFrom}-current` to `-{yearFrom}-{yearTo}`. 301 from old to new. Audit-logged.
3. **Closed-range variant gets `year_from` extended retroactively** (rare; admin merges an earlier model year confirmed identical): slug regenerates with new `year_from`. 301 from old to new. Audit-logged.

Apply equivalent logic to caravan variants.

### 4.3 FAQ entry cap per profile page

**Decision:** Default cap of 12–15 entries per profile page. Combo pages share the same cap.

**Rationale:** Sufficient to cover headline metrics across each year in typical variant ranges (5–7 years × 2–3 metrics fits within 15 entries). Below ~10 entries leaves significant per-year query volume uncaptured; above ~20 entries dilutes individual entry signal and risks Google treating the FAQ as low-quality bulk.

**Implementation note:** FAQ generation algorithm priority order for selection within the cap:

For single-entity (vehicle or caravan) profile pages:
1. Most-recent-year × each headline metric (typically 4–5 entries: GVM, GCM, max tow, TBM for vehicles; ATM, GTM, TBM, body length for caravans)
2. Earliest-year × each headline metric
3. Middle years × headline metrics, distributed evenly across remaining slots

For combo pages — see 4.5 below.

### 4.4 Adjacent-range and variant-sibling linking heuristics

**Decision:** Hybrid model — strict overlap for prominently-displayed sibling links, with a "see all variants" overflow link to a model-level page covering full variant history.

**Rationale:** Visible link list stays relevant to the user's likely concurrent interest (a 2024-era visitor wants to see variants they could actually buy alongside the current variant, not 2010-era discontinued models). The overflow link satisfies completeness without cluttering the primary list.

**Implementation note:** Two link categories generated per profile page.

**Adjacent range (older/newer generation, same variant-name):**
- Older: `same model_id` AND `same name` AND `year_to < this.year_from` → take row with maximum `year_to` (closest predecessor).
- Newer: `same model_id` AND `same name` AND `year_from > this.year_to` → take row with minimum `year_from` (closest successor).
- One link per direction maximum.

**Variant siblings (same model, different variant-name) — strict overlap:**
- `same model_id` AND `name <> this.name` AND `int4range(year_from, year_to + 1) && int4range(this.year_from, this.year_to + 1)` (range overlap on at least one year).
- Display all matching siblings in primary link list.

**Variant siblings overflow link:**
- Always present if any same-model variants exist outside the strict-overlap set.
- Links to a model-level page (e.g. `/vehicles/toyota/hilux/`) showing full variant history for the model.
- Model-level pages are added to the spec's section 9.2 page-type enumeration as part of this patch (see section 2.4) and have a corresponding Phase 12 sub-task. Make-level pages (e.g. `/vehicles/toyota/`) are explicitly NOT added — see section 2.4 rationale.

### 4.5 Combo page year-pair handling

**Decision:** Both lead-paragraph cross-product enumeration AND selective year-pair FAQ entries within the 15-entry cap.

**Rationale:** Lead paragraph captures plain-prose per-year matching for both sides of the combo. FAQ entries capture per-(year-pair) query volume where high-priority pairings warrant individual treatment. The cap forces selectivity, which prevents combo pages from inflating to thin-content territory.

**Implementation note:**

**Title format:** `Can a {Make} {Model} {Variant} ({yearFromV}–{yearToV|present}) tow a {CaravanMake} {CaravanModel} {CaravanVariant} ({yearFromC}–{yearToC|present})?`

**Lead paragraph cross-product enumeration:** Each side's year list enumerated in plain prose. Example: "This combination applies to a 2018, 2019, 2020, 2021, 2022, 2023, or 2024 Hilux paired with a 2021, 2022, 2023, or 2024 Journey 21.65."

**FAQ entry priority order for combo pages:**
1. (most-recent vehicle year, most-recent caravan year) × each combo verdict-aspect (GVM headroom, GCM headroom, towing capacity, TBM verdict). Typically 4 entries.
2. (most-recent vehicle year, each other caravan year) × headline verdict-aspect (typically GCM headroom, the most query-attractive combo aspect).
3. (each other vehicle year, most-recent caravan year) × headline verdict-aspect.
4. Backfill remaining slots with mid-range (year, year) pairs × headline verdict-aspect, distributed evenly.

The selection algorithm caps at 15 entries total. The fragment-assembly engine remains responsible for the prose content of each entry (per spec section 9.3); this patch only specifies the entry selection heuristic.

---

## Part 5: Constraints for the integration agent (Paperclip)

When this patch is handed to Paperclip for integration into the canonical documents:

- **Do not introduce new design decisions beyond those captured here.** If ambiguity arises during integration — a section that doesn't fit cleanly, a cross-reference that resolves to nothing, a contradiction between this patch and existing content — surface the ambiguity as a question to Tim rather than resolving autonomously.
- **Do not modify Phase 0 completion status** in the Build Plan. Phase 1 schema tasks are being modified in place per this patch, which is expected.
- **Do not rewrite or paraphrase the patch text.** Use it as-authored, with only formatting adjustments needed to match the existing document conventions (heading levels, list styles, code-block fence style).
- **Do not preemptively start engineering work.** This is a documentation pass only. No code changes, no schema migrations, no implementation tasks.
- **Do not resolve any new design decisions.** All design decisions for this patch are captured in Part 4 (resolved decisions) and threaded into the relevant patch sections. If a question arises during integration that isn't already addressed, surface it to Tim rather than resolving autonomously.
- **Do not modify any of Open Decisions items #2 onward.** Only item #1 moves to resolved.
- **Do not modify the master architecture overview document.** The schema-level details live in the Calculator v2 spec and build plan. Master architecture overview is unaffected by this patch.

---

## Part 6: Acceptance criteria

The integration is complete when:

- The Open Decisions document has item #1 removed from pending and added to resolved with the text in section 2.1
- Master spec section 5.1 reflects the year-range schema for both vehicle and caravan variants
- Master spec section 7.5 reflects the softened spec-equivalence grouping language
- Master spec section 9.2 reflects the new slug examples, slug rule, and the two new model-level page types (vehicle and caravan)
- Master spec contains a new subsection 9.4 (with subsequent subsections renumbered) covering the year-range page structure for variant profile pages, combo pages, and model-level pages
- Build Plan task 1.2 reflects the year-range vehicle variant schema with exclusion constraint
- Build Plan task 1.3 reflects the year-range caravan variant schema with exclusion constraint
- Build Plan Phase 2 introduction (or relevant scraper task) reflects the scraper guidance addition
- Build Plan Phase 11 variant CRUD task reflects the four admin actions (split, advance, close, overlap-validation)
- Build Plan Phase 12 vehicle/caravan profile page template tasks reflect the per-year query capture structural requirements
- Build Plan Phase 12 contains a new sub-task for model-level page templates (vehicle and caravan)
- A change-summary or diff is produced and reviewable, listing every section added, replaced, or modified
- Any ambiguity surfaced during integration (formatting conventions, cross-reference resolution, section-numbering conflicts) is flagged to Tim for direction rather than resolved autonomously

---

## Part 7: Out of scope

- The four smaller items previously flagged (fragment metadata taxonomy, URL state encoding, bootstrap/seed mechanics, legal text drafts)
- Any engineering implementation of the schema change, scraper updates, admin CRUD, or page templates
- Brand outreach, content authoring, or any of Tim's parallel workstreams
- Re-running Phase 0 or modifying its completion status
- Any modification to the master architecture overview document
- Make-level pages (`/vehicles/{make-slug}/` and `/caravans/{make-slug}/`) — explicitly excluded per section 2.4 rationale; out-of-direct-URL navigation to a make should resolve via the picker's Browse mode rather than an SEO landing page

---

## Part 8: How to surface uncertainty

If during integration the agent encounters:

- A section number that doesn't have a clean insertion point in the existing document
- A cross-reference that resolves to nothing or to an unexpected location
- A contradiction between this patch and existing document content
- A formatting convention in the existing document that this patch text doesn't follow
- One of the open questions in Part 4 blocking progress
- Any other ambiguity

The agent stops, summarises the ambiguity in a clear question, and waits for Tim's direction. Do not proceed on assumptions.
