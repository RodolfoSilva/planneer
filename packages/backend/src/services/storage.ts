import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || 'planneer';

export async function uploadFile(
  key: string,
  body: ArrayBuffer | Buffer | string,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body instanceof ArrayBuffer ? Buffer.from(body) : body,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  
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

export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
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



