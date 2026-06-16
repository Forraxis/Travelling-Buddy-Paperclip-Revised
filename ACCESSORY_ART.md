# Accessory artwork — visual language (style guide)

The goal: every accessory reads as *itself* from every angle the planner shows
(top, side, and later front/back), at **true scale**, in **one consistent visual
language**. A bull bar looks like a bull bar; a fridge like a fridge — never a
chunky box. This guide is the contract every silhouette must follow so the set
stays coherent as it grows (incl. AI-assisted authoring → human curation).

## 1. Medium
**Parameterised vector silhouettes (SVG line-art)** — not raster photos. They
scale crisply to the item's real size, tint by status, animate, and stay tiny
and consistent. A per-accessory raster image (real product shot) is allowed only
as an explicit *override*, never the baseline.

## 2. The unit box
Every silhouette is drawn in a **100 × 100 unit viewBox** (`0 0 100 100`),
filling it edge to edge (small margin ~4 units). The renderer maps that unit box
onto the item's real bounding box for the current view, then to pixels — so the
**unit box's aspect is ignored**; real dimensions drive on-screen proportions:

| View | Unit-box width = | Unit-box height = |
|---|---|---|
| top   | length (X, mm) | width (Y, mm) |
| side  | length (X, mm) | height (Z, mm) |
| front | width (Y, mm)  | height (Z, mm) |
| back  | width (Y, mm)  | height (Z, mm) |

So draw each silhouette **proportion-agnostic** (it'll be stretched to real
dims). Draw the *character* of the shape, not a fixed aspect.

## 3. Orientation (must be consistent across the set)
- **top**: plan view, **front of the item points right** (+X = toward the
  vehicle front, matching the schematic's rear-axle-origin, +forward axis).
- **side**: profile, **front points right**, ground at the bottom (y=100).
- **front**: head-on from the front of the rig; **kerb side (right in AU) on the
  viewer's right**, ground at the bottom.
- **back**: head-on from the rear (mirror of front), ground at the bottom.
Symmetric items may reuse `front` for `back`.

## 4. Stroke, fill, colour
- Single colour via **`currentColor`** (the renderer sets it = status tint or ink
  `#1b3a5c`). Never hard-code colours in a silhouette.
- **Stroke**: width ~3.5 units, `strokeLinejoin="round"`, `strokeLinecap="round"`.
- **Fill**: the body fill is `currentColor` at **0.12 opacity** (a soft tint);
  details (slats, handles, lids) are stroke-only. No gradients, no shadows.
- Keep it **line-art / cartoon-clean**, ~2–6 paths. Readable at 24px and at
  300px. Think "confident icon", not technical drawing.

## 5. Anchor
The silhouette's **CoG anchor** is the unit-box centre (50,50) unless a category
declares otherwise (e.g. a bull bar's mass sits low/forward). The renderer places
the anchor at the item's CoG; declare a per-category `anchor: {x,y}` (0..100) when
centre is wrong.

## 6. Registry + naming
Silhouettes live in `src/components/schematic/silhouettes/`, keyed by a **category
id** (kebab-case: `bullbar`, `fridge`, `drawer`, `jerry-can`, `water-tank`,
`spare-wheel`, `rooftop-tent`, `awning`, `toolbox`, `roof-rack`, `canopy`,
`snorkel`, `winch`, `box` …) → `Partial<Record<view, Silhouette>>`. A missing
view falls back to: front↔back, then a generic scaled box (the explicit
"unknown" — better an honest box than a wrong shape).

## 7. Scale truth
The renderer scales each silhouette to the accessory's real **L×W×H** (mm). When
a dimension is unknown, fall back to a sensible per-category default (documented
with the category), never a fixed pixel size. Tinting follows the load's status.

## 8. Quality bar (epic, not mediocre)
1. **Consistency** — one stroke weight, one palette, one orientation convention.
2. **Recognisable in a glance** at small size.
3. **Scale-true** — proportions come from real dims, not the drawing.
4. **Curated** — AI may draft SVGs, but each is reviewed against this guide before
   entering the library (review queue, like submissions).

## 9. Roadmap (this is Phase 1 of the epic)
1. ✅ Style guide + silhouette architecture + proof set (bullbar/fridge/drawer/jerry) + admin gallery.
2. Fill the multi-view library across all catalogue categories.
3. Per-accessory artwork editor (assign silhouette, dims, anchor, preview, override).
4. AI generation pipeline → review queue.
5. Wire scaled silhouettes into the planner's side/top (replacing dots/boxes) + add front/back views.
