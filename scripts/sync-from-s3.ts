#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { needsSync, listS3Objects, scanLocalSrefFiles, type S3FileInfo, type LocalFileInfo } from './utils/s3-sync-utils.js';

interface SyncConfig {
  bucketName: string;
  region: string;
  localDataDir: string;
  prefix: string;
}

// Remove interface - using S3FileInfo from shared utility

class S3ImageSync {
  private s3Client: S3Client;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.region });
  }

  async syncFromS3(): Promise<void> {
    console.log('🔄 Starting S3 to local sync...');
    
    try {
      // Ensure local directory exists
      await fs.mkdir(this.config.localDataDir, { recursive: true });
      
      // Get all S3 objects
      const s3Files = await listS3Objects(this.s3Client, this.config.bucketName, this.config.prefix);
      console.log(`📁 Found ${s3Files.length} files in S3`);
      
      // Get local file metadata
      const localFiles = await scanLocalSrefFiles(this.config.localDataDir);
      console.log(`📂 Found ${localFiles.size} local files`);
      
      // Determine which files need to be downloaded
      const filesToDownload = s3Files.filter(s3File => {
        const localFile = localFiles.get(s3File.key);
        if (!localFile) {
          return true; // File doesn't exist locally
        }
        
        // Use shared utility for comparison
        return needsSync(localFile, s3File);
      });
      
      console.log(`⬇️  Need to download ${filesToDownload.length} files`);
      
      // Download files
      for (const file of filesToDownload) {
        await this.downloadFile(file);
      }
      
      console.log('✅ Sync completed successfully');
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    }
  }



  private async downloadFile(file: S3FileInfo): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: file.key,
    });
    
    try {
      const response = await this.s3Client.send(command);
      
      if (response.Body) {
        // Convert S3 key to local file path
        // srefs/sref-123/images/photo.jpg -> src/data/srefs/sref-123/images/photo.jpg
        const relativePath = file.key.replace(/^srefs\//, '');
        const localPath = path.join(this.config.localDataDir, 'srefs', relativePath);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        
        // Write file
        const bodyBytes = await response.Body.transformToByteArray();
        await fs.writeFile(localPath, bodyBytes);
        
        console.log(`📥 Downloaded: ${file.key}`);
      }
    } catch (error) {
      console.error(`❌ Failed to download ${file.key}:`, error);
      throw error;
    }
  }
}

async function main() {
  // Load environment variables
  const bucketName = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  if (!bucketName) {
    console.log('⚠️  AWS_S3_BUCKET not configured, skipping S3 sync');
    process.exit(0); // Exit successfully to not break CI
  }
  
  const config: SyncConfig = {
    bucketName,
    region,
    localDataDir: path.join(process.cwd(), 'src', 'data'),
    prefix: 'srefs/', // Only sync files under the srefs/ prefix
  };
  
  const sync = new S3ImageSync(config);
  await sync.syncFromS3();
}

main().catch(console.error);