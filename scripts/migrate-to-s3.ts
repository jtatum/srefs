#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { scanLocalSrefFiles, s3KeyToLocalPath, needsSync, type LocalFileInfo, type S3FileInfo } from './utils/s3-sync-utils.js';

interface MigrationConfig {
  bucketName: string;
  region: string;
  localDataDir: string;
  dryRun: boolean;
}

interface LocalImage {
  filePath: string;
  s3Key: string;
  contentType: string;
  size: number;
  etag: string;
}

class S3Migration {
  private s3Client: S3Client;
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.region });
  }

  async migrateAllImages(): Promise<void> {
    console.log('🚀 Starting migration of existing images to S3...');
    if (this.config.dryRun) {
      console.log('🔍 DRY RUN MODE - No files will be uploaded\n');
    }
    
    try {
      // Find all local images using shared utility
      const localFiles = await scanLocalSrefFiles(this.config.localDataDir);
      const localImages = Array.from(localFiles.entries()).map(([s3Key, fileInfo]) => ({
        s3Key,
        ...fileInfo,
        filePath: s3KeyToLocalPath(s3Key, this.config.localDataDir),
        contentType: this.getContentType(s3KeyToLocalPath(s3Key, this.config.localDataDir))
      }));
      console.log(`📂 Found ${localImages.length} images to migrate`);
      
      if (localImages.length === 0) {
        console.log('✅ No images found to migrate');
        return;
      }

      // Check which images already exist in S3
      console.log('🔍 Checking existing S3 files...');
      const imagesToUpload = await this.filterExistingImages(localImages);
      
      console.log(`⬆️  Need to upload ${imagesToUpload.length} images`);
      console.log(`⏭️  Skipping ${localImages.length - imagesToUpload.length} existing images\n`);
      
      if (imagesToUpload.length === 0) {
        console.log('✅ All images already exist in S3');
        return;
      }

      // Upload images
      let uploaded = 0;
      let failed = 0;
      
      for (const image of imagesToUpload) {
        try {
          if (!this.config.dryRun) {
            await this.uploadImage(image);
          } else {
            console.log(`[DRY RUN] Would upload: ${image.s3Key}`);
          }
          uploaded++;
        } catch (error) {
          console.error(`❌ Failed to upload ${image.s3Key}:`, error);
          failed++;
        }
      }
      
      console.log('\n📊 Migration Summary:');
      console.log(`✅ Uploaded: ${uploaded} files`);
      if (failed > 0) {
        console.log(`❌ Failed: ${failed} files`);
      }
      console.log(`⏭️  Skipped: ${localImages.length - imagesToUpload.length} existing files`);
      
      if (!this.config.dryRun) {
        console.log('\n🎉 Migration completed!');
        console.log('\n📋 Next steps:');
        console.log('1. Run: npm run sync:from-s3  # Test downloading from S3');
        console.log('2. Run: npm run build:local   # Test Astro build with local images');
        console.log('3. Run: npm run sync:to-s3    # Upload processed images');
        console.log('4. Update your image URLs to use CloudFront CDN');
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }



  private async filterExistingImages(localImages: LocalImage[]): Promise<LocalImage[]> {
    const imagesToUpload: LocalImage[] = [];
    
    for (const image of localImages) {
      try {
        // Check if object exists in S3
        const headCommand = new HeadObjectCommand({
          Bucket: this.config.bucketName,
          Key: image.s3Key,
        });
        
        const response = await this.s3Client.send(headCommand);
        
        // Use shared utility for comparison
        const s3File: S3FileInfo = {
          key: image.s3Key,
          etag: response.ETag || '',
          size: response.ContentLength || 0
        };
        
        if (needsSync(image, s3File)) {
          // File exists but different, upload
          console.log(`🔄 File changed: ${image.s3Key}`);
          imagesToUpload.push(image);
        }
        // If needsSync returns false, file exists and matches, skip
      } catch (error: any) {
        if (error.name === 'NotFound') {
          // File doesn't exist, needs upload
          imagesToUpload.push(image);
        } else {
          // Other error, skip for safety
          console.warn(`⚠️  Could not check ${image.s3Key}:`, error.message);
        }
      }
    }
    
    return imagesToUpload;
  }

  private async uploadImage(image: LocalImage): Promise<void> {
    try {
      const fileStream = createReadStream(image.filePath);
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: image.s3Key,
          Body: fileStream,
          ContentType: image.contentType,
          Metadata: {
            'original-filename': path.basename(image.filePath),
            'migration-date': new Date().toISOString(),
          },
        },
      });
      
      await upload.done();
      console.log(`📤 Uploaded: ${image.s3Key} (${this.formatBytes(image.size)})`);
      
    } catch (error) {
      console.error(`❌ Failed to upload ${image.s3Key}:`, error);
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
  // Parse command line arguments
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  // Load environment variables
  const bucketName = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-west-2';
  
  if (!bucketName) {
    console.error('❌ AWS_S3_BUCKET environment variable is required');
    process.exit(1);
  }
  
  const config: MigrationConfig = {
    bucketName,
    region,
    localDataDir: path.join(process.cwd(), 'public', 'data'),
    dryRun: isDryRun,
  };
  
  console.log(`🏠 Local directory: ${config.localDataDir}`);
  console.log(`🪣 S3 bucket: ${bucketName}`);
  console.log(`📍 Region: ${region}\n`);
  
  const migration = new S3Migration(config);
  await migration.migrateAllImages();
}

main().catch(console.error);