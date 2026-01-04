import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || "planneer";

export async function uploadFile(
  key: string,
  body: ArrayBuffer | Buffer | string,
  contentType?: string
): Promise<string> {
  console.log("[Storage] Uploading file:", {
    key,
    bucket: BUCKET,
    contentType,
    bodyType: typeof body,
  });

  const bodyBuffer =
    body instanceof ArrayBuffer
      ? Buffer.from(body)
      : typeof body === "string"
      ? Buffer.from(body, "utf-8")
      : body;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bodyBuffer,
    ContentType: contentType || "application/octet-stream",
  });

  try {
    await s3Client.send(command);
    console.log("[Storage] File uploaded successfully:", key);
  } catch (error) {
    console.error("[Storage] Upload failed:", error);
    if (error instanceof Error) {
      console.error("[Storage] Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
    throw new Error(
      `Failed to upload file to S3: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const body = await response.Body?.transformToByteArray();

  if (!body) {
    throw new Error(`File not found: ${key}`);
  }

  return Buffer.from(body);
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getS3SignedUrl(s3Client, command, { expiresIn });
}

export async function getSignedDownloadUrl(
  key: string,
  filename: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getS3SignedUrl(s3Client, command, { expiresIn });
}

export async function getUploadSignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getS3SignedUrl(s3Client, command, { expiresIn });
}
