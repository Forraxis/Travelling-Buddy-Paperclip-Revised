/**
 * Display label for an accessory. Seed/community names often already include
 * the brand (e.g. "ARB Summit Bullbar"), so blindly prefixing the brand again
 * yields "ARB ARB Summit Bullbar". Prefix the brand only when the name doesn't
 * already start with it (case-insensitive).
 */
export function accessoryDisplayName(
  brandName: string | null | undefined,
  name: string | null | undefined,
): string {
  const brand = (brandName ?? '').trim();
  const n = (name ?? '').trim();
  if (!brand) return n;
  if (!n) return brand;
  return n.toLowerCase().startsWith(brand.toLowerCase()) ? n : `${brand} ${n}`;
}
