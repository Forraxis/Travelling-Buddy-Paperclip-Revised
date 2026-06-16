'use client';

import { useRef, useState } from 'react';
import type { SchematicModel, AccessoryDot } from './model';
import type { MetricStatus } from '@/lib/physics/types';

// Plan (top-down) view: the rig from above, so left/right distribution is
// visible. Horizontal = longitudinal X (caravan trailing left, vehicle right);
// vertical = lateral Y (top = left side, bottom = right). When onMovePosition is
// supplied, vehicle accessories are draggable sized footprints that snap to a
// grid + mounting zones, and an auto-balance nudge offers a one-tap fix.

const VB_W = 1000;
const PAD = 48;
const DRAW_W = VB_W - PAD * 2;
const WHEEL_W = 10;
const WHEEL_L = 22;
const GRID_MM = 25; // drag snaps to this grid for clean numbers
const ZONE_MAGNET_MM = 90; // ...and clicks into a zone centre when this close

const STROKE = '#1b3a5c';
const ACCENT = '#c2603f';
const BODY = '#cdd9e6';
const BODY_VAN = '#dfe7ef';
const TIRE = '#374151';
const GLASS = '#eef4fa';

function hex(s: MetricStatus): string {
  return s === 'fail' ? '#dc2626' : s === 'warn' ? '#d97706' : '#16a34a';
}

function cornerStatus(load: number, limit: number): MetricStatus {
  const r = load / limit;
  return r > 1 ? 'fail' : r > 0.9 ? 'warn' : 'ok';
}

function snap(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}

function WheelMark({ x, y }: { x: number; y: number }) {
  return (
    <rect
      x={x - WHEEL_L / 2}
      y={y - WHEEL_W / 2}
      width={WHEEL_L}
      height={WHEEL_W}
      rx={3}
      fill={TIRE}
    />
  );
}

// A sized accessory footprint: a rounded box scaled to real dimensions, with an
// index badge. Draggable (grab cursor + dashed halo) when editable.
// Shape-aware silhouette body for a custom load (box/cylinder/L), else a rect.
function shapeBody(
  shape: string | null | undefined,
  x: number,
  y: number,
  bw: number,
  bh: number,
  fill: string,
) {
  const common = { fill, fillOpacity: 0.85, stroke: '#fff', strokeWidth: 1.5 };
  if (shape === 'cylinder') {
    return <ellipse cx={x} cy={y} rx={bw / 2} ry={bh / 2} {...common} />;
  }
  if (shape === 'lshape') {
    const d = `M ${x - bw / 2} ${y - bh / 2} h ${bw} v ${bh * 0.45} h ${-bw * 0.5} v ${bh * 0.55} h ${-bw * 0.5} Z`;
    return <path d={d} strokeLinejoin="round" {...common} />;
  }
  return (
    <rect
      x={x - bw / 2}
      y={y - bh / 2}
      width={bw}
      height={bh}
      rx={4}
      {...common}
    />
  );
}

function FootprintMark({
  x,
  y,
  w,
  h,
  n,
  side,
  shape,
  draggable,
  dragging,
  onPointerDown,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  n: number;
  side: 'vehicle' | 'caravan';
  shape?: string | null;
  draggable?: boolean;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const fill = draggable ? ACCENT : side === 'caravan' ? '#7c8aa0' : STROKE;
  const bw = Math.max(14, w);
  const bh = Math.max(12, h);
  const badge = Math.min(9, Math.max(6, Math.min(bw, bh) / 2.6));
  return (
    <g
      onPointerDown={onPointerDown}
      style={{
        cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
      }}
    >
      {draggable && (
        <rect
          x={x - bw / 2 - 3}
          y={y - bh / 2 - 3}
          width={bw + 6}
          height={bh + 6}
          rx={6}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="3 2"
          opacity={dragging ? 1 : 0.5}
        />
      )}
      {shapeBody(shape, x, y, bw, bh, fill)}
      <circle cx={x} cy={y} r={badge} fill="#fff" fillOpacity={0.92} />
      <text
        x={x}
        y={y + badge / 2.6}
        textAnchor="middle"
        fontSize={badge * 1.3}
        fontWeight={800}
        fill={fill}
      >
        {n}
      </text>
    </g>
  );
}

export interface TopDownSchematicProps {
  model: SchematicModel;
  /** When provided, editable vehicle footprints become draggable. */
  onMovePosition?: (id: string, cogXMm: number, cogYMm: number) => void;
  /** When provided, catalogue accessories show a lock toggle. */
  onToggleLock?: (id: string, unlocked: boolean) => void;
}

export default function TopDownSchematic({
  model,
  onMovePosition,
  onToggleLock,
}: TopDownSchematicProps) {
  const v = model.vehicle;
  const c = model.caravan;
  const lat = model.lateral;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const px = (mm: number) => PAD + (mm - model.minXMm) * scale;
  const sx = (mm: number) => mm * scale; // size (length) → px

  const maxHalfW =
    Math.max(v.widthMm, c?.widthMm ?? 0, v.trackWidthMm) / 2 + 200;
  const bodyH = maxHalfW * 2 * scale;
  const centerY = 40 + bodyH / 2;
  const VB_H = centerY + bodyH / 2 + 60;
  const py = (mm: number) => centerY + mm * scale;

  const vHalf = (v.widthMm / 2) * scale;
  const vTrack = (v.trackWidthMm / 2) * scale;
  const vRear = px(v.rearBumperMm);
  const vFront = px(v.frontBumperMm);
  const cabStart = vRear + (vFront - vRear) * 0.42;
  const cabEnd = vRear + (vFront - vRear) * 0.66;

  // The zone (mounting band) a longitudinal position falls in — used both to
  // highlight while dragging and to magnet-snap to the band centre.
  function zoneAt(xMm: number) {
    return model.zones.find((z) => xMm >= z.x0Mm && xMm < z.x1Mm) ?? null;
  }
  const dragDot = dragId ? model.dots.find((d) => d.id === dragId) : null;
  const activeZoneId = dragDot ? (zoneAt(dragDot.xMm)?.id ?? null) : null;

  // Map a pointer event to a clamped, snapped vehicle CoG (mm). x = longitudinal
  // (rear-axle origin), y = lateral (centreline origin, + = right).
  function eventToMm(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VB_H;
    let cogX = snap(model.minXMm + (svgX - PAD) / scale);
    let cogY = snap((svgY - centerY) / scale);
    // Magnet to the nearest zone centre when very close (snap-to-zone).
    const z = zoneAt(cogX);
    if (z) {
      const mid = Math.round((z.x0Mm + z.x1Mm) / 2);
      if (Math.abs(cogX - mid) <= ZONE_MAGNET_MM) cogX = mid;
    }
    cogX = Math.max(v.rearBumperMm, Math.min(v.frontBumperMm, cogX));
    const half = v.widthMm / 2;
    cogY = Math.max(-half, Math.min(half, cogY));
    return { cogX, cogY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId || !onMovePosition) return;
    const { cogX, cogY } = eventToMm(e);
    onMovePosition(dragId, cogX, cogY);
  }
  function endDrag() {
    setDragId(null);
  }

  const corners = lat
    ? ([
        {
          k: 'fl',
          x: px(v.frontAxleMm),
          y: centerY - vTrack,
          load: lat.corners.fl,
          limit: lat.frontCornerLimitKg,
        },
        {
          k: 'fr',
          x: px(v.frontAxleMm),
          y: centerY + vTrack,
          load: lat.corners.fr,
          limit: lat.frontCornerLimitKg,
        },
        {
          k: 'rl',
          x: px(v.rearAxleMm),
          y: centerY - vTrack,
          load: lat.corners.rl,
          limit: lat.rearCornerLimitKg,
        },
        {
          k: 'rr',
          x: px(v.rearAxleMm),
          y: centerY + vTrack,
          load: lat.corners.rr,
          limit: lat.rearCornerLimitKg,
        },
      ] as const)
    : [];

  // Auto-balance nudge: move the heaviest vehicle accessory laterally by the
  // amount that neutralises the imbalance. imbalanceKg = right − left; shifting a
  // load of w by Δy changes the imbalance by 2·w·Δy/track, so the fix is
  // Δy = −imbalanceKg·track / (2·w), clamped to the body.
  const nudge = (() => {
    if (!onMovePosition || !lat) return null;
    if (Math.abs(lat.imbalanceKg) < 8) return null;
    const movable = model.dots
      .filter((d) => d.side === 'vehicle' && d.weightKg > 0)
      .sort((a, b) => b.weightKg - a.weightKg)[0];
    if (!movable) return null;
    const track = v.trackWidthMm;
    const rawDelta = (-lat.imbalanceKg * track) / (2 * movable.weightKg);
    const half = v.widthMm / 2;
    const newY = Math.max(-half, Math.min(half, snap(movable.yMm + rawDelta)));
    const applied = Math.round(newY - movable.yMm);
    if (Math.abs(applied) < 10) return null;
    return {
      dot: movable,
      newY,
      applied,
      dir: applied > 0 ? 'right' : 'left',
    };
  })();

  return (
    <figure
      className="border-tb-neutral-200 to-tb-neutral-50 mb-4 rounded-xl border bg-gradient-to-b from-white p-3"
      aria-label={`Top-down weight distribution for ${model.title}`}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <line
          x1={12}
          y1={centerY}
          x2={VB_W - 12}
          y2={centerY}
          stroke="#cbd5e1"
          strokeWidth={1}
          strokeDasharray="6 5"
        />
        <text
          x={16}
          y={centerY - vHalf - 6}
          fontSize={11}
          fontWeight={600}
          fill="#64748b"
        >
          LEFT
        </text>
        <text
          x={16}
          y={centerY + vHalf + 16}
          fontSize={11}
          fontWeight={600}
          fill="#64748b"
        >
          RIGHT
        </text>

        {c && (
          <g>
            <rect
              x={px(c.bodyRearMm)}
              y={centerY - (c.widthMm / 2) * scale}
              width={px(c.bodyFrontMm) - px(c.bodyRearMm)}
              height={c.widthMm * scale}
              rx={8}
              fill={BODY_VAN}
              stroke={STROKE}
              strokeWidth={2.5}
            />
            <line
              x1={px(c.bodyFrontMm)}
              y1={centerY}
              x2={px(c.couplingMm)}
              y2={centerY}
              stroke={TIRE}
              strokeWidth={3}
            />
            {c.axleMms.map((mm, i) => (
              <g key={i}>
                <WheelMark x={px(mm)} y={centerY - (c.widthMm / 2) * scale} />
                <WheelMark x={px(mm)} y={centerY + (c.widthMm / 2) * scale} />
              </g>
            ))}
          </g>
        )}

        <g>
          <rect
            x={vRear}
            y={centerY - vHalf}
            width={vFront - vRear}
            height={vHalf * 2}
            rx={10}
            fill={BODY}
            stroke={STROKE}
            strokeWidth={2.5}
          />
          <rect
            x={cabStart}
            y={centerY - vHalf + 4}
            width={cabEnd - cabStart}
            height={vHalf * 2 - 8}
            rx={6}
            fill={GLASS}
            stroke={STROKE}
            strokeWidth={1.2}
          />
          <WheelMark x={px(v.frontAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.frontAxleMm)} y={centerY + vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY + vTrack} />
        </g>

        {/* Mounting zones — labelled bands over the vehicle body. The band under
            a dragged footprint highlights so placement reads "in the tub". */}
        {model.zones.map((z, i) => {
          const x0 = px(z.x0Mm);
          const x1 = px(z.x1Mm);
          const active = z.id === activeZoneId;
          return (
            <g key={z.id}>
              <rect
                x={x0}
                y={centerY - vHalf}
                width={x1 - x0}
                height={vHalf * 2}
                fill={active ? ACCENT : i % 2 === 0 ? STROKE : '#ffffff'}
                fillOpacity={active ? 0.12 : 0.04}
              />
              {i > 0 && (
                <line
                  x1={x0}
                  y1={centerY - vHalf}
                  x2={x0}
                  y2={centerY + vHalf}
                  stroke={STROKE}
                  strokeOpacity={0.15}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              )}
              {x1 - x0 > 34 && (
                <text
                  x={(x0 + x1) / 2}
                  y={centerY - vHalf - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={active ? 700 : 500}
                  fill={active ? ACCENT : '#94a3b8'}
                >
                  {z.label}
                </text>
              )}
            </g>
          );
        })}

        {corners.map((cn) => {
          const st = cornerStatus(cn.load, cn.limit);
          const below = cn.k === 'fr' || cn.k === 'rr';
          return (
            <g key={cn.k}>
              <circle
                cx={cn.x}
                cy={cn.y}
                r={5}
                fill={hex(st)}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <text
                x={cn.x}
                y={cn.y + (below ? 20 : -12)}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={hex(st)}
              >
                {Math.round(cn.load).toLocaleString()} kg
              </text>
            </g>
          );
        })}

        {/* Accessory footprints last so they sit on top + are grabbable */}
        {model.dots.map((d: AccessoryDot) => {
          // Vehicle items are draggable only when editable (custom load, or an
          // unlocked catalogue accessory). Caravan dots stay static here.
          const editable =
            !!onMovePosition && d.side === 'vehicle' && d.editable;
          const showLock =
            !!onToggleLock && d.side === 'vehicle' && !d.isCustom;
          return (
            <g key={d.id}>
              <FootprintMark
                x={px(d.xMm)}
                y={py(d.yMm)}
                w={sx(d.footprintLengthMm)}
                h={sx(d.footprintWidthMm)}
                n={d.n}
                side={d.side}
                shape={d.isCustom ? d.shape : null}
                draggable={editable}
                dragging={dragId === d.id}
                onPointerDown={
                  editable
                    ? (e) => {
                        e.preventDefault();
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                        setDragId(d.id);
                      }
                    : undefined
                }
              />
              {showLock && (
                <g
                  onClick={() => onToggleLock!(d.id, !d.editable)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>
                    {d.editable
                      ? 'Unlocked — drag to reposition. Click to re-lock.'
                      : 'Locked to the known position. Click to unlock + move.'}
                  </title>
                  <circle
                    cx={px(d.xMm) + sx(d.footprintLengthMm) / 2 + 8}
                    cy={py(d.yMm) - sx(d.footprintWidthMm) / 2 - 8}
                    r={7}
                    fill="#fff"
                    stroke={d.editable ? '#e07a3f' : '#94a3b8'}
                    strokeWidth={1.25}
                  />
                  <text
                    x={px(d.xMm) + sx(d.footprintLengthMm) / 2 + 8}
                    y={py(d.yMm) - sx(d.footprintWidthMm) / 2 - 5}
                    textAnchor="middle"
                    fontSize={8}
                    pointerEvents="none"
                  >
                    {d.editable ? '🔓' : '🔒'}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {lat && (
        <figcaption className="border-tb-neutral-200 mt-1 border-t px-1 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-tb-primary font-semibold">
              Left / right balance
            </span>
            <span
              className={`font-bold tabular-nums ${lat.status === 'fail' ? 'text-tb-danger' : lat.status === 'warn' ? 'text-tb-warning' : 'text-tb-success'}`}
            >
              {lat.imbalancePct < 0.5
                ? 'Balanced'
                : `${Math.round(Math.abs(lat.imbalanceKg))} kg ${lat.imbalanceKg > 0 ? 'right' : 'left'}-heavy (${lat.imbalancePct.toFixed(0)}%)`}
            </span>
          </div>
          <div className="bg-tb-neutral-200 mt-1.5 flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-tb-primary-light/70 h-full"
              style={{
                width: `${(lat.leftKg / (lat.leftKg + lat.rightKg)) * 100}%`,
              }}
            />
            <div
              className="bg-tb-primary/70 h-full"
              style={{
                width: `${(lat.rightKg / (lat.leftKg + lat.rightKg)) * 100}%`,
              }}
            />
          </div>

          {nudge && (
            <button
              type="button"
              onClick={() =>
                onMovePosition?.(nudge.dot.id, nudge.dot.xMm, nudge.newY)
              }
              className="border-tb-primary/30 bg-tb-primary/5 text-tb-primary hover:bg-tb-primary/10 mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors"
            >
              ⚖︎ Auto-balance — move “{nudge.dot.label}”{' '}
              {Math.abs(nudge.applied)}
              {' mm '}
              {nudge.dir}
            </button>
          )}

          {onMovePosition && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Drag a footprint to reposition it — it snaps to the grid and
              mounting zones, and the balance updates live.
            </p>
          )}
          {lat.overShareCorner && (
            <p className="text-tb-danger mt-1.5 text-[11px]">
              One tyre is over its share — redistribute weight toward the
              lighter side.
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
