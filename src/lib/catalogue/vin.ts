/**
 * VIN → build origin (country of manufacture).
 *
 * The first three VIN characters are the World Manufacturer Identifier (WMI,
 * ISO 3780). The WMI is assigned per manufacturing location, so it encodes the
 * COUNTRY the vehicle was actually built in — exactly the signal we need to tell
 * a Barcelona-built D40 Navara (VSK…) from a Sriracha-built one (MNT…) without
 * the owner having to know. Deterministic lookup, no AI.
 *
 * Used by the compliance-plate OCR to auto-select the right build variant
 * (CATALOGUE_GRANULARITY_PLAN.md §4 — build-source variants, Phase 1).
 */

// VIN charset excludes I, O, Q (to avoid confusion with 1/0). A VIN is exactly 17.
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/;

/** Pull a 17-char VIN out of free OCR text, or null. */
export function extractVin(text: string): string | null {
  const m = text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .match(VIN_RE);
  return m ? m[0] : null;
}

// Known manufacturer WMIs we care about (most reliable — overrides the ranges).
const KNOWN_WMI: Record<string, string> = {
  VSK: 'ES', // Nissan Motor Ibérica — Barcelona (Zona Franca)
  MNT: 'TH', // Siam Nissan Automobile — Sriracha, Thailand
  MMT: 'TH', // Mitsubishi Motors — Laem Chabang, Thailand
};

// Country-of-manufacture by WMI region (ISO 3779/3780). `from`/`to` compare the
// 2nd WMI char alphabetically; omit them to match any second char (whole region).
interface WmiRange {
  first: string;
  from?: string;
  to?: string;
  code: string;
}
const WMI_RANGES: WmiRange[] = [
  // Africa
  { first: 'A', from: 'A', to: 'H', code: 'ZA' }, // South Africa
  // Asia
  { first: 'J', code: 'JP' }, // Japan (all J)
  { first: 'K', from: 'L', to: 'R', code: 'KR' }, // South Korea
  { first: 'L', code: 'CN' }, // China (all L)
  { first: 'M', from: 'A', to: 'E', code: 'IN' }, // India
  { first: 'M', from: 'F', to: 'K', code: 'ID' }, // Indonesia
  { first: 'M', from: 'L', to: 'R', code: 'TH' }, // Thailand
  { first: 'P', from: 'L', to: 'R', code: 'MY' }, // Malaysia
  // Europe
  { first: 'S', from: 'A', to: 'M', code: 'GB' }, // United Kingdom
  { first: 'S', from: 'N', to: 'T', code: 'DE' }, // Germany
  { first: 'T', from: 'R', to: 'V', code: 'HU' }, // Hungary
  { first: 'V', from: 'A', to: 'E', code: 'AT' }, // Austria
  { first: 'V', from: 'F', to: 'R', code: 'FR' }, // France
  { first: 'V', from: 'S', to: 'W', code: 'ES' }, // Spain
  { first: 'W', code: 'DE' }, // Germany (all W)
  { first: 'Y', from: 'S', to: 'W', code: 'SE' }, // Sweden
  { first: 'Z', from: 'A', to: 'R', code: 'IT' }, // Italy
  // North America
  { first: '1', code: 'US' },
  { first: '4', code: 'US' },
  { first: '5', code: 'US' },
  { first: '2', code: 'CA' }, // Canada
  { first: '3', from: 'A', to: 'W', code: 'MX' }, // Mexico
  // Oceania
  { first: '6', from: 'A', to: 'W', code: 'AU' }, // Australia
  { first: '7', from: 'A', to: 'E', code: 'NZ' }, // New Zealand
  // South America
  { first: '8', from: 'A', to: 'E', code: 'AR' }, // Argentina
  { first: '9', from: 'A', to: 'J', code: 'BR' }, // Brazil
];

/** WMI prefix (≥2 chars) → ISO-3166 alpha-2 country code, or null if unknown. */
export function wmiToCountry(wmi: string): string | null {
  const w = wmi.toUpperCase();
  if (w.length >= 3 && KNOWN_WMI[w.slice(0, 3)])
    return KNOWN_WMI[w.slice(0, 3)];
  const first = w[0];
  const second = w[1] ?? '';
  for (const r of WMI_RANGES) {
    if (r.first !== first) continue;
    if (r.from == null || (second >= r.from && second <= (r.to ?? r.from)))
      return r.code;
  }
  return null;
}

/** Full VIN → build-origin country code (reads the WMI), or null. */
export function vinToBuildOrigin(
  vin: string | null | undefined,
): string | null {
  if (!vin || vin.length < 3) return null;
  return wmiToCountry(vin.slice(0, 3));
}
