'use client';

import type { SchematicModel } from './model';
import type { MetricStatus } from '@/lib/physics/types';

// Plan (top-down) view: the rig seen from above, so left/right distribution is
// visible. Same horizontal X-mapping as the side view (caravan trailing left,
// vehicle right); the vertical axis is lateral (top = left side, bottom = right).

const VB_W = 1000;
const PAD = 48;
const DRAW_W = VB_W - PAD * 2;
const WHEEL_W = 10;
const WHEEL_L = 22;

const STROKE = '#1b3a5c';
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
}: {
  x: number;
  y: number;
  n: number;
  weightKg: number;
}) {
  const r = Math.max(7, Math.min(15, 6 + Math.sqrt(weightKg) * 0.9));
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={STROKE}
        fillOpacity={0.88}
        stroke="#fff"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

export default function TopDownSchematic({ model }: { model: SchematicModel }) {
  const v = model.vehicle;
  const c = model.caravan;
  const lat = model.lateral;

  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const px = (mm: number) => PAD + (mm - model.minXMm) * scale;

  // Vertical: lateral. Widest body sets the height. +y (right) → downward.
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

  return (
    <figure
      className="border-tb-neutral-200 to-tb-neutral-50 mb-4 rounded-xl border bg-gradient-to-b from-white p-3"
      aria-label={`Top-down weight distribution for ${model.title}`}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" role="img">
        {/* centreline */}
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

        {/* Caravan (top-down) */}
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

        {/* Vehicle (top-down) — body + cab band */}
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

        {/* Accessory dots at X/Y */}
        {model.dots.map((d) => (
          <DotMark
            key={d.id}
            x={px(d.xMm)}
            y={py(d.yMm)}
            n={d.n}
            weightKg={d.weightKg}
          />
        ))}

        {/* Corner loads */}
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
      </svg>

      {/* Balance read-out */}
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
