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
  'ford transit': { make: 'Ford', slugs: ['transit'] },
  'mercedes-benz sprinter': {
    make: 'Mercedes-Benz',
    slugs: ['sprinter', '907-sprinter-hd'],
  },
};

/** The vehicle strings to dork (every VMAP key). */
export const VEHICLES = Object.keys(VMAP);
