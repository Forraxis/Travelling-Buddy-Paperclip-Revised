# Handover — catalogue granularity, picker redesign, build-source variants & calculator polish

_Last updated: 2026-06-28. Branch: **`feature/vehicle-data-fetch`** (origin Forraxis), pushed & in sync. Last code commit `97e7eae`; this doc lives in the commits after it._

This covers the work from the catalogue-granularity epic through the picker
redesign, the **build-source-variants** sub-epic, and the calculator "feels
broken" fixes. Pick up from "Open / next steps".

---

## 1. TL;DR — current state

- **Catalogue granularity** (structured facets + free-text pg_trgm search + plate-confirm) — **shipped**.
- **Picker redesign** (carsales-style: search-on-top, guided stepper on phone / filter-list on desktop) — **shipped**.
- **Build-source variants** (country-of-manufacture splits, e.g. D40 Navara Spain vs Thailand) — **Phase 1 (mechanism) shipped, ships dark**. Phase 2 (seed real D40 numbers) + Phase 3 (auto-discovery) pending.
- **Calculator usability** — fixed the `NaN` axle loads / false "All checks pass" / estimate-spam that made it read as broken. Display-layer only.
- **Caravan floorplan re-cluster + supersede** — **DONE** (earlier in the epic): re-keyed on (make,model,year,floorplan), landed per-floorplan variants, and the supersede pass deleted the now-redundant merged rows (only those with no Setup/fitment refs). CaravanVariant = **1263**. Verified: Bruder Exp 2021 = `exp-2021-4` (ATM 1600) + `exp-2021-6` (3100); the misleading 2350-median merged row is gone.
- Health: `npm run type-check` clean · `npm run lint` 0 errors (48 pre-existing warnings) · `npm run test` **671 pass**. Working tree clean. `VehicleVariant.buildOrigin` set on **0** rows in prod (ships dark, confirmed).

---

## 2. Commits this stretch (newest first)

| Commit | What |
|---|---|
| `97e7eae` | fix(calculator): never render NaN axle loads; honest verdict + less estimate noise |
| `e4f7146` | feat(picker): gate the Origin step until a model-year is fully build-tagged |
| `6b22a64` | feat(admin): variant facets + build-origin manual entry + concurrent-split constraint |
| `8bc9141` | docs: catalogue granularity plan addendum + ignore ops artifacts |
| `b7e4076` | feat(picker): carsales-style redesign + plate-confirm + build-origin step |
| `f4ec56c` | feat(catalogue): granularity facets + free-text search + build-source plumbing |

(`90efbc9` and earlier = pre-existing caravan/contributions work, not this stretch.)

---

## 3. Build-source variants — the main new feature

**Problem:** some model-years ship from >1 plant with materially different
GVM/axle/dims (the canonical case: **D40 Navara — Barcelona vs Sriracha builds,
concurrent across years**). The variant key collapsed them into one row = a
compliance-correctness bug. There is **no free auto-source** for the split
(ROVER is post-2021 only and carries no plant text; QLD rego doesn't either). The
truth lives on the **plate/VIN** (WMI prefix → country) and in brochures
(Tim-supplied, signed off).

Design = general + self-discovering, in three layers:

1. **Represent** — nullable `VehicleVariant.buildOrigin` (ISO-3166 alpha-2, e.g.
   `ES`/`TH`/`JP`). Picker shows an **"Origin" facet step** that auto-hides unless
   a model-year carries >1 value, and is **gated** so it only appears when the
   narrowed set is *fully* tagged (partial data → variants fall to the leaf list
   with flag pills, never unreachable).
2. **Identify** — `src/lib/catalogue/vin.ts`: `extractVin` + `wmiToCountry` (known
   plants `VSK`→ES, `MNT`→TH + ISO region ranges). The compliance-plate OCR
   (`src/app/api/ocr/compliance-plate/route.ts`) now reads the VIN → build origin.
3. **Discover** (Phase 3, NOT built) — cluster plate-confirm evidence by
   VIN-origin; flag a variant for splitting when confirmations separate into two
   GVM/axle groups (reuse the P3 contributed-calibration moat pattern).

**Status:**
- **Phase 1 DONE, ships dark.** No variant carries `buildOrigin` in prod yet → the
  picker is unchanged for users until data is added.
- **Phase 2 PENDING (Tim).** Enter the real D40 Spanish/Thai specs (now self-serve
  via the admin — see §5). Rule-11 sign-off on the numbers.
- **Phase 3 PENDING.** Plate-evidence discovery.

**Key files:**
- `src/lib/catalogue/facet-tokens.ts` — `COUNTRY` map, `formatOrigin`, `deriveOriginToken`, origin parsing in `parseVehicleQuery`.
- `src/lib/catalogue/vin.ts` — VIN → build origin.
- `src/components/calculator/picker/facet-steps.ts` — the Origin step + `stepGatedOut` gating.
- `src/components/calculator/picker/OriginTag.tsx` — the flag/country pill.
- Picker API routes (`vehicles/search`, `vehicles/.../variants`) — select/filter/return `buildOrigin`.
- Migrations `20260627000000_add_vehicle_build_origin` + `20260627010000_build_origin_overlap_exclusion`.

**Tests:** `src/lib/catalogue/__tests__/build-origin.test.ts`, `src/components/calculator/picker/__tests__/facet-steps.test.ts`.

---

## 4. Picker redesign

Single surface (no Search/Browse tabs): a **persistent search bar on top**; typing
shows live pg_trgm results, clearing returns to Browse. Variant narrow-down is a
**guided engine** (`facet-steps.ts`): phone = one-decision-per-screen stepper with
breadcrumb chips; desktop = labelled dropdowns over a live-refining list;
single-option steps auto-skip; un-named OEM codes fall to a collapsible "Other".
Order: cars `Cab→Drive→Origin→Year→Grade`, caravans `Length→Year→Berths`.

Files: `PickerShell`, `PickerBody`, `BrowseTab`, `VariantNarrow`, `SearchResults`,
`facet-steps.ts`, `display.ts`, `OriginTag.tsx` (+ `hooks/useBrowse`, `useSearch`).
`SearchTab.tsx` was deleted (folded into `PickerBody` + `SearchResults`).

---

## 5. Admin manual entry (Phase 2 is now self-serve)

**Where:** Admin → Catalogue → Vehicles → _make_ → _model_ → Add/Edit variant →
new **"Configuration"** section (`VariantForm.tsx`). Fields: Cab, Drive, **Origin**
(country picker), Badge, Generation, Engine, Transmission — all optional.

**To create a build split** (the D40): add **two variants, same name + years,
different Origin**, each with its own GVM/kerb/axle.

Plumbing: facets flow through `vehicle.types.ts` → `vehicle.actions.ts` →
`vehicle.service.ts`. The slug carries the origin (`…-es` / `…-th`) so concurrent
builds stay unique. Every entry is written to the **audit log**
(`/admin/operations/audit`).

**Constraint change (important):** the `no_overlapping_year_ranges` exclusion key
gained `COALESCE(buildOrigin,'')` so same-name/overlapping-year rows are allowed
**only when build origin differs** — the no-overlap guarantee is preserved for all
null-origin variants. Tim's call: mate-entered data is trusted → entries stay
`CATALOGUE`/"OEM Spec" (no lower-trust ESTIMATE gating).

---

## 6. Calculator "feels broken" fix (`97e7eae`)

**Symptom** (see `docs/calc.png`): for any variant missing wheelbase (lots of the
QLD-derived rows, e.g. Navara Dual Cab 2007–2008), axle loads showed **`NaN kg`**,
the banner falsely said **"All checks pass"** (because `weightStatus(NaN)` → ok),
and every metric repeated **"Estimate / Est. — confirm your plate / Confirm if you
can →"**.

**Root cause:** `computeVehicleAxles` does `momentSum / vehicle.wheelbaseMm`;
`wheelbaseMm` is null → NaN. (`rearOverhangMm` has a `?? 400` fallback; wheelbase
has none — by design, you can't fake geometry.)

**Fix (display-layer only — no physics-model change, Rule 11 untouched):**
- `fmt`/`kg`/`clampPct` guard non-finite → `—`, never "NaN" (RightColumn,
  MobileResultsBar, AdvancedPanel).
- Axle rows with no value show "Add this vehicle's wheelbase to estimate the axle
  load."
- Verdict banner: uncomputable axle → "Within all checked limits" + add-wheelbase
  note (no false green).
- Estimate noise consolidated to one chip per metric + the single top plate CTA.

---

## 7. Open / next steps (prioritized)

**A. Make axle loads actually compute (the real payoff).** The "—" is honest but
axle loads are the product differentiator. Needs **wheelbase + overhangs** on
variants. Two paths: (1) bulk-backfill the top ~50 tow vehicles from published
specs — _Tim's nod needed (feeds axle physics)_; (2) you/mates fill via the admin
form. Once present, axle loads show real numbers.

**B. Variant sprawl ("finding the right rig").** 54 dual-cab HiLuxes, old/cryptic
QLD year-band rows, duplicates. The biggest remaining usability drag. Needs a
catalogue cleanup pass (merge/demote/newest-first) — the picker can only be as
clean as the data.

**C. Engine hardening (Rule 11).** Have the engine return `null` axle loads + an
`'unknown'` MetricStatus when wheelbase is missing (instead of NaN), so the verdict
math is honest at the core, not just the display. `overallStatus` should treat
`unknown` as not-pass-not-fail. Touches `engine.ts`, `regulations.ts:weightStatus`,
`physics/types.ts`, the verdict aggregation — **Tim's sign-off.**

**D. Mobile polish.** Selected-vehicle card still truncates on phone; the verdict
still lives in a collapsed bottom bar (`MobileResultsBar`) — surface it.

**E. Build-source Phase 2 / Phase 3.** Seed the D40 split (A/admin); build the
plate-evidence discovery flow.

**Decisions pending for Tim (small, not blocking):**
- **174 CLAUDE-sourced `VariantSpecProvenance` rows** (axle/gcm/dims/fuel, web-grounded
  in the earlier axle pass — distinct from the AI *facet* rows, which were already deleted
  in the pivot-away-from-AI). Keep or purge — your call. They sit at ESTIMATE.
- **M4(c) slug-as-config-fingerprint** + `VariantSlugRedirect` — **deferred, not pre-launch**
  (SEO-only; users already reach the right variant via the picker).
- **Rego / plate fast-entry path** — considered (skip the deep picker for people who know
  their rig) but **not chosen** this round. Parked idea, not built.

**Pre-existing / unrelated:** PDF report (Puppeteer won't install in sandbox),
dynamic OG images, contributors-on-tap per metric, ops/external (prod secrets,
Search Console + sitemap, AdSense approval, Resend domain verification).

**Rule-11 pending (Tim):** P1 §3–7 + P3 §9.x sign-offs; caravan axle-split;
vertical-CoG/SSF stability (advisory until signed off); the D40 build figures (B/E);
the engine 'unknown'-status verdict change (C).

---

## 8. Dev workflow / gotchas

- Dev server: `npm run dev` on **:3070** (https://tbr.dev.ragebots.me). **Restart it
  after any `prisma generate`** or the running process holds the old client.
- DB is the **remote** `DATABASE_URL` in `.env.local`. Prisma CLI needs it inline:
  `DATABASE_URL=… npx prisma migrate deploy`. **Never `migrate reset`** the shared DB
  — additive migrations only.
- `trailingSlash: true` — API calls take a 308 hop.
- Verification used Playwright against :3070 (browser-walk the real picker/calculator).
  Temp data was seeded via `pg` then deleted; admin pages are behind ADMIN/MODERATOR
  auth so they were verified via the data path + type-check, not a logged-in walk.
- Commit only when asked; this stretch is committed + pushed.
