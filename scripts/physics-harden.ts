/**
 * Physics hardening check (run: npx jiti scripts/physics-harden.ts)
 *
 * Validation evidence for the caravan axle-split / TBM model sign-off. For every
 * catalogue caravan it computes the BARE-VAN tow ball mass (tare only, no water,
 * no accessories) and compares it to the manufacturer-published TBM. Since the
 * tare CoG is anchored to the published TBM, the bare figure should reproduce
 * the manufacturer value exactly across the whole catalogue (regression guard
 * against the old fixed-fraction model, which was ~15% off on average). It also
 * sanity-checks the per-axle split (count + sums to GTM) and vehicle axle loads.
 */
import { prisma } from '../src/lib/db';
import { calculate } from '../src/lib/physics/engine';
import type { PhysicsInput } from '../src/lib/physics/types';

const num = (x: unknown): number => Number(x ?? 0);

async function main() {
  const refVehicleRow = await prisma.vehicleVariant.findFirst({
    where: { status: 'CATALOGUE' },
  });
  if (!refVehicleRow) throw new Error('no vehicle to use as reference');
  const refVehicle: PhysicsInput['vehicle'] = {
    gvmKg: num(refVehicleRow.gvmKg),
    gcmKg: num(refVehicleRow.gcmKg),
    kerbWeightKg: num(refVehicleRow.kerbWeightKg),
    maxTowingCapacityKg: num(refVehicleRow.maxTowingCapacityKg),
    frontAxleLimitKg: num(refVehicleRow.frontAxleLimitKg),
    rearAxleLimitKg: num(refVehicleRow.rearAxleLimitKg),
    maxTowBallDownloadKg: num(refVehicleRow.maxTowBallDownloadKg),
    wheelbaseMm: num(refVehicleRow.wheelbaseMm),
    frontOverhangMm: num(refVehicleRow.frontOverhangMm),
    rearOverhangMm: num(refVehicleRow.rearOverhangMm),
    fuelTankCapacityL: num(refVehicleRow.fuelTankCapacityL),
    fuelType: refVehicleRow.fuelType ?? 'DIESEL',
  };

  // ── Caravan TBM: computed bare-van vs published ─────────────────────────────
  const caravans = await prisma.caravanVariant.findMany({
    where: { status: 'CATALOGUE' },
    include: { model: { include: { make: true } } },
  });

  const devs: number[] = [];
  const tbmOutliers: string[] = [];
  const axleProblems: string[] = [];

  for (const c of caravans) {
    const input: PhysicsInput = {
      vehicle: refVehicle,
      caravan: {
        atmKg: num(c.atmKg),
        gtmKg: num(c.gtmKg),
        tareKg: num(c.tareKg),
        tbmKg: num(c.tbmKg),
        axleConfiguration: c.axleConfiguration,
        couplingToAxleMm: num(c.couplingToAxleMm),
        axleSpacingMm: c.axleSpacingMm == null ? null : num(c.axleSpacingMm),
        freshWaterCapacityL: num(c.freshWaterCapacityL),
        greyWaterCapacityL: num(c.greyWaterCapacityL),
      },
      vehicleAccessories: [],
      caravanAccessories: [],
      passengers: 0,
      cargoKg: 0,
      fuelPercent: 0,
      freshWaterPercent: 0,
      greyWaterPercent: 0,
      regulationSetCode: 'AU_ADR',
    };
    const r = calculate(input);
    const name = `${c.model.make.name} ${c.model.name} ${c.name}`;

    const published = num(c.tbmKg);
    const computed = r.caravan!.towBallMassKg;
    const devPct =
      published > 0 ? ((computed - published) / published) * 100 : 0;
    devs.push(Math.abs(devPct));
    if (Math.abs(devPct) > 10) {
      tbmOutliers.push(
        `  ${name} [${c.axleConfiguration}]: published ${published}kg vs computed ${computed.toFixed(0)}kg (${devPct > 0 ? '+' : ''}${devPct.toFixed(1)}%)`,
      );
    }

    // Per-axle sanity
    const axles = r.caravan!.axles;
    const expected =
      c.axleConfiguration === 'TRIPLE_AXLE'
        ? 3
        : c.axleConfiguration === 'SINGLE_AXLE'
          ? 1
          : 2;
    const sum = axles.reduce((s, a) => s + a.loadKg, 0);
    if (axles.length !== expected)
      axleProblems.push(`  ${name}: axle count ${axles.length} != ${expected}`);
    if (Math.abs(sum - r.caravan!.gtmKg) > 1)
      axleProblems.push(
        `  ${name}: axle sum ${sum.toFixed(0)} != GTM ${r.caravan!.gtmKg.toFixed(0)}`,
      );
  }

  const within5 = devs.filter((d) => d <= 5).length;
  const within10 = devs.filter((d) => d <= 10).length;
  const maxDev = Math.max(...devs);
  const meanDev = devs.reduce((s, d) => s + d, 0) / devs.length;

  console.log(
    `\n=== Caravan TBM (bare van: computed vs published) — n=${caravans.length} ===`,
  );
  console.log(`  within 5%:  ${within5}/${caravans.length}`);
  console.log(`  within 10%: ${within10}/${caravans.length}`);
  console.log(
    `  mean abs deviation: ${meanDev.toFixed(2)}%  |  max: ${maxDev.toFixed(2)}%`,
  );
  if (tbmOutliers.length) {
    console.log(`  outliers (>10%):`);
    tbmOutliers.forEach((o) => console.log(o));
  } else console.log(`  no outliers >10%`);

  console.log(`\n=== Per-axle split sanity ===`);
  if (axleProblems.length) axleProblems.forEach((p) => console.log(p));
  else console.log(`  all caravans: axle count correct + axles sum to GTM ✓`);

  // ── Vehicle axle-load numerical sanity (no published axle weights to compare) ─
  const vehicles = await prisma.vehicleVariant.findMany({
    where: { status: 'CATALOGUE' },
  });
  let vehProblems = 0;
  for (const v of vehicles) {
    const input: PhysicsInput = {
      vehicle: {
        gvmKg: num(v.gvmKg),
        gcmKg: num(v.gcmKg),
        kerbWeightKg: num(v.kerbWeightKg),
        maxTowingCapacityKg: num(v.maxTowingCapacityKg),
        frontAxleLimitKg: num(v.frontAxleLimitKg),
        rearAxleLimitKg: num(v.rearAxleLimitKg),
        maxTowBallDownloadKg: num(v.maxTowBallDownloadKg),
        wheelbaseMm: num(v.wheelbaseMm),
        frontOverhangMm: num(v.frontOverhangMm),
        rearOverhangMm: num(v.rearOverhangMm),
        fuelTankCapacityL: num(v.fuelTankCapacityL),
        fuelType: v.fuelType ?? 'DIESEL',
      },
      vehicleAccessories: [],
      caravanAccessories: [],
      passengers: 0,
      cargoKg: 0,
      fuelPercent: 0,
      freshWaterPercent: 0,
      greyWaterPercent: 0,
      regulationSetCode: 'AU_ADR',
    };
    const r = calculate(input);
    const f = r.vehicle.frontAxleKg;
    const rear = r.vehicle.rearAxleKg;
    if (!isFinite(f) || !isFinite(rear) || f < 0 || rear < 0) vehProblems++;
    // front+rear should equal total kerb (bare) within rounding
    if (Math.abs(f + rear - r.vehicle.totalWeightKg) > 1) vehProblems++;
  }
  console.log(`\n=== Vehicle bare axle-load sanity — n=${vehicles.length} ===`);
  console.log(
    vehProblems === 0
      ? `  all vehicles: front+rear finite, positive, and sum to total ✓`
      : `  ${vehProblems} vehicles with axle-load anomalies`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
