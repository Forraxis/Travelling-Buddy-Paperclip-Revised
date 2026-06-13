'use client';

import type {
  SchematicModel,
  VehicleShape,
  CaravanShape,
  AxleGauge,
  AccessoryDot,
} from './model';
import type { MetricStatus } from '@/lib/physics/types';

// ── Geometry constants (viewBox units) ───────────────────────────────────────
const VB_W = 920;
const VB_H = 360;
const PAD = 44;
const DRAW_W = VB_W - PAD * 2;
const GROUND_Y = 248;
const WHEEL_R = 24;
const GAUGE_TOP = 280;
const GAUGE_H = 58;

const TB_PRIMARY = '#1b3a5c';
const BODY_FILL = '#cbd5e1';
const BODY_FILL_VAN = '#e2e8f0';
const WHEEL = '#475569';
const WHEEL_HUB = '#cbd5e1';

function statusHex(status: MetricStatus): string {
  if (status === 'fail') return '#dc2626';
  if (status === 'warn') return '#d97706';
  return '#16a34a';
}

// ── Silhouette path builders ─────────────────────────────────────────────────
// All take an x-mapping function and the relevant shape, return an SVG path.

function utePath(p: (mm: number) => number, v: VehicleShape): string {
  const rear = p(v.rearBumperMm);
  const front = p(v.frontBumperMm);
  const frontAxle = p(v.frontAxleMm);
  const cabFront = frontAxle + (front - frontAxle) * 0.15;
  const cabRear = rear + (front - rear) * 0.42;
  const deck = GROUND_Y - 30; // tray deck height
  const bonnet = GROUND_Y - 46;
  const roof = GROUND_Y - 96;
  const windscreenTop = cabRear + (cabFront - cabRear) * 0.55;
  return [
    `M ${rear} ${deck}`,
    `L ${rear} ${GROUND_Y - 10}`,
    `L ${front} ${GROUND_Y - 10}`,
    `L ${front} ${bonnet}`,
    `L ${cabFront} ${bonnet}`,
    `L ${windscreenTop} ${roof}`,
    `L ${cabRear} ${roof}`,
    `L ${cabRear} ${deck}`,
    'Z',
  ].join(' ');
}

function wagonPath(p: (mm: number) => number, v: VehicleShape): string {
  const rear = p(v.rearBumperMm);
  const front = p(v.frontBumperMm);
  const base = GROUND_Y - 10;
  const beltline = GROUND_Y - 40;
  const roof = GROUND_Y - 100;
  const bonnet = GROUND_Y - 52;
  const roofStart = rear + (front - rear) * 0.18;
  const roofEnd = rear + (front - rear) * 0.66;
  const bonnetStart = rear + (front - rear) * 0.78;
  return [
    `M ${rear} ${base}`,
    `L ${rear} ${beltline}`,
    `L ${roofStart} ${roof}`,
    `L ${roofEnd} ${roof}`,
    `L ${bonnetStart} ${bonnet}`,
    `L ${front} ${bonnet}`,
    `L ${front} ${base}`,
    'Z',
  ].join(' ');
}

function vanPath(p: (mm: number) => number, v: VehicleShape): string {
  const rear = p(v.rearBumperMm);
  const front = p(v.frontBumperMm);
  const base = GROUND_Y - 10;
  const roof = GROUND_Y - 112;
  const bonnet = GROUND_Y - 70;
  const nose = rear + (front - rear) * 0.82;
  return [
    `M ${rear} ${base}`,
    `L ${rear} ${roof}`,
    `L ${nose} ${roof}`,
    `L ${front} ${bonnet}`,
    `L ${front} ${base}`,
    'Z',
  ].join(' ');
}

function vehiclePath(p: (mm: number) => number, v: VehicleShape): string {
  if (v.kind === 'ute') return utePath(p, v);
  if (v.kind === 'van') return vanPath(p, v);
  return wagonPath(p, v);
}

function caravanPaths(
  p: (mm: number) => number,
  c: CaravanShape,
): { body: string; drawbar: string } {
  const rear = p(c.bodyRearMm);
  const bodyFront = p(c.bodyFrontMm);
  const coupling = p(c.couplingMm);
  const base = GROUND_Y - 10;
  const roof =
    c.kind === 'camper'
      ? GROUND_Y - 58
      : c.kind === 'poptop'
        ? GROUND_Y - 96
        : GROUND_Y - 118;
  const drawY = GROUND_Y - 22;

  let body: string;
  if (c.kind === 'camper') {
    // Low wedge.
    body = [
      `M ${rear} ${base}`,
      `L ${rear} ${roof + 14}`,
      `L ${bodyFront} ${roof}`,
      `L ${bodyFront} ${base}`,
      'Z',
    ].join(' ');
  } else if (c.kind === 'poptop') {
    // Box with a slightly inset raised top band.
    const bandTop = roof;
    const wallTop = GROUND_Y - 70;
    body = [
      `M ${rear} ${base}`,
      `L ${rear} ${wallTop}`,
      `L ${rear + (bodyFront - rear) * 0.12} ${bandTop}`,
      `L ${bodyFront - (bodyFront - rear) * 0.12} ${bandTop}`,
      `L ${bodyFront} ${wallTop}`,
      `L ${bodyFront} ${base}`,
      'Z',
    ].join(' ');
  } else {
    body = [
      `M ${rear} ${base}`,
      `L ${rear} ${roof}`,
      `L ${bodyFront} ${roof}`,
      `L ${bodyFront} ${base}`,
      'Z',
    ].join(' ');
  }

  // A-frame drawbar from body front down to the coupling.
  const drawbar = `M ${bodyFront} ${base - 4} L ${coupling} ${drawY} L ${coupling} ${drawY + 6} L ${bodyFront} ${base + 2} Z`;
  return { body, drawbar };
}

// ── Axle load gauge (vertical bar beneath an axle) ───────────────────────────
function Gauge({ g, p }: { g: AxleGauge; p: (mm: number) => number }) {
  const x = p(g.xMm);
  const w = 16;
  const limitY = GAUGE_TOP + GAUGE_H * 0.18; // limit line near the top of the track
  const trackBottom = GAUGE_TOP + GAUGE_H;
  const trackH = trackBottom - limitY; // height representing 0..limit
  const fillH = Math.min(g.ratio, 1) * trackH;
  const overH = g.ratio > 1 ? Math.min(g.ratio - 1, 0.5) * trackH : 0;
  const fillY = trackBottom - fillH;
  const color = statusHex(g.status);
  return (
    <g>
      {/* track */}
      <rect
        x={x - w / 2}
        y={limitY}
        width={w}
        height={trackH}
        rx={3}
        fill="#eef2f6"
      />
      {/* fill */}
      <rect
        x={x - w / 2}
        y={fillY}
        width={w}
        height={fillH}
        rx={3}
        fill={color}
      />
      {/* overflow cap above limit line */}
      {overH > 0 && (
        <rect
          x={x - w / 2}
          y={limitY - overH}
          width={w}
          height={overH}
          rx={3}
          fill="#dc2626"
        />
      )}
      {/* limit tick */}
      <line
        x1={x - w / 2 - 3}
        y1={limitY}
        x2={x + w / 2 + 3}
        y2={limitY}
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <text
        x={x}
        y={trackBottom + 13}
        textAnchor="middle"
        fontSize={11}
        fill="#64748b"
      >
        {g.label}
      </text>
      <text
        x={x}
        y={trackBottom + 25}
        textAnchor="middle"
        fontSize={10}
        fill={color}
        fontWeight={600}
      >
        {Math.round(g.loadKg)}/{Math.round(g.limitKg)}
      </text>
    </g>
  );
}

// ── Accessory dot ────────────────────────────────────────────────────────────
function Dot({ d, p }: { d: AccessoryDot; p: (mm: number) => number }) {
  const x = p(d.xMm);
  const bodyTop = GROUND_Y - 118;
  const bodyBase = GROUND_Y - 14;
  const y = bodyBase - d.heightHint * (bodyBase - bodyTop);
  const r = Math.max(7, Math.min(15, 6 + Math.sqrt(d.weightKg) * 0.9));
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={TB_PRIMARY}
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
        {d.n}
      </text>
    </g>
  );
}

function Wheels({
  axleMms,
  p,
}: {
  axleMms: number[];
  p: (mm: number) => number;
}) {
  return (
    <>
      {axleMms.map((mm, i) => {
        const x = p(mm);
        return (
          <g key={i}>
            <circle cx={x} cy={GROUND_Y} r={WHEEL_R} fill={WHEEL} />
            <circle cx={x} cy={GROUND_Y} r={WHEEL_R * 0.42} fill={WHEEL_HUB} />
          </g>
        );
      })}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface RigSchematicProps {
  model: SchematicModel;
  className?: string;
}

export default function RigSchematic({ model, className }: RigSchematicProps) {
  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const p = (mm: number) => PAD + (mm - model.minXMm) * scale;

  const v = model.vehicle;
  const c = model.caravan;
  const caravanPs = c ? caravanPaths(p, c) : null;

  return (
    <figure
      className={`border-tb-neutral-200 mb-4 rounded-lg border bg-white p-3 ${className ?? ''}`}
      aria-label={`Side-profile weight schematic for ${model.title}`}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full"
        role="img"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* ground line */}
        <line
          x1={8}
          y1={GROUND_Y}
          x2={VB_W - 8}
          y2={GROUND_Y}
          stroke="#e2e8f0"
          strokeWidth={2}
        />

        {/* caravan (drawn first so the vehicle overlaps the coupling) */}
        {c && caravanPs && (
          <g>
            <path d={caravanPs.drawbar} fill={WHEEL} />
            <path
              d={caravanPs.body}
              fill={BODY_FILL_VAN}
              stroke={TB_PRIMARY}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <Wheels axleMms={c.axleMms} p={p} />
          </g>
        )}

        {/* vehicle */}
        <g>
          <path
            d={vehiclePath(p, v)}
            fill={v.kind === 'van' ? BODY_FILL_VAN : BODY_FILL}
            stroke={TB_PRIMARY}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Wheels axleMms={[v.rearAxleMm, v.frontAxleMm]} p={p} />
          {/* tow hitch nub */}
          {c && (
            <circle cx={p(v.hitchMm)} cy={GROUND_Y - 14} r={4} fill={WHEEL} />
          )}
        </g>

        {/* accessory dots */}
        {model.dots.map((d) => (
          <Dot key={d.id} d={d} p={p} />
        ))}

        {/* axle gauges */}
        {model.axles.map((g) => (
          <Gauge key={g.id} g={g} p={p} />
        ))}
      </svg>

      {/* Legend + attribution — the screenshot artefact framing */}
      <figcaption className="mt-1 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-tb-primary truncate text-xs font-semibold">
            {model.title}
          </p>
          {model.dots.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {model.dots.map((d) => (
                <li key={d.id} className="text-[10px] text-gray-500">
                  <span className="text-tb-primary font-semibold">{d.n}.</span>{' '}
                  {d.label}{' '}
                  <span className="text-gray-400 tabular-nums">
                    {Math.round(d.weightKg)} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-medium text-gray-300">
          TravellingBuddy
        </span>
      </figcaption>
    </figure>
  );
}
