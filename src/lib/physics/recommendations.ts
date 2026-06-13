import type {
  PhysicsInput,
  PhysicsResult,
  Recommendation,
  AccessoryLoad,
} from './types';
import {
  resolveVehiclePositionMm,
  resolveCaravanPositionMm,
} from './position-map';

function resolvedWeight(acc: AccessoryLoad): number {
  if (acc.tankCapacityL != null && acc.tankContentsKgPerL != null) {
    return (
      acc.tankCapacityL *
      acc.tankContentsKgPerL *
      (acc.fillPercent / 100) *
      acc.quantity
    );
  }
  return acc.installedWeightKg * acc.quantity;
}

export function generateRecommendations(
  input: PhysicsInput,
  result: PhysicsResult,
  vehicleAccessories: AccessoryLoad[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const { vehicle, caravan } = input;
  const vr = result.vehicle;
  const cr = result.caravan;

  // 1. GVM fail/warn
  if (vr.gvmStatus !== 'ok') {
    const overBy = Math.round(vr.totalWeightKg - vehicle.gvmKg);
    const topContributors = vehicleAccessories
      .map((a) => ({ name: a.mountingLocation, weight: resolvedWeight(a) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((a) => `${a.name} (${Math.round(a.weight)} kg)`)
      .join(', ');

    recs.push({
      id: 'gvm-exceeded',
      severity: vr.gvmStatus === 'fail' ? 'critical' : 'warn',
      metric: 'gvm',
      title: vr.gvmStatus === 'fail' ? 'GVM exceeded' : 'GVM approaching limit',
      body:
        vr.gvmStatus === 'fail'
          ? `Vehicle is ${overBy} kg over its Gross Vehicle Mass limit of ${vehicle.gvmKg} kg. Primary contributors: ${topContributors || 'payload and accessories'}.`
          : `Vehicle is at ${Math.round((vr.totalWeightKg / vehicle.gvmKg) * 100)}% of GVM. Close to the limit — consider reducing payload before adding more accessories.`,
      actions:
        vr.gvmStatus === 'fail'
          ? [
              {
                label: 'GVM upgrade kits for this vehicle',
                type: 'affiliate_search',
              },
            ]
          : undefined,
    });
  }

  // 2. Rear axle fail/warn
  if (vr.rearAxleStatus !== 'ok') {
    const overBy = Math.round(vr.rearAxleKg - vehicle.rearAxleLimitKg);

    // Rank accessories by their rearward moment contribution
    const contributorItems = vehicleAccessories.map((a) => {
      const posX =
        a.cogXMm != null
          ? a.cogXMm
          : resolveVehiclePositionMm(a.mountingLocation, vehicle);
      // Items at or behind rear axle (posX <= 0) apply rearward lever effect
      const momentContrib =
        (resolvedWeight(a) * (vehicle.wheelbaseMm - posX)) /
        vehicle.wheelbaseMm;
      return {
        location: a.mountingLocation,
        weight: resolvedWeight(a),
        contrib: momentContrib,
      };
    });
    contributorItems.sort((a, b) => b.contrib - a.contrib);
    const topRear = contributorItems
      .slice(0, 2)
      .map((c) => `${c.location} (${Math.round(c.weight)} kg)`);

    const hasTowBall =
      !!caravan && vr.towBallDownloadKg != null && vr.towBallDownloadKg > 200;
    const bodyLines = [
      vr.rearAxleStatus === 'fail'
        ? `Rear axle is ${overBy} kg over its limit of ${vehicle.rearAxleLimitKg} kg.`
        : `Rear axle is approaching its limit of ${vehicle.rearAxleLimitKg} kg.`,
    ];
    if (topRear.length)
      bodyLines.push(`Primary contributors: ${topRear.join(', ')}.`);
    if (hasTowBall)
      bodyLines.push(
        `Tow ball download of ${Math.round(vr.towBallDownloadKg!)} kg adds extra lever load to the rear axle. A weight distribution hitch can help.`,
      );

    recs.push({
      id: 'rear-axle-exceeded',
      severity: vr.rearAxleStatus === 'fail' ? 'critical' : 'warn',
      metric: 'rearAxle',
      title:
        vr.rearAxleStatus === 'fail'
          ? 'Rear axle overloaded'
          : 'Rear axle approaching limit',
      body: bodyLines.join(' '),
      actions: hasTowBall
        ? [{ label: 'Weight distribution hitches', type: 'affiliate_search' }]
        : undefined,
    });
  }

  // 3. Front axle light from tow ball lever — recommend WDH
  if (
    vr.towBallDownloadKg != null &&
    vr.towBallDownloadKg > 200 &&
    vr.frontAxleStatus !== 'ok'
  ) {
    recs.push({
      id: 'front-axle-wdh',
      severity: 'warn',
      metric: 'frontAxle',
      title: 'Front axle going light — weight distribution hitch recommended',
      body: `Tow ball download of ${Math.round(vr.towBallDownloadKg)} kg is pulling the front axle light. A correctly set-up WDH transfers 30–60% of tow ball download back to the front axle. Values shown above are without a WDH.`,
      actions: [
        { label: 'Weight distribution hitches', type: 'affiliate_search' },
      ],
    });
  }

  if (!caravan || !cr) return recs;

  // 4. TBM% too low (tail-heavy)
  if (
    vr.towBallPctStatus &&
    vr.towBallPctStatus !== 'ok' &&
    vr.towBallPctOfAtm! < 9
  ) {
    const caravanAccessories = input.caravanAccessories ?? [];
    const rearItems = caravanAccessories
      .map((a) => {
        const posX =
          a.cogXMm != null
            ? a.cogXMm
            : resolveCaravanPositionMm(a.mountingLocation, caravan);
        return {
          location: a.mountingLocation,
          weight: resolvedWeight(a),
          isRearward: posX > caravan.couplingToAxleMm,
        };
      })
      .filter((a) => a.isRearward)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((a) => `${a.location} (${Math.round(a.weight)} kg)`);

    const bodyLines = [
      `Tow ball mass is ${Math.round(vr.towBallPctOfAtm!)}% of ATM (minimum safe is 7%, ideal is 9–11%).`,
    ];
    if (rearItems.length) {
      bodyLines.push(
        `Items rearward of the axle reducing nose weight: ${rearItems.join(', ')}.`,
      );
    }
    bodyLines.push(
      'Moving heavy items (batteries, water tanks) forward of the caravan axle is the most effective fix. Internal redistribution is the only option when the cause is rear-mounted external accessories.',
    );

    recs.push({
      id: 'tbm-too-low',
      severity: vr.towBallPctStatus === 'fail' ? 'critical' : 'warn',
      metric: 'towBallPct',
      title: 'Tow ball mass too low — caravan is tail-heavy',
      body: bodyLines.join(' '),
    });
  }

  // 5. TBM% too high (nose-heavy)
  if (
    vr.towBallPctStatus &&
    vr.towBallPctStatus !== 'ok' &&
    vr.towBallPctOfAtm! > 11
  ) {
    const caravanAccessories = input.caravanAccessories ?? [];
    const forwardItems = caravanAccessories
      .map((a) => {
        const posX =
          a.cogXMm != null
            ? a.cogXMm
            : resolveCaravanPositionMm(a.mountingLocation, caravan);
        return {
          location: a.mountingLocation,
          weight: resolvedWeight(a),
          isForward: posX < caravan.couplingToAxleMm,
        };
      })
      .filter((a) => a.isForward)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((a) => `${a.location} (${Math.round(a.weight)} kg)`);

    recs.push({
      id: 'tbm-too-high',
      severity: vr.towBallPctStatus === 'fail' ? 'critical' : 'warn',
      metric: 'towBallPct',
      title: 'Tow ball mass too high — caravan is nose-heavy',
      body: `Tow ball mass is ${Math.round(vr.towBallPctOfAtm!)}% of ATM (maximum recommended is 12%). ${forwardItems.length ? `Heavy items forward of axle: ${forwardItems.join(', ')}. ` : ''}Consider redistributing heavy loads rearward inside the van.`,
    });
  }

  // 6. GCM fail/warn
  if (vr.gcmStatus && vr.gcmStatus !== 'ok') {
    const combined = Math.round(vr.gcmKg!);
    const limit = vehicle.gcmKg;
    recs.push({
      id: 'gcm-exceeded',
      severity: vr.gcmStatus === 'fail' ? 'critical' : 'warn',
      metric: 'gcm',
      title: vr.gcmStatus === 'fail' ? 'GCM exceeded' : 'GCM approaching limit',
      body: `Combined vehicle + caravan weight (${combined} kg) ${vr.gcmStatus === 'fail' ? 'exceeds' : 'is approaching'} the vehicle's Gross Combined Mass limit of ${limit} kg. Vehicle and caravan may each be individually legal but together exceed the vehicle's GCM. Options: GCM upgrade kit (if available), reduce vehicle payload, or reduce caravan payload.`,
      actions: [{ label: 'GCM upgrade kits', type: 'affiliate_search' }],
    });
  }

  // 7. ATM fail/warn
  if (cr.atmStatus !== 'ok') {
    const overBy = Math.round(cr.totalWeightKg - caravan.atmKg);
    recs.push({
      id: 'atm-exceeded',
      severity: cr.atmStatus === 'fail' ? 'critical' : 'warn',
      metric: 'atm',
      title:
        cr.atmStatus === 'fail'
          ? 'Caravan ATM exceeded'
          : 'Caravan ATM approaching limit',
      body:
        cr.atmStatus === 'fail'
          ? `Caravan is ${overBy} kg over its Aggregate Trailer Mass limit of ${caravan.atmKg} kg. Reduce load.`
          : `Caravan is approaching its ATM limit of ${caravan.atmKg} kg.`,
    });
  }

  // 8. GTM fail/warn
  if (cr.gtmStatus !== 'ok') {
    const overBy = Math.round(cr.gtmKg - caravan.gtmKg);
    recs.push({
      id: 'gtm-exceeded',
      severity: cr.gtmStatus === 'fail' ? 'critical' : 'warn',
      metric: 'gtm',
      title:
        cr.gtmStatus === 'fail'
          ? 'Caravan axle(s) overloaded'
          : 'Caravan axle(s) approaching limit',
      body:
        cr.gtmStatus === 'fail'
          ? `Caravan axle load (${Math.round(cr.gtmKg)} kg) exceeds the GTM limit of ${caravan.gtmKg} kg by ${overBy} kg. Reduce load.`
          : `Caravan axle load is approaching the GTM limit of ${caravan.gtmKg} kg.`,
    });
  }

  // 9. Caravan payload gone
  if (cr.payloadStatus === 'fail') {
    recs.push({
      id: 'payload-negative',
      severity: 'critical',
      metric: 'payload',
      title: 'Caravan payload exceeded',
      body: `This configuration exceeds the caravan's rated payload by ${Math.round(Math.abs(cr.payloadRemainingKg))} kg. Reduce accessories or load.`,
    });
  }

  return recs;
}
