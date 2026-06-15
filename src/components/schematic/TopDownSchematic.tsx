'use client';

import { useRef, useState } from 'react';
import type { SchematicModel } from './model';
import type { MetricStatus } from '@/lib/physics/types';

// Plan (top-down) view: the rig from above, so left/right distribution is
// visible. Horizontal = longitudinal X (caravan trailing left, vehicle right);
// vertical = lateral Y (top = left side, bottom = right). When onMovePosition is
// supplied, vehicle accessory dots are draggable to set precise X/Y.

const VB_W = 1000;
const PAD = 48;
const DRAW_W = VB_W - PAD * 2;
const WHEEL_W = 10;
const WHEEL_L = 22;

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

function DotMark({
  x,
  y,
  n,
  weightKg,
  draggable,
  dragging,
  onPointerDown,
}: {
  x: number;
  y: number;
  n: number;
  weightKg: number;
  draggable?: boolean;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const r = Math.max(8, Math.min(16, 6 + Math.sqrt(weightKg) * 0.9));
  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default' }}
    >
      {draggable && (
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3 2" opacity={dragging ? 1 : 0.5} />
      )}
      <circle cx={x} cy={y} r={r} fill={draggable ? ACCENT : STROKE} fillOpacity={0.9} stroke="#fff" strokeWidth={2} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
        {n}
      </text>
    </g>
  );
}

export interface TopDownSchematicProps {
  model: SchematicModel;
  /** When provided, vehicle accessory dots become draggable. */
  onMovePosition?: (id: string, cogXMm: number, cogYMm: number) => void;
}

export default function TopDownSchematic({
  model,
  onMovePosition,
}: TopDownSchematicProps) {
  const v = model.vehicle;
  const c = model.caravan;
  const lat = model.lateral;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const px = (mm: number) => PAD + (mm - model.minXMm) * scale;

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

  // Map a pointer event to clamped vehicle CoG (mm). x = longitudinal (rear axle
  // origin, same frame as cogX), y = lateral (centreline origin, + = right).
  function eventToMm(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VB_H;
    let cogX = model.minXMm + (svgX - PAD) / scale;
    let cogY = (svgY - centerY) / scale;
    cogX = Math.max(v.rearBumperMm, Math.min(v.frontBumperMm, cogX));
    const half = v.widthMm / 2;
    cogY = Math.max(-half, Math.min(half, cogY));
    return { cogX: Math.round(cogX), cogY: Math.round(cogY) };
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
        { k: 'fl', x: px(v.frontAxleMm), y: centerY - vTrack, load: lat.corners.fl, limit: lat.frontCornerLimitKg },
        { k: 'fr', x: px(v.frontAxleMm), y: centerY + vTrack, load: lat.corners.fr, limit: lat.frontCornerLimitKg },
        { k: 'rl', x: px(v.rearAxleMm), y: centerY - vTrack, load: lat.corners.rl, limit: lat.rearCornerLimitKg },
        { k: 'rr', x: px(v.rearAxleMm), y: centerY + vTrack, load: lat.corners.rr, limit: lat.rearCornerLimitKg },
      ] as const)
    : [];

  return (
    <figure
      className="mb-4 rounded-xl border border-tb-neutral-200 bg-gradient-to-b from-white to-tb-neutral-50 p-3"
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
        <line x1={12} y1={centerY} x2={VB_W - 12} y2={centerY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="6 5" />
        <text x={16} y={centerY - vHalf - 6} fontSize={11} fontWeight={600} fill="#64748b">LEFT</text>
        <text x={16} y={centerY + vHalf + 16} fontSize={11} fontWeight={600} fill="#64748b">RIGHT</text>

        {c && (
          <g>
            <rect x={px(c.bodyRearMm)} y={centerY - (c.widthMm / 2) * scale} width={px(c.bodyFrontMm) - px(c.bodyRearMm)} height={c.widthMm * scale} rx={8} fill={BODY_VAN} stroke={STROKE} strokeWidth={2.5} />
            <line x1={px(c.bodyFrontMm)} y1={centerY} x2={px(c.couplingMm)} y2={centerY} stroke={TIRE} strokeWidth={3} />
            {c.axleMms.map((mm, i) => (
              <g key={i}>
                <WheelMark x={px(mm)} y={centerY - (c.widthMm / 2) * scale} />
                <WheelMark x={px(mm)} y={centerY + (c.widthMm / 2) * scale} />
              </g>
            ))}
          </g>
        )}

        <g>
          <rect x={vRear} y={centerY - vHalf} width={vFront - vRear} height={vHalf * 2} rx={10} fill={BODY} stroke={STROKE} strokeWidth={2.5} />
          <rect x={cabStart} y={centerY - vHalf + 4} width={cabEnd - cabStart} height={vHalf * 2 - 8} rx={6} fill={GLASS} stroke={STROKE} strokeWidth={1.2} />
          <WheelMark x={px(v.frontAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.frontAxleMm)} y={centerY + vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY + vTrack} />
        </g>

        {corners.map((cn) => {
          const st = cornerStatus(cn.load, cn.limit);
          const below = cn.k === 'fr' || cn.k === 'rr';
          return (
            <g key={cn.k}>
              <circle cx={cn.x} cy={cn.y} r={5} fill={hex(st)} stroke="#fff" strokeWidth={1.5} />
              <text x={cn.x} y={cn.y + (below ? 20 : -12)} textAnchor="middle" fontSize={11} fontWeight={700} fill={hex(st)}>
                {Math.round(cn.load).toLocaleString()} kg
              </text>
            </g>
          );
        })}

        {/* Accessory dots last so they sit on top + are grabbable */}
        {model.dots.map((d) => {
          const editable = !!onMovePosition && d.side === 'vehicle';
          return (
            <DotMark
              key={d.id}
              x={px(d.xMm)}
              y={py(d.yMm)}
              n={d.n}
              weightKg={d.weightKg}
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
          );
        })}
      </svg>

      {lat && (
        <figcaption className="mt-1 border-t border-tb-neutral-200 px-1 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-tb-primary">
              Left / right balance
            </span>
            <span className={`font-bold tabular-nums ${lat.status === 'fail' ? 'text-tb-danger' : lat.status === 'warn' ? 'text-tb-warning' : 'text-tb-success'}`}>
              {lat.imbalancePct < 0.5
                ? 'Balanced'
                : `${Math.round(Math.abs(lat.imbalanceKg))} kg ${lat.imbalanceKg > 0 ? 'right' : 'left'}-heavy (${lat.imbalancePct.toFixed(0)}%)`}
            </span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-tb-neutral-200">
            <div className="h-full bg-tb-primary-light/70" style={{ width: `${(lat.leftKg / (lat.leftKg + lat.rightKg)) * 100}%` }} />
            <div className="h-full bg-tb-primary/70" style={{ width: `${(lat.rightKg / (lat.leftKg + lat.rightKg)) * 100}%` }} />
          </div>
          {onMovePosition && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Drag a marked accessory to position it — the balance updates live.
            </p>
          )}
          {lat.overShareCorner && (
            <p className="mt-1.5 text-[11px] text-tb-danger">
              One tyre is over its share — redistribute weight toward the lighter
              side.
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
