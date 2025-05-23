import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// Log environment variables for debugging (remove in production)
console.log('MinIO Configuration:');
console.log(`MINIO_ENDPOINT: ${process.env.MINIO_ENDPOINT || 'localhost'}`);
console.log(`MINIO_PORT: ${process.env.MINIO_PORT || 9000}`);
console.log(`MINIO_USE_SSL: ${process.env.MINIO_USE_SSL === 'true'}`);
console.log(`MINIO_ACCESS_KEY: ${process.env.MINIO_ACCESS_KEY ? 'Set' : 'Missing'}`);
console.log(`MINIO_SECRET_KEY: ${process.env.MINIO_SECRET_KEY ? 'Set' : 'Missing'}`);

const minioClient = new Minio.Client({
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

// Helper function to upload payment screenshots
const uploadPaymentScreenshot = async (file, filename) => {
  const bucketName = 'payment-screenshots';
  await ensureBucketExists(bucketName);
  
  const objectName = `${Date.now()}-${filename}`;
  const metaData = {
    'Content-Type': file.mimetype,
  };

  await minioClient.putObject(bucketName, objectName, file.buffer, metaData);
  return `${bucketName}/${objectName}`;
};

// Helper function to get file URL
const getFileUrl = async (bucketName, objectName) => {
  try {
    return await minioClient.presignedGetObject(bucketName, objectName, 24 * 60 * 60); // 24 hours expiry
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

export {
  minioClient,
  uploadPaymentScreenshot,
  getFileUrl,
  ensureBucketExists
};
