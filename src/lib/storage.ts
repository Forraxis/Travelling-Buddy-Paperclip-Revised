import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

function getR2Client(): S3Client {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export type UploadResult = {
  url: string;
  key: string;
};

export async function uploadPhoto(
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<UploadResult> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  if (!bucket || !publicUrl) {
    throw new Error("R2 bucket or public URL not configured");
  }

  const ext = mimeType === "image/png" ? "png" : "jpg";
  const key = `photos/${userId}/${randomUUID()}.${ext}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const url = `${publicUrl.replace(/\/$/, "")}/${key}`;
  return { url, key };
}
