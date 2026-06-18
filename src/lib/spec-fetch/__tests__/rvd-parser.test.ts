import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractPdfText } from '../rover/pdf';
import { parseRvdText, type RvdDocument } from '../rover/rvd-parser';
import {
  parseApprovalNoticeText,
  type ApprovalNotice,
} from '../rover/approval-notice-parser';

// Real ROVER samples committed under docs/RVD/. These tests parse the actual
// documents (not a synthetic fixture) so the parser is pinned to real layout.
const DIR = 'docs/RVD';

async function loadRvd(name: string): Promise<RvdDocument> {
  const buf = await readFile(join(DIR, name));
  const { text } = await extractPdfText(new Uint8Array(buf));
  return parseRvdText(text);
}
async function loadNotice(name: string): Promise<ApprovalNotice> {
  const buf = await readFile(join(DIR, name));
  const { text } = await extractPdfText(new Uint8Array(buf));
  return parseApprovalNoticeText(text);
}

describe('RVD parser — Navara D23 (25 variants)', () => {
  let doc: RvdDocument;
  beforeAll(async () => {
    doc = await loadRvd('Road Vehicle Descriptor - VTA-047155 20250409.pdf');
  }, 30_000);

  it('reads the header', () => {
    expect(doc.vtaNumber).toBe('VTA-047155');
    expect(doc.make).toBe('NISSAN');
    expect(doc.model).toBe('D23 Navara');
    expect(doc.categoryBroad).toBe('N - Goods Vehicles');
    expect(doc.generatedDate).toBe('2025-04-10');
    expect(doc.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('splits all 25 variants with per-variant figures', () => {
    expect(doc.variants).toHaveLength(25);
    const stx = doc.variants.find((v) => v.name === 'DC PU 2WD AT ST-X (#030)');
    expect(stx).toBeTruthy();
    expect(stx?.variantCode).toBe('030');
    expect(stx?.gvmKg).toBe(3070);
    expect(stx?.tareKg).toBe(1925);
    expect(stx?.towBrakedKg).toBe(3500);
    expect(stx?.wheelbaseMm).toBe(3150);
    // GCM is not published in the RVD → null, never 0 (null-not-guess).
    expect(stx?.gcmKg).toBeNull();
  });
});

describe('RVD parser — Trakka motorhome (axle in remarks, no category)', () => {
  let doc: RvdDocument;
  beforeAll(async () => {
    doc = await loadRvd('Road Vehicle Descriptor - VTA-038399 20241202.pdf');
  }, 30_000);

  it('captures the rare free-text axle limits from Remarks', () => {
    expect(doc.remarksFrontAxleKg).toBe(2100);
    expect(doc.remarksRearAxleKg).toBe(2400);
  });
  it('leaves an absent category null rather than grabbing the next section', () => {
    expect(doc.categoryBroad).toBeNull();
  });
  it('reads per-variant masses', () => {
    const lwb = doc.variants.find((v) => v.name === 'TORINO LWB');
    expect(lwb?.gvmKg).toBe(4250);
    expect(lwb?.tareKg).toBe(3041);
    expect(lwb?.gcmKg).toBeNull();
  });
});

describe('RVD parser — content hash (versioning key)', () => {
  it('is identical for byte-identical re-issues (idempotency)', async () => {
    const a = await loadRvd(
      'Road Vehicle Descriptor - VTA-049434 20260414.pdf',
    );
    const b = await loadRvd(
      'Road Vehicle Descriptor - VTA-049434 20260414-1.pdf',
    );
    expect(a.contentHash).toBe(b.contentHash);
  });
  it('differs for an amended approval (change detected)', async () => {
    const a = await loadRvd(
      'Road Vehicle Descriptor - VTA-044896 20230828.pdf',
    );
    const b = await loadRvd(
      'Road Vehicle Descriptor - VTA-044896 20251014.pdf',
    );
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe('Approval Notice parser — Navara VTA-047155', () => {
  let notice: ApprovalNotice;
  beforeAll(async () => {
    notice = await loadNotice('Approval Notice - VTA-047155.pdf');
  }, 30_000);

  it('reads the fine-grained category + authoritative dates the RVD lacks', () => {
    expect(notice.vtaNumber).toBe('VTA-047155');
    expect(notice.vehicleType).toBe('NISSAN D23 Navara');
    expect(notice.categoryFine).toBe('NA - Light Goods Vehicle');
    expect(notice.validFrom).toBe('2021-08-16');
    expect(notice.variationValidFrom).toBe('2025-07-01');
    expect(notice.expiresOn).toBe('2026-08-15');
    expect(notice.approvalHolder).toMatch(/NISSAN MOTOR/);
  });
  it('lists all 25 authoritative variants', () => {
    expect(notice.variants).toHaveLength(25);
    expect(notice.variants).toContain('DC PU 2WD AT ST-X (#030)');
  });
});
