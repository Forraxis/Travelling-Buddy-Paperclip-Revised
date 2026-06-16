// Vector accessory silhouettes — see ACCESSORY_ART.md for the visual language.
// Each silhouette draws into a 0..100 unit box using `currentColor`; the renderer
// stretches it to the item's real dimensions (preserveAspectRatio="none") while
// strokes stay crisp via vectorEffect="non-scaling-stroke".
import type { ReactNode } from 'react';

export type SilhouetteView = 'top' | 'side' | 'front' | 'back';

/** Renders the silhouette's paths inside the 0..100 unit box. */
export type Silhouette = () => ReactNode;

export interface CategorySilhouettes {
  /** Friendly label for the gallery / editor. */
  label: string;
  /** CoG anchor within the unit box (0..100); defaults to centre. */
  anchor?: { x: number; y: number };
  /** Sensible default real size (mm) when the accessory lacks dimensions. */
  defaultSizeMm?: { lengthMm: number; widthMm: number; heightMm: number };
  views: Partial<Record<SilhouetteView, Silhouette>>;
}
