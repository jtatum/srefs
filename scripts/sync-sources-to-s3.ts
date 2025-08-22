#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { needsSync, listS3Objects, scanLocalSrefFiles, type S3FileInfo, type LocalFileInfo } from './utils/s3-sync-utils.js';

interface SyncConfig {
  bucketName: string;
  region: string;
  localDataDir: string;
  srefsPrefix: string;
}

interface LocalSourceFile {
  filePath: string;
  s3Key: string;
  contentType: string;
  size: number;
  etag: string;
}

class S3SourceUpload {
  private s3Client: S3Client;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.region });
  }

  async syncSourcesToS3(): Promise<void> {
    console.log('🔄 Starting source files sync to S3...');
    
    try {
      // Get all local source files
      const localFileMap = await scanLocalSrefFiles(this.config.localDataDir);
      const localFiles = Array.from(localFileMap.entries()).map(([s3Key, fileInfo]) => {
        const filePath = path.join(this.config.localDataDir, s3Key);
        return {
          filePath,
          s3Key,
          contentType: this.getContentType(filePath),
          size: fileInfo.size,
          etag: fileInfo.etag,
        };
      });
      
      console.log(`📂 Found ${localFiles.length} local source files`);

      if (localFiles.length === 0) {
        console.log('✅ No source files found to sync');
        return;
      }
      
      // Get existing S3 files
      const s3FilesList = await listS3Objects(this.s3Client, this.config.bucketName, this.config.srefsPrefix);
      const s3Files = new Map(s3FilesList.map(f => [f.key, f]));
      console.log(`☁️  Found ${s3Files.size} existing source files in S3`);
      
      // Determine which files need to be uploaded
      const filesToUpload = localFiles.filter(localFile => {
        const s3File = s3Files.get(localFile.s3Key);
        if (!s3File) return true; // File doesn't exist in S3
        
        // Use shared utility for comparison
        return needsSync(localFile, s3File);
      });
      
      console.log(`⬆️  Need to upload ${filesToUpload.length} source files`);
      console.log(`⏭️  Skipping ${localFiles.length - filesToUpload.length} unchanged files`);
      
      if (filesToUpload.length === 0) {
        console.log('✅ All source files are up to date in S3');
        return;
      }

      // Upload files
      let uploaded = 0;
      let failed = 0;
      
      for (const file of filesToUpload) {
        try {
          await this.uploadFile(file);
          uploaded++;
        } catch (error) {
          console.error(`❌ Failed to upload ${file.s3Key}:`, error);
          failed++;
        }
      }
      
      console.log('\n📊 Source Sync Summary:');
      console.log(`✅ Uploaded: ${uploaded} files`);
      if (failed > 0) {
        console.log(`❌ Failed: ${failed} files`);
      }
      console.log(`⏭️  Skipped: ${localFiles.length - filesToUpload.length} unchanged files`);
      console.log('✅ Source sync completed successfully');
      
    } catch (error) {
      console.error('❌ Source sync failed:', error);
      process.exit(1);
    }
  }

  private async uploadFile(file: LocalSourceFile): Promise<void> {
    try {
      const fileStream = createReadStream(file.filePath);
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: file.s3Key,
          Body: fileStream,
          ContentType: file.contentType,
          Metadata: {
            'original-path': file.filePath,
            'upload-time': new Date().toISOString(),
            'sync-type': 'source-image',
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

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.gif': 'image/gif',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
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
    console.log('⚠️  AWS_S3_BUCKET not configured, skipping source sync');
    process.exit(0); // Exit successfully to not break CI
  }
  
  const config: SyncConfig = {
    bucketName,
    region,
    localDataDir: path.join(process.cwd(), 'src', 'data'),
    srefsPrefix: 'srefs/', // Upload source files under srefs/ prefix
  };
  
  const upload = new S3SourceUpload(config);
  await upload.syncSourcesToS3();
}

main().catch(console.error);