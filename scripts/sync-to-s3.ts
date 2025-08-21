#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import { needsSync, listS3Objects, type S3FileInfo, type LocalFileInfo } from './utils/s3-sync-utils.js';

interface SyncConfig {
  bucketName: string;
  region: string;
  distDir: string;
  cdnPrefix: string;
}

interface LocalFile {
  filePath: string;
  s3Key: string;
  contentType: string;
  size: number;
  etag: string;
}

class S3ImageUpload {
  private s3Client: S3Client;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.region });
  }

  async syncToS3(): Promise<void> {
    console.log('🔄 Starting local to S3 sync...');
    
    try {
      // Find all processed images in dist directory
      const localFiles = await this.findLocalImages();
      console.log(`📂 Found ${localFiles.length} processed images to upload`);
      
      // Get existing S3 files
      const s3FilesList = await listS3Objects(this.s3Client, this.config.bucketName, this.config.cdnPrefix);
      const s3Files = new Map(s3FilesList.map(f => [f.key, f]));
      console.log(`☁️  Found ${s3Files.size} existing files in S3`);
      
      // Determine which files need to be uploaded
      const filesToUpload = localFiles.filter(localFile => {
        const s3File = s3Files.get(localFile.s3Key);
        if (!s3File) return true; // File doesn't exist in S3
        
        // Use shared utility for comparison
        return needsSync(localFile, s3File);
      });
      
      console.log(`⬆️  Need to upload ${filesToUpload.length} files`);
      
      // Upload files
      for (const file of filesToUpload) {
        await this.uploadFile(file);
      }
      
      console.log('✅ Upload completed successfully');
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      process.exit(1);
    }
  }

  private async findLocalImages(): Promise<LocalFile[]> {
    const files: LocalFile[] = [];
    
    // Look for images in the dist/_astro directory (where Astro puts processed images)
    const astroDir = path.join(this.config.distDir, '_astro');
    
    try {
      await this.scanDirectory(astroDir, files, 'processed');
    } catch (error) {
      console.log('📁 No _astro directory found, skipping processed images');
    }
    
    // Also look for original images that might be copied to dist
    const dataDir = path.join(this.config.distDir, 'data', 'srefs');
    
    try {
      await this.scanDirectory(dataDir, files, 'original');
    } catch (error) {
      console.log('📁 No data/srefs directory found, skipping original images');
    }
    
    return files;
  }

  private async scanDirectory(dir: string, files: LocalFile[], type: 'processed' | 'original'): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, type);
        } else if (this.isImageFile(entry.name)) {
          const file = await this.createLocalFile(fullPath, type);
          if (file) {
            files.push(file);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }

  private async createLocalFile(filePath: string, type: 'processed' | 'original'): Promise<LocalFile | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath);
      const etag = crypto.createHash('md5').update(content).digest('hex');
      
      // Determine S3 key based on file type and location
      let s3Key: string;
      
      if (type === 'processed') {
        // Processed images go under cdn/processed/
        const relativePath = path.relative(this.config.distDir, filePath);
        s3Key = `cdn/processed/${relativePath}`;
      } else {
        // Original images maintain their structure under cdn/
        const dataIndex = filePath.indexOf('/data/srefs/');
        if (dataIndex === -1) return null;
        
        const relativePath = filePath.substring(dataIndex + '/data/'.length);
        s3Key = `cdn/${relativePath}`;
      }
      
      return {
        filePath,
        s3Key,
        contentType: this.getContentType(filePath),
        size: stats.size,
        etag,
      };
    } catch (error) {
      console.warn(`⚠️  Could not process file ${filePath}:`, error);
      return null;
    }
  }


  private async uploadFile(file: LocalFile): Promise<void> {
    try {
      const fileStream = createReadStream(file.filePath);
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: file.s3Key,
          Body: fileStream,
          ContentType: file.contentType,
          CacheControl: 'public, max-age=31536000', // 1 year cache for images
          Metadata: {
            'original-path': file.filePath,
            'upload-time': new Date().toISOString(),
          },
        },
      });
      
      await upload.done();
      console.log(`📤 Uploaded: ${file.s3Key} (${this.formatBytes(file.size)})`);
      
    } catch (error) {
      console.error(`❌ Failed to upload ${file.s3Key}:`, error);
      throw error;
    }
  }

  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.gif': 'image/gif',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

async function main() {
  // Load environment variables
  const bucketName = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  if (!bucketName) {
    console.log('⚠️  AWS_S3_BUCKET not configured, skipping S3 upload');
    process.exit(0); // Exit successfully to not break CI
  }
  
  const config: SyncConfig = {
    bucketName,
    region,
    distDir: path.join(process.cwd(), 'dist'),
    cdnPrefix: 'cdn/', // Upload processed images under cdn/ prefix
  };
  
  const upload = new S3ImageUpload(config);
  await upload.syncToS3();
}

main().catch(console.error);