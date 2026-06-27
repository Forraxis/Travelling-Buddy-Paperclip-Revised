import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { extractVin, vinToBuildOrigin } from '@/lib/catalogue/vin';

export interface CompliancePlateOcrResult {
  rawText: string;
  extracted: {
    gvmKg?: number;
    gcmKg?: number;
    make?: string;
    year?: number;
    // VIN + the build origin (country of manufacture) derived from its WMI prefix.
    // Lets the plate path auto-select the right build variant for models that
    // ship from >1 plant (e.g. D40 Navara ES vs TH).
    vin?: string;
    buildOrigin?: string;
  };
  confidence: number;
}

// Australian compliance plates typically show:
// GVM: XXXXKG or GVM XXXX
// GCM: XXXXKG or GCM XXXX
// MAKE: <manufacturer>
// Year is encoded in the build date field, not always present

function extractFields(text: string): CompliancePlateOcrResult['extracted'] {
  const clean = text.toUpperCase().replace(/[^A-Z0-9\s\n:./]/g, ' ');
  const extracted: CompliancePlateOcrResult['extracted'] = {};

  // GVM — "GVM XXXX" or "GVM: XXXX" or "GVMXXXXKG"
  const gvmMatch = clean.match(/GVM\s*:?\s*(\d{3,5})\s*(?:KG)?/);
  if (gvmMatch) {
    const val = parseInt(gvmMatch[1], 10);
    if (val >= 1000 && val <= 30000) extracted.gvmKg = val;
  }

  // GCM — "GCM XXXX" or "GCM: XXXX"
  const gcmMatch = clean.match(/GCM\s*:?\s*(\d{3,5})\s*(?:KG)?/);
  if (gcmMatch) {
    const val = parseInt(gcmMatch[1], 10);
    if (val >= 1000 && val <= 50000) extracted.gcmKg = val;
  }

  // Make — "MAKE:" line or "MFGR:" or "MFR:"
  const makeMatch = clean.match(
    /(?:MAKE|MFR|MFGR)\s*:?\s*([A-Z]+(?:\s[A-Z]+)?)/,
  );
  if (makeMatch) {
    extracted.make =
      makeMatch[1].charAt(0) + makeMatch[1].slice(1).toLowerCase();
  }

  // Build/compliance year — "DATE OF MANUF" or "BUILD DATE" YYYY or MM/YYYY
  const yearMatch = clean.match(
    /(?:DATE|BUILD|MANUF|MFD)\s*[^0-9]*(?:\d{1,2}\/)?(\d{4})/,
  );
  if (yearMatch) {
    const yr = parseInt(yearMatch[1], 10);
    if (yr >= 1980 && yr <= new Date().getFullYear() + 1) extracted.year = yr;
  }

  // VIN + build origin (country of manufacture from the WMI prefix). Read from the
  // ORIGINAL text — the cleanup above collapses the 17-char VIN with spaces.
  const vin = extractVin(text);
  if (vin) {
    extracted.vin = vin;
    const origin = vinToBuildOrigin(vin);
    if (origin) extracted.buildOrigin = origin;
  }

  return extracted;
}

export async function POST(request: Request) {
  let imageBuffer: Buffer;
  let mimeType = 'image/jpeg';

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('image');
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'image field required' },
        { status: 400 },
      );
    }
    mimeType = (file as File).type || 'image/jpeg';
    imageBuffer = Buffer.from(await (file as File).arrayBuffer());
  } else if (contentType.includes('application/json')) {
    // Accept base64-encoded image for flexibility
    const body = (await request.json()) as {
      base64?: string;
      mimeType?: string;
    };
    if (!body.base64) {
      return NextResponse.json(
        { error: 'base64 field required' },
        { status: 400 },
      );
    }
    imageBuffer = Buffer.from(body.base64, 'base64');
    mimeType = body.mimeType ?? 'image/jpeg';
  } else {
    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 415 },
    );
  }

  let worker;
  try {
    worker = await createWorker('eng', 1, {
      // Silence Tesseract logs in production
      logger: () => {},
    });

    // PSM 6 = uniform block of text — works reasonably for compliance plates
    await worker.setParameters({ tessedit_pageseg_mode: '6' as never });

    const { data } = await worker.recognize(imageBuffer);
    const rawText = data.text ?? '';
    const confidence = data.confidence ?? 0;
    const extracted = extractFields(rawText);

    return NextResponse.json({
      rawText,
      extracted,
      confidence,
    } satisfies CompliancePlateOcrResult);
  } catch (err) {
    console.error('[OCR] compliance-plate error:', err);
    return NextResponse.json(
      { error: 'OCR processing failed' },
      { status: 500 },
    );
  } finally {
    await worker?.terminate();
  }
}
