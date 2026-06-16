// Tintable top-down category glyphs for the layout views. Each is drawn inside a
// bounding box (centred at cx,cy, size w×h) so it scales to the accessory's real
// footprint. A real top-down image (set in admin) overrides these.

export type IconId =
  | 'box'
  | 'drawer'
  | 'fridge'
  | 'water'
  | 'jerry'
  | 'spare'
  | 'tent'
  | 'bar'
  | 'rack'
  | 'snorkel'
  | 'hitch'
  | 'toolbox';

// Map a mounting location (and, for custom loads, a free-text label) to a glyph.
export function iconForMount(location: string, label?: string | null): IconId {
  const t = (label ?? '').toLowerCase();
  if (t) {
    if (/fridge|freezer|esky/.test(t)) return 'fridge';
    if (/water|tank/.test(t)) return 'water';
    if (/jerry|fuel can/.test(t)) return 'jerry';
    if (/spare|wheel|tyre|tire/.test(t)) return 'spare';
    if (/tent|swag|awning/.test(t)) return 'tent';
    if (/tool|kit/.test(t)) return 'toolbox';
    if (/drawer/.test(t)) return 'drawer';
    if (/bar|bull/.test(t)) return 'bar';
  }
  const l = location.toUpperCase();
  if (l === 'BULL_BAR' || l === 'REAR_BAR' || l === 'CARAVAN_BUMPER_BAR')
    return 'bar';
  if (l.includes('ROOF')) return 'rack';
  if (l === 'SNORKEL') return 'snorkel';
  if (l === 'TOW_HITCH' || l === 'TOW_BAR') return 'hitch';
  if (l.startsWith('WHEEL_ARCH')) return 'spare';
  if (l.startsWith('TUB') || l.startsWith('TRAY') || l.startsWith('CANOPY'))
    return 'drawer';
  return 'box';
}

export function AccessoryGlyph({
  icon,
  cx,
  cy,
  w,
  h,
  color,
}: {
  icon: IconId;
  cx: number;
  cy: number;
  w: number;
  h: number;
  color: string;
}) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const s = { stroke: color, strokeWidth: 1.4, fill: 'none' } as const;
  const fillFaint = { fill: color, fillOpacity: 0.14 } as const;

  switch (icon) {
    case 'drawer':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} {...s} {...fillFaint} />
          <line x1={x} y1={y + h / 3} x2={x + w} y2={y + h / 3} {...s} />
          <line
            x1={x}
            y1={y + (2 * h) / 3}
            x2={x + w}
            y2={y + (2 * h) / 3}
            {...s}
          />
        </g>
      );
    case 'fridge':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} {...s} {...fillFaint} />
          <line x1={x} y1={y + h * 0.45} x2={x + w} y2={y + h * 0.45} {...s} />
          <line
            x1={x + w * 0.5}
            y1={y + h * 0.12}
            x2={x + w * 0.5}
            y2={y + h * 0.32}
            {...s}
          />
        </g>
      );
    case 'water':
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(w, h) * 0.35}
            {...s}
            {...fillFaint}
          />
          <path
            d={`M${x + w * 0.2},${cy} q${w * 0.15},-6 ${w * 0.3},0 t${w * 0.3},0`}
            {...s}
          />
        </g>
      );
    case 'jerry':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} {...s} {...fillFaint} />
          <circle
            cx={x + w * 0.5}
            cy={y + h * 0.22}
            r={Math.min(w, h) * 0.1}
            {...s}
          />
        </g>
      );
    case 'spare':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(w, h) / 2}
            {...s}
            {...fillFaint}
          />
          <circle cx={cx} cy={cy} r={Math.min(w, h) / 5} {...s} />
        </g>
      );
    case 'tent':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} {...s} {...fillFaint} />
          <line x1={x} y1={y} x2={cx} y2={cy} {...s} />
          <line x1={x + w} y1={y} x2={cx} y2={cy} {...s} />
          <line x1={cx} y1={cy} x2={cx} y2={y + h} {...s} />
        </g>
      );
    case 'bar':
      return (
        <rect
          x={x}
          y={cy - h * 0.28}
          width={w}
          height={h * 0.56}
          rx={h * 0.28}
          {...s}
          {...fillFaint}
        />
      );
    case 'rack':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} {...s} {...fillFaint} />
          <line x1={x + w / 3} y1={y} x2={x + w / 3} y2={y + h} {...s} />
          <line
            x1={x + (2 * w) / 3}
            y1={y}
            x2={x + (2 * w) / 3}
            y2={y + h}
            {...s}
          />
        </g>
      );
    case 'snorkel':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(w, h) * 0.4}
            {...s}
            {...fillFaint}
          />
          <line x1={cx} y1={cy} x2={cx} y2={y} {...s} />
        </g>
      );
    case 'hitch':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(w, h) * 0.32}
            {...s}
            {...fillFaint}
          />
          <line x1={cx} y1={cy} x2={x} y2={cy} {...s} />
        </g>
      );
    case 'toolbox':
      return (
        <g>
          <rect
            x={x}
            y={y + h * 0.2}
            width={w}
            height={h * 0.8}
            rx={2}
            {...s}
            {...fillFaint}
          />
          <path
            d={`M${x + w * 0.3},${y + h * 0.2} v${-h * 0.12} h${w * 0.4} v${h * 0.12}`}
            {...s}
          />
        </g>
      );
    case 'box':
    default:
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={2} {...s} {...fillFaint} />
          <line
            x1={x}
            y1={y}
            x2={x + w}
            y2={y + h}
            {...s}
            strokeOpacity={0.4}
          />
        </g>
      );
  }
}
