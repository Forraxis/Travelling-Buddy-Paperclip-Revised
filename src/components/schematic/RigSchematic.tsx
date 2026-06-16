'use client';

import { useRef, useState } from 'react';
import {
  SCHEMATIC_MAX_HEIGHT_MM,
  type SchematicModel,
  type VehicleShape,
  type CaravanShape,
  type AxleGauge,
  type AccessoryDot,
} from './model';
import type { MetricStatus } from '@/lib/physics/types';

// ── Geometry constants (viewBox units) ───────────────────────────────────────
const VB_W = 1000;
const VB_H = 384;
const PAD = 48;
const DRAW_W = VB_W - PAD * 2;
const GROUND_Y = 250;
const WHEEL_R = 26;
const GAUGE_TOP = 288;
const GAUGE_H = 54;
// Vertical band the accessory dots occupy (heightHint 0 → base, 1 → top).
const BODY_TOP_Y = GROUND_Y - 126;
const BODY_BASE_Y = GROUND_Y - 16;
const HEIGHT_SNAP_MM = 25;

// ── Palette ───────────────────────────────────────────────────────────────────
const STROKE = '#1b3a5c';
const BODY = '#cdd9e6';
const BODY_VAN = '#dfe7ef';
const GLASS = '#eef4fa';
const TIRE = '#374151';
const RIM = '#9aa7b6';
const HUB = '#e8edf2';
const GROUND = '#e3e9f0';

function statusHex(status: MetricStatus): string {
  if (status === 'fail') return '#dc2626';
  if (status === 'warn') return '#d97706';
  return '#16a34a';
}

// ── Wheel (tyre + rim + hub) ─────────────────────────────────────────────────
function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={GROUND_Y} r={WHEEL_R} fill={TIRE} />
      <circle cx={cx} cy={GROUND_Y} r={WHEEL_R * 0.58} fill={RIM} />
      <circle cx={cx} cy={GROUND_Y} r={WHEEL_R * 0.24} fill={HUB} />
    </g>
  );
}

function Wheels({ xs }: { xs: number[] }) {
  return (
    <>
      {xs.map((x, i) => (
        <Wheel key={i} cx={x} />
      ))}
    </>
  );
}

// ── Vehicle silhouettes ──────────────────────────────────────────────────────
// All face right (front at far right). Returns body path + glass + detail.
function VehicleArt({ v, p }: { v: VehicleShape; p: (mm: number) => number }) {
  const rear = p(v.rearBumperMm);
  const front = p(v.frontBumperMm);
  const len = front - rear;
  const base = GROUND_Y - 8; // body sits just above the wheel centres
  const fill = v.kind === 'van' ? BODY_VAN : BODY;

  if (v.kind === 'ute') {
    const deck = GROUND_Y - 36; // tray deck
    const bonnet = GROUND_Y - 52;
    const roof = GROUND_Y - 104;
    const cabRear = rear + len * 0.4;
    const cabFront = rear + len * 0.66;
    const wsTop = rear + len * 0.6;
    const bonnetFront = rear + len * 0.82;
    return (
      <g>
        <path
          d={[
            `M ${rear} ${base}`,
            `L ${rear} ${deck} L ${rear + 6} ${deck - 4}`,
            `L ${cabRear} ${deck - 4} L ${cabRear} ${roof + 8}`,
            `Q ${cabRear} ${roof} ${cabRear + 10} ${roof}`,
            `L ${wsTop} ${roof}`,
            `L ${cabFront} ${bonnet + 6}`,
            `L ${bonnetFront} ${bonnet}`,
            `Q ${front} ${bonnet} ${front} ${bonnet + 14}`,
            `L ${front} ${base} Z`,
          ].join(' ')}
          fill={fill}
          stroke={STROKE}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* cab glass */}
        <path
          d={`M ${cabRear + 8} ${roof + 6} L ${wsTop - 6} ${roof + 6} L ${cabFront - 8} ${bonnet + 4} L ${cabRear + 8} ${bonnet + 4} Z`}
          fill={GLASS}
          stroke={STROKE}
          strokeWidth={1.2}
        />
        {/* B-pillar */}
        <line
          x1={(cabRear + cabFront) / 2 - 4}
          y1={roof + 6}
          x2={(cabRear + cabFront) / 2 - 4}
          y2={bonnet + 4}
          stroke={STROKE}
          strokeWidth={1.2}
        />
      </g>
    );
  }

  // wagon / suv / van share a single-box profile with per-kind roofline
  const roof =
    v.kind === 'van'
      ? GROUND_Y - 128
      : v.kind === 'suv'
        ? GROUND_Y - 110
        : GROUND_Y - 116;
  const beltline = GROUND_Y - 56;
  const bonnet = v.kind === 'van' ? GROUND_Y - 96 : GROUND_Y - 58;
  const roofStart = rear + len * (v.kind === 'van' ? 0.08 : 0.16);
  const roofEnd =
    rear + len * (v.kind === 'suv' ? 0.62 : v.kind === 'van' ? 0.78 : 0.66);
  const noseTop = rear + len * (v.kind === 'van' ? 0.84 : 0.8);
  return (
    <g>
      <path
        d={[
          `M ${rear} ${base}`,
          `L ${rear} ${beltline}`,
          `L ${roofStart} ${roof + 6} Q ${roofStart} ${roof} ${roofStart + 8} ${roof}`,
          `L ${roofEnd} ${roof}`,
          `L ${noseTop} ${bonnet}`,
          `L ${front - 6} ${bonnet} Q ${front} ${bonnet} ${front} ${bonnet + 12}`,
          `L ${front} ${base} Z`,
        ].join(' ')}
        fill={fill}
        stroke={STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* greenhouse glass with pillars */}
      <path
        d={`M ${roofStart + 10} ${roof + 6} L ${roofEnd - 6} ${roof + 6} L ${noseTop - 8} ${bonnet + 4} L ${rear + 10} ${bonnet + 4} L ${rear + 10} ${beltline - 4} Z`}
        fill={GLASS}
        stroke={STROKE}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {[0.38, 0.62].map((f, i) => {
        const x = roofStart + (roofEnd - roofStart) * f;
        return (
          <line
            key={i}
            x1={x}
            y1={roof + 6}
            x2={x}
            y2={bonnet + 2}
            stroke={STROKE}
            strokeWidth={1.2}
          />
        );
      })}
    </g>
  );
}

// ── Caravan silhouettes ──────────────────────────────────────────────────────
function CaravanArt({ c, p }: { c: CaravanShape; p: (mm: number) => number }) {
  const rear = p(c.bodyRearMm);
  const bodyFront = p(c.bodyFrontMm);
  const coupling = p(c.couplingMm);
  const len = bodyFront - rear;
  const base = GROUND_Y - 8;
  const drawY = GROUND_Y - 18;

  const roof =
    c.kind === 'camper'
      ? GROUND_Y - 64
      : c.kind === 'poptop'
        ? GROUND_Y - 88
        : c.kind === 'offroad'
          ? GROUND_Y - 124
          : GROUND_Y - 132;
  const floor = c.kind === 'offroad' ? GROUND_Y - 26 : GROUND_Y - 12; // raised clearance

  // A-frame drawbar from the body front down to the coupling.
  const drawbar = (
    <path
      d={`M ${bodyFront} ${base - 6} L ${coupling} ${drawY} L ${coupling} ${drawY + 5} L ${bodyFront - 2} ${base} Z`}
      fill={TIRE}
    />
  );

  let body;
  if (c.kind === 'camper') {
    body = (
      <path
        d={`M ${rear} ${floor} L ${rear} ${roof + 16} L ${rear + len * 0.22} ${roof} L ${bodyFront} ${roof + 6} L ${bodyFront} ${floor} Z`}
        fill={BODY_VAN}
        stroke={STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    );
  } else if (c.kind === 'poptop') {
    const wall = GROUND_Y - 64;
    body = (
      <g>
        <path
          d={`M ${rear} ${floor} L ${rear} ${wall} L ${bodyFront} ${wall} L ${bodyFront} ${floor} Z`}
          fill={BODY_VAN}
          stroke={STROKE}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* raised pop-top band */}
        <path
          d={`M ${rear + 10} ${wall} L ${rear + 16} ${roof} L ${bodyFront - 16} ${roof} L ${bodyFront - 10} ${wall} Z`}
          fill={GLASS}
          stroke={STROKE}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    );
  } else {
    // full-height / off-road box, slightly rounded top corners
    body = (
      <path
        d={[
          `M ${rear} ${floor}`,
          `L ${rear} ${roof + 12} Q ${rear} ${roof} ${rear + 12} ${roof}`,
          `L ${bodyFront - 12} ${roof} Q ${bodyFront} ${roof} ${bodyFront} ${roof + 12}`,
          `L ${bodyFront} ${floor} Z`,
        ].join(' ')}
        fill={BODY_VAN}
        stroke={STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    );
  }

  // Door (toward the front/kerb side) + window — only on full-height/off-road.
  const detail =
    c.kind === 'camper' || c.kind === 'poptop' ? null : (
      <g>
        <rect
          x={rear + len * 0.58}
          y={roof + 18}
          width={len * 0.16}
          height={floor - (roof + 18) - 4}
          rx={2}
          fill="none"
          stroke={STROKE}
          strokeWidth={1.4}
        />
        <rect
          x={rear + len * 0.18}
          y={roof + 18}
          width={len * 0.26}
          height={(floor - roof) * 0.34}
          rx={2}
          fill={GLASS}
          stroke={STROKE}
          strokeWidth={1.4}
        />
      </g>
    );

  return (
    <g>
      {drawbar}
      {body}
      {detail}
      {/* off-road: stone guard on the A-frame */}
      {c.kind === 'offroad' && (
        <rect
          x={bodyFront - 4}
          y={floor - 26}
          width={6}
          height={26}
          fill={TIRE}
        />
      )}
    </g>
  );
}

// ── Axle load gauge ──────────────────────────────────────────────────────────
function Gauge({ g, p }: { g: AxleGauge; p: (mm: number) => number }) {
  const x = p(g.xMm);
  const w = 18;
  const limitY = GAUGE_TOP + GAUGE_H * 0.16;
  const trackBottom = GAUGE_TOP + GAUGE_H;
  const trackH = trackBottom - limitY;
  const fillH = Math.min(g.ratio, 1) * trackH;
  const overH = g.ratio > 1 ? Math.min(g.ratio - 1, 0.4) * trackH : 0;
  const color = statusHex(g.status);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={limitY}
        width={w}
        height={trackH}
        rx={3}
        fill="#eef2f6"
      />
      <rect
        x={x - w / 2}
        y={trackBottom - fillH}
        width={w}
        height={fillH}
        rx={3}
        fill={color}
      />
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
      <line
        x1={x - w / 2 - 4}
        y1={limitY}
        x2={x + w / 2 + 4}
        y2={limitY}
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <text
        x={x}
        y={trackBottom + 16}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="#475569"
      >
        {g.label}
      </text>
      <text
        x={x}
        y={trackBottom + 30}
        textAnchor="middle"
        fontSize={11}
        fill={color}
        fontWeight={700}
      >
        {Math.round(g.loadKg).toLocaleString()} kg
      </text>
    </g>
  );
}

// ── Accessory dot ────────────────────────────────────────────────────────────
function Dot({
  d,
  p,
  dragging,
  onPointerDown,
  onToggleLock,
}: {
  d: AccessoryDot;
  p: (mm: number) => number;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onToggleLock?: (id: string, unlocked: boolean) => void;
}) {
  const x = p(d.xMm);
  const y = BODY_BASE_Y - d.heightHint * (BODY_BASE_Y - BODY_TOP_Y);
  const r = Math.max(8, Math.min(16, 6 + Math.sqrt(d.weightKg) * 0.95));
  // Catalogue accessories carry a lock toggle; custom loads are always free.
  const showLock = !d.isCustom && !!onToggleLock;
  return (
    <g>
      {d.editable && (
        <circle
          cx={x}
          cy={y}
          r={r + 5}
          fill="none"
          stroke="#e07a3f"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          opacity={dragging ? 1 : 0.6}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={STROKE}
        fillOpacity={0.9}
        stroke="#fff"
        strokeWidth={2}
        onPointerDown={d.editable ? onPointerDown : undefined}
        style={{
          cursor: d.editable ? (dragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#fff"
        pointerEvents="none"
      >
        {d.n}
      </text>
      {showLock && (
        <g
          onClick={() => onToggleLock!(d.id, !d.editable)}
          style={{ cursor: 'pointer' }}
        >
          <title>
            {d.editable
              ? 'Locked position is off — drag to reposition. Click to re-lock.'
              : 'Position locked to the known mounting. Click to unlock + reposition.'}
          </title>
          <circle
            cx={x + r + 7}
            cy={y - r - 3}
            r={7}
            fill="#fff"
            stroke={d.editable ? '#e07a3f' : '#94a3b8'}
            strokeWidth={1.25}
          />
          <text
            x={x + r + 7}
            y={y - r}
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
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface RigSchematicProps {
  model: SchematicModel;
  className?: string;
  /** When provided, editable dots can be dragged vertically to set their height (mm). */
  onMoveHeight?: (id: string, cogZMm: number) => void;
  /** When provided, catalogue accessories show a lock toggle. */
  onToggleLock?: (id: string, unlocked: boolean) => void;
}

export default function RigSchematic({
  model,
  className,
  onMoveHeight,
  onToggleLock,
}: RigSchematicProps) {
  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const p = (mm: number) => PAD + (mm - model.minXMm) * scale;

  const v = model.vehicle;
  const c = model.caravan;

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Pointer Y → clamped, snapped CoG height (mm). Vertical only — x/y unchanged.
  function eventToHeight(e: React.PointerEvent): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgY = ((e.clientY - rect.top) / rect.height) * VB_H;
    let hint = (BODY_BASE_Y - svgY) / (BODY_BASE_Y - BODY_TOP_Y);
    hint = Math.min(1, Math.max(0, hint));
    return (
      Math.round((hint * SCHEMATIC_MAX_HEIGHT_MM) / HEIGHT_SNAP_MM) *
      HEIGHT_SNAP_MM
    );
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId || !onMoveHeight) return;
    onMoveHeight(dragId, eventToHeight(e));
  }

  return (
    <figure
      className={`border-tb-neutral-200 to-tb-neutral-50 mb-4 rounded-xl border bg-gradient-to-b from-white p-3 ${className ?? ''}`}
      aria-label={`Side-profile weight schematic for ${model.title}`}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragId(null)}
        onPointerLeave={() => setDragId(null)}
      >
        {/* ground line + soft shadow */}
        <line
          x1={12}
          y1={GROUND_Y + WHEEL_R}
          x2={VB_W - 12}
          y2={GROUND_Y + WHEEL_R}
          stroke={GROUND}
          strokeWidth={2.5}
        />

        {c && (
          <g>
            <CaravanArt c={c} p={p} />
            <Wheels xs={c.axleMms.map(p)} />
          </g>
        )}

        <g>
          <VehicleArt v={v} p={p} />
          <Wheels xs={[v.rearAxleMm, v.frontAxleMm].map(p)} />
          {c && (
            <circle cx={p(v.hitchMm)} cy={GROUND_Y - 14} r={4} fill={TIRE} />
          )}
        </g>

        {model.dots.map((d) => (
          <Dot
            key={d.id}
            d={d}
            p={p}
            dragging={dragId === d.id}
            onToggleLock={onToggleLock}
            onPointerDown={(e) => {
              if (!d.editable || !onMoveHeight) return;
              setDragId(d.id);
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
          />
        ))}
        {model.axles.map((g) => (
          <Gauge key={g.id} g={g} p={p} />
        ))}
      </svg>

      {/* Legend + attribution — the screenshot artefact framing */}
      <figcaption className="border-tb-neutral-200 mt-2 flex items-end justify-between gap-3 border-t px-1 pt-2">
        <div className="min-w-0">
          <p className="text-tb-primary truncate text-sm font-semibold">
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
        <span className="text-tb-primary/40 shrink-0 text-[10px] font-semibold tracking-wide">
          TravellingBuddy
        </span>
      </figcaption>
    </figure>
  );
}
