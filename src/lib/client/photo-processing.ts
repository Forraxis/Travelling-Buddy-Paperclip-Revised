"use client";

import imageCompression from "browser-image-compression";

const LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;
const MAX_SIZE_MB = 20;

export type ProcessedPhoto = {
  file: File;
  previewUrl: string;
};

export async function processPhoto(source: File): Promise<ProcessedPhoto> {
  const compressed = await imageCompression(source, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: LONG_EDGE_PX,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: JPEG_QUALITY,
    exifOrientation: -1, // strip EXIF orientation (effectively strips EXIF)
  });

  // browser-image-compression may return a Blob; wrap it as File
  const file =
    compressed instanceof File
      ? compressed
      : new File([compressed], source.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });

  const previewUrl = URL.createObjectURL(file);
  return { file, previewUrl };
}

export function revokePreview(previewUrl: string) {
  URL.revokeObjectURL(previewUrl);
}

export async function uploadPhoto(
  file: File
): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append("photo", file);

  const res = await fetch("/api/upload/photo", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }

  return res.json();
}
