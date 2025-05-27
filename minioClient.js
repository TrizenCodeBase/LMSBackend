import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// Log environment variables for debugging (remove in production)
console.log('MinIO Configuration:');
console.log(`MINIO_ENDPOINT: ${process.env.MINIO_ENDPOINT || 'localhost'}`);
console.log(`MINIO_PORT: ${process.env.MINIO_PORT || 9000}`);
console.log(`MINIO_USE_SSL: ${process.env.MINIO_USE_SSL === 'true'}`);
console.log(`MINIO_ACCESS_KEY: ${process.env.MINIO_ACCESS_KEY ? 'Set' : 'Missing'}`);
console.log(`MINIO_SECRET_KEY: ${process.env.MINIO_SECRET_KEY ? 'Set' : 'Missing'}`);

// Create MinIO client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

// Add a method to check if MinIO configuration is valid
minioClient.isConfigValid = () => {
  return process.env.MINIO_ENDPOINT && 
         process.env.MINIO_ACCESS_KEY && 
         process.env.MINIO_SECRET_KEY;
};

// Helper function to ensure bucket exists
const ensureBucketExists = async (bucketName) => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log(`Created bucket: ${bucketName}`);
    }
  } catch (error) {
    console.error(`Error ensuring bucket ${bucketName} exists:`, error);
    throw error;
  }
};

// Upload payment screenshot to MinIO
export const uploadPaymentScreenshot = async (file, filename) => {
  try {
    const bucket = 'payment-screenshots';
  const objectName = `${Date.now()}-${filename}`;
    
    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(bucket);
    }
    
    // Upload file
    await minioClient.putObject(bucket, objectName, file.buffer, {
      'Content-Type': file.mimetype
    });
    
    return `${bucket}/${objectName}`;
  } catch (error) {
    console.error('MinIO upload error:', error);
    throw new Error('Failed to upload file');
  }
};

// Get presigned URL for file access
export const getFileUrl = async (bucket, filename) => {
  try {
    const url = await minioClient.presignedGetObject(bucket, filename, 24 * 60 * 60); // 24 hour expiry
    return url;
  } catch (error) {
    console.error('MinIO get URL error:', error);
    throw new Error('Failed to generate file URL');
  }
};

export { minioClient, ensureBucketExists };
