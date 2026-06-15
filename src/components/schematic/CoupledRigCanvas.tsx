'use client';

import { useRef, useState } from 'react';
import type { SchematicModel, AccessoryDot } from './model';
import type { MetricStatus, PhysicsResult } from '@/lib/physics/types';
import { AccessoryGlyph, type IconId } from './accessory-icons';

// The layout-editor canvas: the whole coupled rig from above (caravan left,
// vehicle right, joined at the tow-ball). Drag accessories on EITHER side; the
// tow-ball, both axle loads, and both left/right balances update live. The
// tow-ball is the shared coupling — moving caravan gear fore/aft of the van axle
// changes it, which flows to the vehicle's rear axle.

const VB_W = 1100;
const PAD = 54;
const DRAW_W = VB_W - PAD * 2;
const WHEEL_W = 11;
const WHEEL_L = 24;
const GRID_MM = 25;

const STROKE = '#1b3a5c';
const ACCENT = '#c2603f';
const BODY = '#cdd9e6';
const BODY_VAN = '#dfe7ef';
const TIRE = '#374151';
const GLASS = '#eef4fa';

type Side = 'vehicle' | 'caravan';

function hex(s: MetricStatus): string {
  return s === 'fail' ? '#dc2626' : s === 'warn' ? '#d97706' : '#16a34a';
}
function snap(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}

function WheelMark({ x, y }: { x: number; y: number }) {
  return (
    <rect x={x - WHEEL_L / 2} y={y - WHEEL_W / 2} width={WHEEL_L} height={WHEEL_W} rx={3} fill={TIRE} />
  );
}

function Footprint({
  x, y, w, h, n, side, icon, imageUrl, editable, active, dragging, isUnaccounted, onPointerDown, onClick,
}: {
  x: number; y: number; w: number; h: number; n: number; side: Side;
  icon: IconId; imageUrl?: string | null;
  editable: boolean; active: boolean; dragging: boolean; isUnaccounted?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
}) {
  // The weighbridge "unaccounted" residual is tinted violet + dashed so it reads
  // as distinct from real gear — the user knows it's the mass to drag into place.
  const fill = isUnaccounted ? '#7c3aed' : side === 'caravan' ? '#5b7da8' : ACCENT;
  const bw = Math.max(18, w);
  const bh = Math.max(16, h);
  const badge = 7.5;
  const clipId = `fp-${side}-${n}-${Math.round(x)}`;
  return (
    <g
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={{ cursor: editable ? (dragging ? 'grabbing' : 'grab') : 'pointer' }}
    >
      {(active || dragging) && (
        <rect x={x - bw / 2 - 4} y={y - bh / 2 - 4} width={bw + 8} height={bh + 8} rx={7}
          fill="none" stroke={fill} strokeWidth={2} strokeDasharray="4 2" />
      )}
      <rect x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx={4}
        fill={isUnaccounted ? '#f5f3ff' : '#fff'} fillOpacity={0.92} stroke={fill} strokeWidth={1.6}
        strokeDasharray={isUnaccounted ? '5 3' : undefined} />
      {imageUrl ? (
        <>
          <clipPath id={clipId}>
            <rect x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx={4} />
          </clipPath>
          <image href={imageUrl} x={x - bw / 2} y={y - bh / 2} width={bw} height={bh}
            preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        </>
      ) : (
        <AccessoryGlyph icon={icon} cx={x} cy={y} w={bw * 0.66} h={bh * 0.66} color={fill} />
      )}
      <circle cx={x - bw / 2 + badge} cy={y - bh / 2 + badge} r={badge} fill={fill} stroke="#fff" strokeWidth={1} />
      <text x={x - bw / 2 + badge} y={y - bh / 2 + badge + 2.8} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
        {n}
      </text>
    </g>
  );
}

function Bar({ leftKg, rightKg, status, label }: { leftKg: number; rightKg: number; status: MetricStatus; label: string }) {
  const total = Math.max(1, leftKg + rightKg);
  const imb = rightKg - leftKg;
  const pct = (Math.abs(imb) / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-tb-primary">{label}</span>
        <span className={`font-bold tabular-nums ${status === 'fail' ? 'text-tb-danger' : status === 'warn' ? 'text-tb-warning' : 'text-tb-success'}`}>
          {pct < 0.5 ? 'Balanced' : `${Math.round(Math.abs(imb))} kg ${imb > 0 ? 'right' : 'left'} (${pct.toFixed(0)}%)`}
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-tb-neutral-200">
        <div className="h-full bg-tb-primary-light/70" style={{ width: `${(leftKg / total) * 100}%` }} />
        <div className="h-full bg-tb-primary/70" style={{ width: `${(rightKg / total) * 100}%` }} />
      </div>
    </div>
  );
}

function AxleRow({ label, solo, towing, limit }: { label: string; solo: number; towing: number; limit: number }) {
  const w = (v: number) => `${Math.min(100, (v / (limit * 1.15)) * 100)}%`;
  const st = (v: number): MetricStatus => (v > limit ? 'fail' : v > limit * 0.95 ? 'warn' : 'ok');
  const delta = Math.round(towing - solo);
  return (
    <div className="grid grid-cols-[68px_1fr_auto] items-center gap-2 text-[11px]">
      <span className="text-gray-500">{label}</span>
      <div className="space-y-0.5">
        <div className="flex h-2 overflow-hidden rounded bg-gray-100">
          <div className="h-full rounded bg-gray-400" style={{ width: w(solo) }} title="Solo" />
        </div>
        <div className="flex h-2 overflow-hidden rounded bg-gray-100">
          <div className="h-full rounded" style={{ width: w(towing), backgroundColor: hex(st(towing)) }} title="Towing" />
        </div>
      </div>
      <span className="tabular-nums text-gray-600">
        {Math.round(solo)}→{Math.round(towing)}
        {delta !== 0 && (
          <span className={delta > 0 ? 'text-tb-danger' : 'text-tb-success'}> ({delta > 0 ? '+' : ''}{delta})</span>
        )}
      </span>
    </div>
  );
}

export interface CoupledRigCanvasProps {
  model: SchematicModel;
  result: PhysicsResult;
  onMove: (side: Side, id: string, cogXMm: number, cogYMm: number) => void;
  onRemove?: (side: Side, id: string) => void;
}

export default function CoupledRigCanvas({ model, result, onMove, onRemove }: CoupledRigCanvasProps) {
  const v = model.vehicle;
  const c = model.caravan;
  const lat = model.lateral;
  const cLat = model.caravanLateral;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; side: Side } | null>(null);
  const [selected, setSelected] = useState<{ id: string; side: Side } | null>(null);

  const span = Math.max(1, model.maxXMm - model.minXMm);
  const scale = DRAW_W / span;
  const px = (mm: number) => PAD + (mm - model.minXMm) * scale;
  const sx = (mm: number) => mm * scale;

  const maxHalfW = Math.max(v.widthMm, c?.widthMm ?? 0, v.trackWidthMm) / 2 + 220;
  const bodyH = maxHalfW * 2 * scale;
  const centerY = 44 + bodyH / 2;
  const VB_H = centerY + bodyH / 2 + 50;
  const py = (mm: number) => centerY + mm * scale;

  const vHalf = (v.widthMm / 2) * scale;
  const vTrack = (v.trackWidthMm / 2) * scale;
  const vRear = px(v.rearBumperMm);
  const vFront = px(v.frontBumperMm);
  const cabStart = vRear + (vFront - vRear) * 0.42;
  const cabEnd = vRear + (vFront - vRear) * 0.66;

  const towBall = result.vehicle.towBallDownloadKg ?? 0;

  function eventToMm(side: Side, e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VB_H;
    const globalX = model.minXMm + (svgX - PAD) / scale;
    let cogY = snap((svgY - centerY) / scale);
    if (side === 'vehicle') {
      let cogX = snap(globalX);
      cogX = Math.max(v.rearBumperMm, Math.min(v.frontBumperMm, cogX));
      const half = v.widthMm / 2;
      cogY = Math.max(-half, Math.min(half, cogY));
      return { cogX, cogY };
    }
    // Caravan frame: x measured from coupling (= hitch), +rearward.
    let cogX = snap(v.hitchMm - globalX);
    const maxX = c ? v.hitchMm - c.bodyRearMm : cogX;
    cogX = Math.max(0, Math.min(maxX, cogX));
    const half = (c?.widthMm ?? v.widthMm) / 2;
    cogY = Math.max(-half, Math.min(half, cogY));
    return { cogX, cogY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const { cogX, cogY } = eventToMm(drag.side, e);
    onMove(drag.side, drag.id, cogX, cogY);
  }
  function endDrag() {
    setDrag(null);
  }

  // Solo (unhitched) axle loads — remove the tow-ball, which acts behind the
  // rear axle. Shows what coupling the van does to the vehicle.
  const wb = v.frontAxleMm; // rear axle = 0, front = wheelbase
  const rearOverhang = Math.max(1, -v.hitchMm);
  const tbFront = (towBall * -rearOverhang) / wb; // negative
  const soloFront = result.vehicle.frontAxleKg - tbFront;
  const soloRear = result.vehicle.rearAxleKg - (towBall - tbFront);

  function nudge(dx: number, dy: number) {
    if (!selected) return;
    const dot = model.dots.find((d) => d.id === selected.id);
    if (!dot) return;
    if (selected.side === 'vehicle') {
      onMove('vehicle', dot.id, snap(dot.xMm + dx), snap(dot.yMm + dy));
    } else {
      const cogX = v.hitchMm - dot.xMm; // back to caravan frame
      onMove('caravan', dot.id, snap(cogX - dx), snap(dot.yMm + dy));
    }
  }

  return (
    <div className="rounded-2xl border border-tb-neutral-200 bg-gradient-to-b from-white to-tb-neutral-50 p-3 shadow-sm">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Top-down layout for ${model.title}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <line x1={12} y1={centerY} x2={VB_W - 12} y2={centerY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="6 5" />
        <text x={16} y={centerY - vHalf - 8} fontSize={11} fontWeight={600} fill="#64748b">LEFT</text>
        <text x={16} y={centerY + vHalf + 18} fontSize={11} fontWeight={600} fill="#64748b">RIGHT</text>

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

        {/* Vehicle body + zones */}
        <g>
          <rect x={vRear} y={centerY - vHalf} width={vFront - vRear} height={vHalf * 2} rx={10} fill={BODY} stroke={STROKE} strokeWidth={2.5} />
          <rect x={cabStart} y={centerY - vHalf + 4} width={cabEnd - cabStart} height={vHalf * 2 - 8} rx={6} fill={GLASS} stroke={STROKE} strokeWidth={1.2} />
          <WheelMark x={px(v.frontAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.frontAxleMm)} y={centerY + vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY - vTrack} />
          <WheelMark x={px(v.rearAxleMm)} y={centerY + vTrack} />
        </g>
        {model.zones.map((z, i) => {
          const x0 = px(z.x0Mm), x1 = px(z.x1Mm);
          return (
            <g key={z.id}>
              <rect x={x0} y={centerY - vHalf} width={x1 - x0} height={vHalf * 2} fill={i % 2 === 0 ? STROKE : '#fff'} fillOpacity={0.04} />
              {i > 0 && <line x1={x0} y1={centerY - vHalf} x2={x0} y2={centerY + vHalf} stroke={STROKE} strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2 3" />}
              {x1 - x0 > 36 && <text x={(x0 + x1) / 2} y={centerY - vHalf - 6} textAnchor="middle" fontSize={9} fontWeight={500} fill="#94a3b8">{z.label}</text>}
            </g>
          );
        })}

        {/* Tow-ball coupling marker */}
        {c && (
          <g>
            <circle cx={px(v.hitchMm)} cy={centerY} r={6} fill={ACCENT} stroke="#fff" strokeWidth={2} />
            <text x={px(v.hitchMm)} y={centerY - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={ACCENT}>
              Tow-ball {Math.round(towBall)} kg
            </text>
          </g>
        )}

        {/* Footprints — both sides draggable */}
        {model.dots.map((d: AccessoryDot) => (
          <Footprint
            key={d.id}
            x={px(d.xMm)}
            y={py(d.yMm)}
            w={sx(d.footprintLengthMm)}
            h={sx(d.footprintWidthMm)}
            n={d.n}
            side={d.side}
            icon={d.iconId}
            imageUrl={d.topDownImageUrl}
            isUnaccounted={d.isUnaccounted}
            editable
            active={selected?.id === d.id}
            dragging={drag?.id === d.id}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag({ id: d.id, side: d.side });
              setSelected({ id: d.id, side: d.side });
            }}
            onClick={() => setSelected({ id: d.id, side: d.side })}
          />
        ))}
      </svg>

      {/* Selected-item nudge controls (precision + mobile fallback) */}
      {selected && (() => {
        const dot = model.dots.find((d) => d.id === selected.id);
        if (!dot) return null;
        return (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-tb-neutral-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-tb-ink">{dot.label}</span>
            <span className="text-gray-400">·</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">fore/aft</span>
              <button type="button" onClick={() => nudge(-50, 0)} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">◀</button>
              <button type="button" onClick={() => nudge(50, 0)} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">▶</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">left/right</span>
              <button type="button" onClick={() => nudge(0, -50)} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">▲</button>
              <button type="button" onClick={() => nudge(0, 50)} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">▼</button>
            </div>
            {onRemove && (
              <button type="button" onClick={() => { onRemove(selected.side, selected.id); setSelected(null); }} className="ml-auto rounded border border-tb-danger/30 px-2 py-0.5 text-tb-danger hover:bg-tb-danger/5">
                Remove
              </button>
            )}
          </div>
        );
      })()}

      {/* Balances */}
      <div className="mt-3 grid gap-3 border-t border-tb-neutral-200 pt-3 sm:grid-cols-2">
        {lat && <Bar leftKg={lat.leftKg} rightKg={lat.rightKg} status={lat.status} label="Vehicle L/R" />}
        {cLat && <Bar leftKg={cLat.leftKg} rightKg={cLat.rightKg} status={cLat.status} label="Caravan L/R" />}
      </div>

      {/* Hitched vs unhitched compare strip */}
      {c && (
        <div className="mt-3 rounded-lg border border-tb-neutral-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-tb-ink">
            Coupling the van — solo → towing
          </p>
          <div className="space-y-1.5">
            <AxleRow label="Front axle" solo={soloFront} towing={result.vehicle.frontAxleKg} limit={result.vehicle.frontAxleLimitKg} />
            <AxleRow label="Rear axle" solo={soloRear} towing={result.vehicle.rearAxleKg} limit={result.vehicle.rearAxleLimitKg} />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Top bar = unhitched, bottom = with the van on. Hitching lifts weight
            off the front axle onto the rear.
          </p>
        </div>
      )}
    </div>
  );
}
