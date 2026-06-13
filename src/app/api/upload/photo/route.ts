import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadPhoto } from '@/lib/storage';

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 20 MB)' },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid multipart/form-data' },
      { status: 400 },
    );
  }

  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing photo field' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 20 MB)' },
      { status: 413 },
    );
  }

  // Primary type check against declared MIME type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error:
          'Invalid file type. Only JPEG, PNG, and HEIC images are accepted.',
      },
      { status: 422 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Re-validate file type by magic bytes
  const detectedType = detectImageType(buffer);
  if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
    return NextResponse.json(
      { error: 'File content does not match an accepted image type.' },
      { status: 422 },
    );
  }

  // Validate minimum dimensions for JPEG/PNG (skip for HEIC — no native decoder)
  if (detectedType === 'image/jpeg' || detectedType === 'image/png') {
    const dims = readImageDimensions(buffer, detectedType);
    if (dims && (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT)) {
      return NextResponse.json(
        {
          error: `Image too small. Minimum dimensions are ${MIN_WIDTH}×${MIN_HEIGHT}px.`,
        },
        { status: 422 },
      );
    }
  }

  try {
    const result = await uploadPhoto(buffer, detectedType, session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('R2 upload failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function detectImageType(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  // HEIC/HEIF: ftyp box at offset 4
  if (buf.length >= 12) {
    const ftyp = buf.slice(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
      const brand = buf.slice(8, 12).toString('ascii');
      if (['heic', 'heix', 'hevc', 'mif1'].includes(brand.toLowerCase()))
        return 'image/heic';
    }
  }
  return null;
}

function readImageDimensions(
  buf: Buffer,
  type: string,
): { width: number; height: number } | null {
  try {
    if (type === 'image/png') {
      // PNG IHDR: bytes 16–23 are width (4) and height (4)
      if (buf.length >= 24) {
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        return { width, height };
      }
    }
    if (type === 'image/jpeg') {
      // Walk JPEG markers to find SOFn
      let offset = 2;
      while (offset < buf.length - 1) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          // SOF0/SOF1/SOF2 — height at offset+5 (2 bytes), width at offset+7 (2 bytes)
          if (offset + 8 < buf.length) {
            const height = buf.readUInt16BE(offset + 5);
            const width = buf.readUInt16BE(offset + 7);
            return { width, height };
          }
        }
        if (offset + 3 >= buf.length) break;
        const segLen = buf.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch {
    // If parsing fails, skip dimension validation
  }
  return null;
}
