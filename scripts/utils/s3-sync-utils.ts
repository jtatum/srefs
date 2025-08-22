#!/usr/bin/env tsx

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface S3FileInfo {
  key: string;
  etag: string;
  size: number;
  lastModified?: Date;
}

export interface LocalFileInfo {
  etag: string;
  size: number;
}

/**
 * Compare local and S3 files to determine if they need syncing
 * Handles both single-part and multipart uploads correctly
 */
export function needsSync(localFile: LocalFileInfo, s3File: S3FileInfo): boolean {
  // Clean up S3 ETag (remove quotes and normalize case)
  const s3ETag = s3File.etag.replace(/"/g, '').toLowerCase();
  const isMultipart = s3ETag.includes('-');
  
  if (isMultipart) {
    // For multipart uploads, compare file size since ETag algorithm differs
    return localFile.size !== s3File.size;
  } else {
    // For single part uploads, compare ETag (MD5 hash)
    return localFile.etag !== s3ETag;
  }
}

/**
 * Get a normalized ETag for comparison (lowercase, no quotes)
 */
export function normalizeETag(etag: string): string {
  return etag.replace(/"/g, '').toLowerCase();
}

/**
 * List all S3 objects with the given prefix
 */
export async function listS3Objects(
  s3Client: S3Client, 
  bucketName: string, 
  prefix: string
): Promise<S3FileInfo[]> {
  const files: S3FileInfo[] = [];
  let continuationToken: string | undefined;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.ETag && object.Size) {
          files.push({
            key: object.Key,
            etag: object.ETag,
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return files;
}

/**
 * Scan local sref directory structure and build file metadata map
 */
export async function scanLocalSrefFiles(localDataDir: string): Promise<Map<string, LocalFileInfo>> {
  const localFiles = new Map<string, LocalFileInfo>();
  
  try {
    const srefsDir = path.join(localDataDir, 'srefs');
    const srefDirs = await fs.readdir(srefsDir);
    
    for (const srefDir of srefDirs) {
      const srefPath = path.join(srefsDir, srefDir);
      const stats = await fs.stat(srefPath);
      
      if (stats.isDirectory()) {
        const imagesDir = path.join(srefPath, 'images');
        try {
          const imageFiles = await fs.readdir(imagesDir);
          
          for (const imageFile of imageFiles) {
            const filePath = path.join(imagesDir, imageFile);
            const fileStats = await fs.stat(filePath);
            
            // Calculate MD5 hash for ETag comparison
            const content = await fs.readFile(filePath);
            const hash = crypto.createHash('md5').update(content).digest('hex');
            
            // S3 key format: srefs/sref-{id}/images/{filename}
            const s3Key = `srefs/${srefDir}/images/${imageFile}`;
            
            localFiles.set(s3Key, {
              etag: hash,
              size: fileStats.size,
            });
          }
        } catch (error) {
          // Skip directories without images folder
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan local sref files:', error);
  }
  
  return localFiles;
}

/**
 * Convert S3 key to local file path
 */
export function s3KeyToLocalPath(s3Key: string, localDataDir: string): string {
  // Convert "srefs/sref-123/images/file.png" to "src/data/srefs/sref-123/images/file.png"
  return path.join(localDataDir, s3Key);
}

/**
 * Convert local file path to S3 key
 */
export function localPathToS3Key(filePath: string, localDataDir: string): string {
  // Convert "src/data/srefs/sref-123/images/file.png" to "srefs/sref-123/images/file.png"
  return path.relative(localDataDir, filePath).replace(/\\/g, '/');
}

/**
 * Scan local public directory for image files and build file metadata map
 */
export async function scanLocalPublicFiles(publicDir: string): Promise<Map<string, LocalFileInfo>> {
  const localFiles = new Map<string, LocalFileInfo>();
  
  try {
    const files = await fs.readdir(publicDir);
    
    for (const file of files) {
      const filePath = path.join(publicDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && isImageFile(file)) {
        // Calculate MD5 hash for ETag comparison
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash('md5').update(content).digest('hex');
        
        // S3 key format: public/{filename}
        const s3Key = `public/${file}`;
        
        localFiles.set(s3Key, {
          etag: hash,
          size: stats.size,
        });
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan local public files:', error);
  }
  
  return localFiles;
}

/**
 * Check if a file is an image based on its extension
 */
function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.ico', '.svg'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}