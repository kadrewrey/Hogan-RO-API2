// lib/aws.ts
// AWS S3 utilities for file uploads and downloads

import AWS from 'aws-sdk';

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
  console.warn('AWS credentials not configured. File upload/download features will be disabled.');
}

// Initialize S3 client
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
});

// File size and type restrictions
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Generate a unique file key
export function generateFileKey(folder: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = filename.split('.').pop();
  return `${folder}/${timestamp}-${random}.${extension}`;
}

// Generate pre-signed URL for file upload
export async function generateUploadUrl(
  filename: string,
  contentType: string,
  folder: string = 'attachments'
): Promise<{ uploadUrl: string; key: string }> {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS S3 not configured');
  }

  if (!ALLOWED_ATTACHMENT_TYPES.includes(contentType)) {
    throw new Error(`File type ${contentType} not allowed`);
  }

  const key = generateFileKey(folder, filename);
  
  const params = {
    Bucket: AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: 300, // 5 minutes
    Conditions: [
      ['content-length-range', 0, MAX_ATTACHMENT_SIZE],
      ['eq', '$Content-Type', contentType],
    ],
  };

  try {
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    return { uploadUrl, key };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

// Generate pre-signed URL for file download
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS S3 not configured');
  }

  const params = {
    Bucket: AWS_S3_BUCKET,
    Key: key,
    Expires: expiresIn,
  };

  try {
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating download URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

// Delete a file from S3
export async function deleteFile(key: string): Promise<void> {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS S3 not configured');
  }

  const params = {
    Bucket: AWS_S3_BUCKET,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

// Check if file exists
export async function fileExists(key: string): Promise<boolean> {
  if (!AWS_S3_BUCKET) {
    return false;
  }

  const params = {
    Bucket: AWS_S3_BUCKET,
    Key: key,
  };

  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if ((error as AWS.AWSError).code === 'NotFound') {
      return false;
    }
    console.error('Error checking file existence:', error);
    throw new Error('Failed to check file existence');
  }
}

// Get file metadata
export async function getFileMetadata(key: string) {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS S3 not configured');
  }

  const params = {
    Bucket: AWS_S3_BUCKET,
    Key: key,
  };

  try {
    const result = await s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw new Error('Failed to get file metadata');
  }
}

// Validate file upload request
export function validateFileUpload(filename: string, contentType: string, size?: number) {
  const errors: string[] = [];

  if (!filename || filename.trim().length === 0) {
    errors.push('Filename is required');
  }

  if (!contentType) {
    errors.push('Content type is required');
  } else if (!ALLOWED_ATTACHMENT_TYPES.includes(contentType)) {
    errors.push(`File type ${contentType} is not allowed`);
  }

  if (size && size > MAX_ATTACHMENT_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB`);
  }

  // Check for potentially dangerous filenames
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename contains invalid characters');
  }

  return errors;
}

// Generate file URL for public access (if bucket is configured for public read)
export function getPublicFileUrl(key: string): string {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS S3 not configured');
  }

  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

// Utility to extract file extension
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

// Utility to get MIME type from file extension
export function getMimeTypeFromFilename(filename: string): string {
  const extension = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    txt: 'text/plain',
    csv: 'text/csv',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}