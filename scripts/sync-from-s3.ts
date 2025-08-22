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
  publicDir: string;
  srefsPrefix: string;
  publicPrefix: string;
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
      // Ensure local directories exist
      await fs.mkdir(this.config.localDataDir, { recursive: true });
      await fs.mkdir(this.config.publicDir, { recursive: true });
      
      // Get all S3 objects (both srefs and public)
      const [s3SrefFiles, s3PublicFiles] = await Promise.all([
        listS3Objects(this.s3Client, this.config.bucketName, this.config.srefsPrefix),
        listS3Objects(this.s3Client, this.config.bucketName, this.config.publicPrefix),
      ]);
      const s3Files = [...s3SrefFiles, ...s3PublicFiles];
      console.log(`📁 Found ${s3Files.length} files in S3 (${s3SrefFiles.length} srefs, ${s3PublicFiles.length} public)`);
      
      // Get local file metadata (only srefs have local metadata tracking)
      const localSrefFiles = await scanLocalSrefFiles(this.config.localDataDir);
      console.log(`📂 Found ${localSrefFiles.size} local sref files`);
      
      // Determine which files need to be downloaded
      const filesToDownload: S3FileInfo[] = [];
      
      for (const s3File of s3Files) {
        let needsDownload = false;
        
        if (s3File.key.startsWith('public/')) {
          // For public files, check if file exists locally
          const localPath = path.join(this.config.publicDir, s3File.key.replace('public/', ''));
          try {
            const stats = await fs.stat(localPath);
            // Only download if file size differs
            needsDownload = stats.size !== s3File.size;
          } catch {
            needsDownload = true; // File doesn't exist locally
          }
        } else {
          // For sref files, use existing logic
          const localFile = localSrefFiles.get(s3File.key);
          if (!localFile) {
            needsDownload = true; // File doesn't exist locally
          } else {
            // Use shared utility for comparison
            needsDownload = needsSync(localFile, s3File);
          }
        }
        
        if (needsDownload) {
          filesToDownload.push(s3File);
        }
      }
      
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
        let localPath: string;
        
        if (file.key.startsWith('public/')) {
          // public/favicon.ico -> public/favicon.ico
          const filename = file.key.replace(/^public\//, '');
          localPath = path.join(this.config.publicDir, filename);
        } else {
          // srefs/sref-123/images/photo.jpg -> src/data/srefs/sref-123/images/photo.jpg
          const relativePath = file.key.replace(/^srefs\//, '');
          localPath = path.join(this.config.localDataDir, 'srefs', relativePath);
        }
        
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
    publicDir: path.join(process.cwd(), 'public'),
    srefsPrefix: 'srefs/', // Sync files under the srefs/ prefix
    publicPrefix: 'public/', // Sync files under the public/ prefix
  };
  
  const sync = new S3ImageSync(config);
  await sync.syncFromS3();
}

main().catch(console.error);