// Curated accessory silhouette library — proof set (Phase 1). See ACCESSORY_ART.md.
// Each view draws into the 0..100 unit box with `currentColor`; strokes are
// non-scaling so they stay crisp when stretched to real dimensions.
import type { ReactNode } from 'react';
import type { CategorySilhouettes, Silhouette, SilhouetteView } from './types';

// Shared element styles (line-art + soft body fill).
const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};
const body = {
  fill: 'currentColor',
  fillOpacity: 0.12,
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

// ── Bull bar ──────────────────────────────────────────────────────────────────
const bullbar: CategorySilhouettes = {
  label: 'Bull bar',
  anchor: { x: 70, y: 60 },
  defaultSizeMm: { lengthMm: 350, widthMm: 1850, heightMm: 650 },
  views: {
    // Head-on: a low cross-bar with two outer loops and a centre hoop.
    front: () => (
      <>
        <rect x={8} y={56} width={84} height={16} rx={8} {...body} />
        <path d="M20 64 V34 Q20 22 32 22 Q44 22 44 34 V64" {...line} />
        <path d="M56 64 V34 Q56 22 68 22 Q80 22 80 34 V64" {...line} />
        <path d="M40 56 V40 Q50 30 60 40 V56" {...line} />
      </>
    ),
    // Profile: mounting plate at the rear with a forward-curving nudge bar.
    side: () => (
      <>
        <rect x={62} y={30} width={14} height={50} rx={4} {...body} />
        <path d="M68 40 Q92 40 92 64 L92 78" {...line} />
        <path d="M68 58 Q84 58 84 72" {...line} />
      </>
    ),
    // Plan: a full-width bar at the front (right) with two loops poking forward.
    top: () => (
      <>
        <rect x={60} y={8} width={16} height={84} rx={8} {...body} />
        <path d="M76 26 Q92 26 92 34 Q92 42 76 42" {...line} />
        <path d="M76 58 Q92 58 92 66 Q92 74 76 74" {...line} />
      </>
    ),
  },
};

// ── Fridge / 12V fridge ─────────────────────────────────────────────────────
const fridge: CategorySilhouettes = {
  label: 'Fridge',
  defaultSizeMm: { lengthMm: 720, widthMm: 450, heightMm: 480 },
  views: {
    side: () => (
      <>
        <rect x={12} y={20} width={76} height={66} rx={6} {...body} />
        <path d="M12 36 H88" {...line} />
        <rect x={64} y={26} width={14} height={5} rx={2} {...line} />
        <path d="M22 86 V92 M78 86 V92" {...line} />
      </>
    ),
    top: () => (
      <>
        <rect x={12} y={14} width={76} height={72} rx={6} {...body} />
        <path d="M50 14 V86" {...line} />
        <rect x={44} y={40} width={12} height={6} rx={2} {...line} />
      </>
    ),
    front: () => (
      <>
        <rect x={18} y={16} width={64} height={70} rx={6} {...body} />
        <path d="M18 34 H82" {...line} />
        <path d="M60 24 H72" {...line} />
      </>
    ),
  },
};

// ── Drawer system ──────────────────────────────────────────────────────────
const drawer: CategorySilhouettes = {
  label: 'Drawers',
  defaultSizeMm: { lengthMm: 900, widthMm: 500, heightMm: 320 },
  views: {
    side: () => (
      <>
        <rect x={8} y={30} width={84} height={56} rx={4} {...body} />
        <path d="M8 58 H92" {...line} />
        <path d="M40 44 H60 M40 72 H60" {...line} />
      </>
    ),
    front: () => (
      <>
        <rect x={14} y={24} width={72} height={62} rx={4} {...body} />
        <path d="M14 55 H86" {...line} />
        <path d="M42 38 H58 M42 70 H58" {...line} />
      </>
    ),
    top: () => (
      <>
        <rect x={8} y={18} width={84} height={64} rx={4} {...body} />
        <path d="M50 18 V82" {...line} />
        <path d="M22 50 H38 M62 50 H78" {...line} />
      </>
    ),
  },
};

// ── Jerry can (fuel / water) ─────────────────────────────────────────────────
const jerryCan: CategorySilhouettes = {
  label: 'Jerry can',
  defaultSizeMm: { lengthMm: 170, widthMm: 350, heightMm: 470 },
  views: {
    side: () => (
      <>
        <path
          d="M22 26 Q22 18 30 18 H70 Q78 18 78 26 V84 Q78 90 72 90 H28 Q22 90 22 84 Z"
          {...body}
        />
        <path d="M30 18 Q34 10 44 12 L60 12 Q70 10 70 18" {...line} />
        <path d="M30 40 Q50 50 70 40 M30 64 Q50 74 70 64" {...line} />
      </>
    ),
    front: () => (
      <>
        <rect x={28} y={20} width={44} height={70} rx={6} {...body} />
        <path d="M36 20 Q36 12 46 12 H54 Q64 12 64 20" {...line} />
        <circle cx={40} cy={26} r={4} {...line} />
      </>
    ),
    top: () => (
      <>
        <rect x={20} y={30} width={60} height={40} rx={6} {...body} />
        <circle cx={32} cy={42} r={6} {...line} />
      </>
    ),
  },
};

export const SILHOUETTES: Record<string, CategorySilhouettes> = {
  bullbar,
  fridge,
  drawer,
  'jerry-can': jerryCan,
};

/** The best silhouette for a category + view, with sensible fallbacks. */
export function resolveSilhouette(
  category: string | null | undefined,
  view: SilhouetteView,
): Silhouette | null {
  if (!category) return null;
  const cat = SILHOUETTES[category];
  if (!cat) return null;
  return (
    cat.views[view] ?? (view === 'back' ? cat.views.front : undefined) ?? null
  );
}

/**
 * Render a category silhouette stretched to a px box (real dims drive aspect).
 * `tint` sets the line/fill colour (status colour, or ink). Returns null when
 * there's no silhouette for the category/view — caller falls back to a box.
 */
export function AccessorySilhouette({
  category,
  view,
  width,
  height,
  tint = '#1b3a5c',
  title,
}: {
  category: string | null | undefined;
  view: SilhouetteView;
  width: number;
  height: number;
  tint?: string;
  title?: string;
}): ReactNode {
  const render = resolveSilhouette(category, view);
  if (!render) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ color: tint, overflow: 'visible' }}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {render()}
    </svg>
  );
}
