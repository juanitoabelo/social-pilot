import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "fake-key",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "fake-secret",
      },
    });
  }
  return _s3;
}

const BUCKET = process.env.S3_BUCKET ?? "socialpilot-assets";
const CDN_URL = process.env.CLOUDFRONT_URL ?? "";

export async function uploadToS3(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ s3Key: string; url: string }> {
  const s3 = getS3();

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
    CacheControl: "public, max-age=31536000",
  });

  await s3.send(command);

  const url = CDN_URL
    ? `${CDN_URL}/${params.key}`
    : `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com/${params.key}`;

  return { s3Key: params.key, url };
}
