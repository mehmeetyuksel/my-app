import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const imageUpload = async (name: string, data: Uint8Array, type: string) => {
    const s3Command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: name,
        Body: data,
        ContentType: type
      });

      try {
        const s3Client = new S3Client({});
        //@ts-ignore
        await s3Client.send(s3Command);
        return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${name}`
      } catch (err) {
        return 'ERROR'
      }
}