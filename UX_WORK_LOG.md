# UX / Graphics / Revenue Push — Work Log

Autonomous session pushing toward the end goal: **a polished calculator that
generates traffic + revenue.** Branch `overnight/loose-ends`. Every unit is an
atomic commit; git **rollback tags** mark safe restore points.
Review the lot: `git log --oneline rollback/pre-ux-polish..HEAD`

## Final state
✅ `type-check` 0 errors · ✅ `lint` 0 errors · ✅ **344 unit tests** · ✅ **4 e2e tests**

## Key decision — vehicle imagery
**Stylised, branded SVG silhouettes per body type** (NOT AI-generated or real
photos for the calculator/schematic). Rationale: consistency across hundreds of
variants, near-zero payload (Core Web Vitals → SEO), trustworthy (doesn't fake a
specific vehicle = protects the trust moat), infinite scale, zero per-vehicle
cost — and it's the documented §7.4 direction. Real/AI photography is parked as a
*later marketing/hero-image layer* on SEO pages, not the functional calculator.
**Tim can overrule on return.**

## Brand language established
- Palette: navy `--color-tb-ink #112334` / `--color-tb-primary` + **outback-clay
  accent `--color-tb-accent #c2603f`** (distinct from the amber warning) + sand.
- Type: **Archivo** display face (via next/font) for headlines; Inter stays body.
- Motif: topographic contour lines (inline SVG, zero image weight).
- Reduced-motion-aware reveal animation (`.tb-reveal`).

## Rollback tags
- `rollback/pre-ux-polish` — green state before this push.
- `rollback/silhouettes` — after the silhouette system.
- `rollback/homepage` — after homepage + design tokens.
- `rollback/monetisation` — after monetisation scaffolding.

## Units done
1. ✅ **Silhouette system + schematic polish** — distinct, detailed silhouettes
   per body type (ute glassed dual-cab + B-pillar; wagon/suv/van greenhouse;
   full-height/pop-top/camper/off-road caravans with door/window/rooflines +
   raised clearance), tyre/rim/hub wheels, tidied axle gauges, framed figure with
   gradient + attribution (the shareable artefact). `+suv`, `+offroad` body kinds.
3. ✅ **Homepage rebuild + brand tokens** — sticky nav + footer, navy/terracotta,
   Archivo display, topographic hero, a **sample verdict card** that shows the
   actual product output, the 3-vs-10-metrics differentiator, how-it-works, and
   real vehicle + guide internal links (SEO). Scoped to the homepage so the
   calculator/SEO chrome is untouched.
5. ✅ **Monetisation scaffolding (revenue surfaces, inert until configured)** —
   `AdSlot` (env-gated AdSense, labelled, content-pages only; placed on combo +
   guide pages); recommendation **affiliate CTAs** now rendered (the §4.3
   conversion mechanism that was unwired). Accessory pages already had proper
   `rel=sponsored` affiliate links + ACCC labels.

## Not done (next candidates)
2. ⬜ Deeper design-system pass (the calculator results column, empty/loading/
   mobile states could adopt the refreshed tokens for full cohesion).
4. ⬜ Calculator results-column micro-polish (transitions, contributors-on-tap).
- Combo-page "popular combos" internal links with real names (needs a names query).
- Real `/setups/with/` → calculator `a=` deep-link verified end-to-end (works).

## Notes for Tim
- Homepage uses a new display font (Archivo) + accent (terracotta). If you want a
  different feel, it's all token-driven in `globals.css` + `layout.tsx`.
- AdSense + affiliate are **surfaces only** — activate by setting
  `NEXT_PUBLIC_ADSENSE_CLIENT` and adding affiliate URLs to accessories in admin.
- ⚠️ The physics TBM-anchor change (earlier commit) still wants your sign-off —
  see `PHYSICS_NOTES.md`.
