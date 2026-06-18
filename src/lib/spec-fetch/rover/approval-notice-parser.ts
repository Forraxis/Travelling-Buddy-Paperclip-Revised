/**
 * Approval Notice parser — the department-issued legal certificate that complements
 * the RVD. It carries no mass figures, but it IS the authority for the things the
 * RVD lacks: the fine-grained category ("NA - Light Goods Vehicle" vs the RVD's
 * broad "N - Goods Vehicles"), the approval/variation/expiry dates, the approval
 * holder, and the authoritative variant list. Pure (text in → structured out).
 */
import { createHash } from 'node:crypto';

export interface ApprovalNotice {
  vtaNumber: string | null;
  /** Make + model + marketing as one line, e.g. "NISSAN D23 Navara". */
  vehicleType: string | null;
  /** Fine-grained category, e.g. "NA - Light Goods Vehicle". */
  categoryFine: string | null;
  approvalHolder: string | null;
  /** ISO yyyy-mm-dd. */
  validFrom: string | null;
  variationValidFrom: string | null;
  expiresOn: string | null;
  /** Authoritative variant identifiers, e.g. "DC PU 2WD AT ST-X (#030)". */
  variants: string[];
  contentHash: string;
  rawText: string;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m && m[1] !== undefined ? m[1].trim() : null;
}

function toIso(ddmmyyyy: string | null): string | null {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function parseApprovalNoticeText(rawText: string): ApprovalNotice {
  const contentHash = createHash('sha256').update(rawText).digest('hex');
  const text = rawText.replace(/\s+/g, ' ');

  const vtaNumber = firstMatch(text, /Approval number\s+(VTA-\d+)/);
  const categoryFine = firstMatch(
    text,
    /([MNLO][A-Z]\d?\s*-\s*[A-Za-z /]+?)\s+Approval holder/,
  );
  const approvalHolder = firstMatch(
    text,
    /Approval holder\s+(.+?)\s+Approval number/,
  );
  const validFrom = toIso(
    firstMatch(text, /This approval is valid from\s+(\d{2}\/\d{2}\/\d{4})/),
  );
  const variationValidFrom = toIso(
    firstMatch(text, /Variation valid from\s+(\d{2}\/\d{2}\/\d{4})/),
  );
  // Note the source sometimes omits the space: "expires on15/08/2026".
  const expiresOn = toIso(
    firstMatch(text, /The approval expires on\s*(\d{2}\/\d{2}\/\d{4})/),
  );

  // "<vehicle type> Variants: <v1>, <v2>, … <CATEGORY> Approval holder"
  const vehicleType = firstMatch(
    text,
    /granted road vehicle type approval under section 19 of the Road Vehicle Standards Rules 2019\.\s*(.+?)\s+Variants:/,
  );
  const variantsBlock = firstMatch(
    text,
    /Variants:\s*(.+?)\s+[MNLO][A-Z]\d?\s*-\s*[A-Za-z /]+?\s+Approval holder/,
  );
  const variants = variantsBlock
    ? variantsBlock
        .split(/,\s*/)
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  return {
    vtaNumber,
    vehicleType,
    categoryFine,
    approvalHolder,
    validFrom,
    variationValidFrom,
    expiresOn,
    variants,
    contentHash,
    rawText,
  };
}
