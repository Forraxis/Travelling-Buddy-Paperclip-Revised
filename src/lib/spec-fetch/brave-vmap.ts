/**
 * Shared dork-vehicle → catalogue-model map for the Brave spec pipeline.
 *
 * One source of truth for BOTH the search (which vehicles to dork) and the landing
 * (which catalogue models a finding can belong to). `slugs` is a LIST because the
 * catalogue often splits one nameplate across several models — the clean QLD slug
 * plus ROVER gen-coded siblings (e.g. `bt-50` + `bt-50d`, `triton` + `triton-lb-lc`).
 * A finding fans out to every listed slug; GVM-matching then routes it to the right
 * generation within each. Keep the original-run keys verbatim so the already-extracted
 * .brave-extracted.jsonl still maps.
 */
export interface VMapEntry {
  make: string;
  slugs: string[];
}

export const VMAP: Record<string, VMapEntry> = {
  // ---- original run (keep verbatim — existing .brave-extracted.jsonl maps to these) ----
  'toyota rav4': { make: 'Toyota', slugs: ['rav4'] },
  'nissan x-trail': { make: 'Nissan', slugs: ['x-trail'] },
  'mazda cx-5': { make: 'Mazda', slugs: ['cx-5'] },
  'holden colorado': { make: 'Holden', slugs: ['colorado'] },
  'mitsubishi outlander': { make: 'Mitsubishi', slugs: ['outlander'] },
  'holden commodore': { make: 'Holden', slugs: ['commodore'] },
  'subaru forester': { make: 'Subaru', slugs: ['forester'] },
  'mitsubishi asx': { make: 'Mitsubishi', slugs: ['asx'] },
  'mitsubishi pajero': { make: 'Mitsubishi', slugs: ['pajero'] },
  'hyundai tucson': { make: 'Hyundai', slugs: ['tucson'] },
  'ford falcon': { make: 'Ford', slugs: ['falcon'] },
  'honda cr-v': { make: 'Honda', slugs: ['cr-v'] },
  'holden rodeo': { make: 'Holden', slugs: ['rodeo'] },
  'toyota kluger': { make: 'Toyota', slugs: ['kluger'] },
  'toyota hiace': { make: 'Toyota', slugs: ['hiace'] },
  'holden captiva': { make: 'Holden', slugs: ['captiva'] },
  'mazda cx-3': { make: 'Mazda', slugs: ['cx-3'] },
  'kia sportage': { make: 'Kia', slugs: ['sportage'] },
  'nissan navara d40': { make: 'Nissan', slugs: ['navara'] },
  'mitsubishi triton': {
    make: 'Mitsubishi',
    slugs: ['triton', 'triton-lb-lc'],
  },
  'volkswagen amarok': { make: 'Volkswagen', slugs: ['amarok'] },

  // ---- next tier: gen-split deepening (fill the sibling gen the old map missed) ----
  'mazda bt-50': { make: 'Mazda', slugs: ['bt-50', 'bt-50d'] },
  'nissan navara np300': { make: 'Nissan', slugs: ['navara'] },
  'nissan patrol': { make: 'Nissan', slugs: ['patrol'] },

  // ---- next tier: American pickups (heavy tow, no coverage) ----
  'chevrolet silverado': { make: 'Chevrolet', slugs: ['silverado'] },
  'ram 1500': { make: 'Dodge', slugs: ['ram-1500', 'ram-d1', 'ram-dx'] },
  'ram 2500': { make: 'Dodge', slugs: ['ram-2500'] },
  'ford f-150': { make: 'Ford', slugs: ['f-150', 'f150'] },
  'toyota tundra': { make: 'Toyota', slugs: ['tundra'] },

  // ---- next tier: 4WD wagons / utes ----
  'jeep gladiator': { make: 'Jeep', slugs: ['gladiator', 'gladiator-jt-na'] },
  'jeep wrangler': {
    make: 'Jeep',
    slugs: ['wrangler', 'jl-wrangler', 'wrangler-unlimited'],
  },
  'jeep grand cherokee': { make: 'Jeep', slugs: ['grand-cherokee-wl'] },
  'land rover defender': { make: 'Land Rover', slugs: ['defender'] },
  'land rover discovery': { make: 'Land Rover', slugs: ['discovery'] },
  'ssangyong musso': {
    make: 'SsangYong',
    slugs: ['musso', 'musso-sports'],
  },
  'ssangyong rexton': { make: 'SsangYong', slugs: ['rexton'] },
  'ldv t60': { make: 'LDV', slugs: ['t60', 't60-max'] },
  'ldv d90': { make: 'LDV', slugs: ['d90'] },
  'gwm cannon': { make: 'GWM', slugs: ['cannon', 'npw'] },
  'mitsubishi pajero sport': { make: 'Mitsubishi', slugs: ['pajero-sport'] },

  // ---- next tier: tow-capable vans ----
  'ford transit': { make: 'Ford', slugs: ['transit', 'transit-h-d-3'] },
  'mercedes-benz sprinter': {
    make: 'Mercedes-Benz',
    slugs: ['sprinter', '907-sprinter-hd'],
  },

  // ---- camper / motorhome BASE vans (axle-rich — vans publish GAWR; the load-on-the-van
  //      CoG case is core to the differentiator). VW/Renault/LDV use ROVER platform codes;
  //      candidate slugs are listed generously — GVM-matching in the land routes to the
  //      right model/gen, so an over-broad slug list can't mis-land. ----
  'fiat ducato': { make: 'Fiat', slugs: ['ducato', 'ducato-ii-series'] },
  'peugeot boxer': { make: 'Peugeot', slugs: ['x250-boxer-hd'] },
  'mercedes-benz vito': {
    make: 'Mercedes-Benz',
    slugs: ['vito', 'valente', '447n'],
  },
  'volkswagen crafter': {
    make: 'Volkswagen',
    slugs: ['type-sy1', 'type-sy2'],
  },
  'volkswagen transporter': {
    make: 'Volkswagen',
    slugs: [
      'transporter',
      'multivan',
      'type-t1',
      'type-nsn',
      'type-cr',
      'type-eb',
      'type-ebn',
    ],
  },
  'volkswagen caddy': {
    make: 'Volkswagen',
    slugs: ['type-sk', 'type-skn', 'type-5na', 'type-ct'],
  },
  'toyota granvia': { make: 'Toyota', slugs: ['granvia'] },
  'hyundai imax': { make: 'Hyundai', slugs: ['imax'] },
  'hyundai staria': { make: 'Hyundai', slugs: ['staria', 'us4'] },
  'hyundai iload': { make: 'Hyundai', slugs: ['iload', 'i-load'] },
  'renault trafic': { make: 'Renault', slugs: ['trafic', 'x82'] },
  'renault master': { make: 'Renault', slugs: ['master', 'xdd'] },
  'ldv g10': { make: 'LDV', slugs: ['g10', 'epx1a'] },
  'ldv v80': { make: 'LDV', slugs: ['v80'] },
  'ldv deliver 9': {
    make: 'LDV',
    slugs: ['deliver-9', 'sv63d', 'ev65d', 'sk8c'],
  },

  // ---- carsales identity gap-fill (2026-06): current tow-relevant models the QLD-rego
  // spine lagged on — mostly recent Chinese 4WDs + Mazda's new large-SUV line. Confirmed
  // missing vs the catalogue; identity created on land, specs filled by grounding. ----
  'gwm tank 300': { make: 'GWM', slugs: ['tank-300'] },
  'gwm tank 500': { make: 'GWM', slugs: ['tank-500'] },
  'gwm cannon alpha': { make: 'GWM', slugs: ['cannon-alpha'] },
  'gwm haval h6': { make: 'GWM', slugs: ['haval-h6'] },
  'gwm haval h7': { make: 'GWM', slugs: ['haval-h7'] },
  'gwm haval jolion': { make: 'GWM', slugs: ['haval-jolion'] },
  'mazda cx-60': { make: 'Mazda', slugs: ['cx-60'] },
  'mazda cx-70': { make: 'Mazda', slugs: ['cx-70'] },
  'mazda cx-80': { make: 'Mazda', slugs: ['cx-80'] },
  'mazda cx-90': { make: 'Mazda', slugs: ['cx-90'] },
  'ford bronco': { make: 'Ford', slugs: ['bronco'] },
  'ford e-transit': { make: 'Ford', slugs: ['e-transit'] },
  'jeep avenger': { make: 'Jeep', slugs: ['avenger'] },
  'jeep renegade': { make: 'Jeep', slugs: ['renegade'] },
  'volkswagen tayron': { make: 'Volkswagen', slugs: ['tayron'] },
  'volkswagen id buzz': { make: 'Volkswagen', slugs: ['id-buzz'] },
  'nissan ariya': { make: 'Nissan', slugs: ['ariya'] },
};

/** The vehicle strings to dork (every VMAP key). */
export const VEHICLES = Object.keys(VMAP);
