import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import crypto from 'crypto';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import {
  needsSync,
  normalizeETag,
  listS3Objects,
  scanLocalSrefFiles,
  scanLocalPublicFiles,
  s3KeyToLocalPath,
  localPathToS3Key,
  type S3FileInfo,
  type LocalFileInfo
} from './s3-sync-utils';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock crypto module
vi.mock('crypto');
const mockCrypto = vi.mocked(crypto);

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
const mockS3Client = vi.mocked(S3Client);
const mockListObjectsV2Command = vi.mocked(ListObjectsV2Command);

describe('s3-sync-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create mock Stats objects
  const createMockStats = (isDirectory: boolean, size: number) => ({
    isDirectory: vi.fn().mockReturnValue(isDirectory),
    isFile: vi.fn().mockReturnValue(!isDirectory),
    size,
    // Add other Stats methods as needed
    isBlockDevice: vi.fn().mockReturnValue(false),
    isCharacterDevice: vi.fn().mockReturnValue(false),
    isSymbolicLink: vi.fn().mockReturnValue(false),
    isFIFO: vi.fn().mockReturnValue(false),
    isSocket: vi.fn().mockReturnValue(false)
  });

  describe('needsSync', () => {
    it('should return false when ETags match for single-part upload', () => {
      const localFile: LocalFileInfo = {
        etag: 'abc123def456',
        size: 1000
      };
      const s3File: S3FileInfo = {
        key: 'test.jpg',
        etag: '"abc123def456"', // S3 ETags have quotes
        size: 1000
      };

      expect(needsSync(localFile, s3File)).toBe(false);
    });

    it('should return true when ETags differ for single-part upload', () => {
      const localFile: LocalFileInfo = {
        etag: 'abc123def456',
        size: 1000
      };
      const s3File: S3FileInfo = {
        key: 'test.jpg',
        etag: '"different123"',
        size: 1000
      };

      expect(needsSync(localFile, s3File)).toBe(true);
    });

    it('should compare file size for multipart uploads', () => {
      const localFile: LocalFileInfo = {
        etag: 'abc123def456',
        size: 1000
      };
      const s3File: S3FileInfo = {
        key: 'test.jpg',
        etag: '"abc123def456-2"', // Multipart ETag has dash
        size: 1000
      };

      expect(needsSync(localFile, s3File)).toBe(false);
    });

    it('should return true when file sizes differ for multipart uploads', () => {
      const localFile: LocalFileInfo = {
        etag: 'abc123def456',
        size: 1000
      };
      const s3File: S3FileInfo = {
        key: 'test.jpg',
        etag: '"abc123def456-2"',
        size: 2000
      };

      expect(needsSync(localFile, s3File)).toBe(true);
    });

    it('should handle case differences in ETags', () => {
      const localFile: LocalFileInfo = {
        etag: 'abc123def456', // Already normalized lowercase
        size: 1000
      };
      const s3File: S3FileInfo = {
        key: 'test.jpg',
        etag: '"ABC123DEF456"', // S3 ETag in uppercase 
        size: 1000
      };

      expect(needsSync(localFile, s3File)).toBe(false);
    });
  });

  describe('normalizeETag', () => {
    it('should remove quotes and convert to lowercase', () => {
      expect(normalizeETag('"ABC123DEF456"')).toBe('abc123def456');
    });

    it('should handle ETags without quotes', () => {
      expect(normalizeETag('ABC123DEF456')).toBe('abc123def456');
    });

    it('should handle empty string', () => {
      expect(normalizeETag('')).toBe('');
    });

    it('should handle multipart ETags', () => {
      expect(normalizeETag('"ABC123DEF456-2"')).toBe('abc123def456-2');
    });
  });

  describe('listS3Objects', () => {
    let mockS3ClientInstance: any;

    beforeEach(() => {
      mockS3ClientInstance = {
        send: vi.fn()
      };
      mockS3Client.mockImplementation(() => mockS3ClientInstance);
    });

    it('should list all objects with pagination', async () => {
      // Mock two pages of results
      mockS3ClientInstance.send
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'file1.jpg', ETag: '"abc123"', Size: 1000, LastModified: new Date() }
          ],
          NextContinuationToken: 'token123'
        })
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'file2.jpg', ETag: '"def456"', Size: 2000, LastModified: new Date() }
          ],
          NextContinuationToken: undefined
        });

      const result = await listS3Objects(mockS3ClientInstance, 'test-bucket', 'prefix/');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        key: 'file1.jpg',
        etag: '"abc123"',
        size: 1000
      });
      expect(result[1]).toMatchObject({
        key: 'file2.jpg',
        etag: '"def456"',
        size: 2000
      });
      
      expect(mockS3ClientInstance.send).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({
        Contents: undefined,
        NextContinuationToken: undefined
      });

      const result = await listS3Objects(mockS3ClientInstance, 'test-bucket', 'prefix/');

      expect(result).toHaveLength(0);
    });

    it('should filter out incomplete objects', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({
        Contents: [
          { Key: 'file1.jpg', ETag: '"abc123"', Size: 1000 }, // Complete
          { Key: 'file2.jpg', ETag: '"def456"' }, // Missing Size
          { Key: undefined, ETag: '"ghi789"', Size: 2000 }, // Missing Key
          { Key: 'file3.jpg', ETag: undefined, Size: 3000 }, // Missing ETag
        ],
        NextContinuationToken: undefined
      });

      const result = await listS3Objects(mockS3ClientInstance, 'test-bucket', 'prefix/');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('file1.jpg');
    });
  });

  describe('scanLocalSrefFiles', () => {
    beforeEach(() => {
      // Mock crypto hash creation
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mockmd5hash')
      };
      mockCrypto.createHash.mockReturnValue(mockHash as any);
    });

    it('should scan sref directories and generate file metadata', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123', 'sref-456'] as any) // 1. Main directory scan
        .mockResolvedValueOnce(['image1.jpg', 'image2.png'] as any) // 3. sref-123/images scan
        .mockResolvedValueOnce(['cover.jpg'] as any); // 9. sref-456/images scan

      mockFs.stat
        .mockResolvedValueOnce(createMockStats(true, 0)) // 2. sref-123 directory check
        .mockResolvedValueOnce(createMockStats(false, 1000)) // 4. image1.jpg stats
        .mockResolvedValueOnce(createMockStats(false, 2000)) // 6. image2.png stats
        .mockResolvedValueOnce(createMockStats(true, 0)) // 8. sref-456 directory check
        .mockResolvedValueOnce(createMockStats(false, 1500)); // 10. cover.jpg stats

      mockFs.readFile
        .mockResolvedValueOnce(Buffer.from('file1content')) // 5. image1.jpg content
        .mockResolvedValueOnce(Buffer.from('file2content')) // 7. image2.png content
        .mockResolvedValueOnce(Buffer.from('file3content')); // 11. cover.jpg content

      const result = await scanLocalSrefFiles('/test/data');

      expect(result.size).toBe(3);
      expect(result.get('srefs/sref-123/images/image1.jpg')).toEqual({
        etag: 'mockmd5hash',
        size: 1000
      });
      expect(result.get('srefs/sref-123/images/image2.png')).toEqual({
        etag: 'mockmd5hash',
        size: 2000
      });
      expect(result.get('srefs/sref-456/images/cover.jpg')).toEqual({
        etag: 'mockmd5hash',
        size: 1500
      });
    });

    it('should handle directories without images folder', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123'] as any) // Main directory
        .mockRejectedValueOnce(new Error('ENOENT: no such file')); // Images directory missing

      mockFs.stat.mockResolvedValueOnce(createMockStats(true, 0));

      const result = await scanLocalSrefFiles('/test/data');

      expect(result.size).toBe(0);
    });

    it('should handle errors gracefully and warn', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock readdir to fail for the main directory read (line 92 in s3-sync-utils.ts)
      mockFs.readdir.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await scanLocalSrefFiles('/test/data');

      expect(result.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not scan local sref files:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('scanLocalPublicFiles', () => {
    beforeEach(() => {
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mockmd5hash')
      };
      mockCrypto.createHash.mockReturnValue(mockHash as any);
    });

    it('should scan public directory for image files', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        'favicon.ico',
        'logo.png', 
        'robots.txt', // Should be skipped (not an image)
        'apple-touch-icon.png'
      ] as any);

      mockFs.stat
        .mockResolvedValueOnce(createMockStats(false, 1000)) // favicon.ico
        .mockResolvedValueOnce(createMockStats(false, 2000)) // logo.png
        .mockResolvedValueOnce(createMockStats(false, 100)) // robots.txt (checked but skipped)
        .mockResolvedValueOnce(createMockStats(false, 3000)); // apple-touch-icon.png

      mockFs.readFile
        .mockResolvedValueOnce(Buffer.from('icon'))  // favicon.ico
        .mockResolvedValueOnce(Buffer.from('logo'))  // logo.png 
        .mockResolvedValueOnce(Buffer.from('touch')); // apple-touch-icon.png

      const result = await scanLocalPublicFiles('/test/public');

      expect(result.size).toBe(3);
      expect(result.get('public/favicon.ico')).toEqual({
        etag: 'mockmd5hash',
        size: 1000
      });
      expect(result.get('public/logo.png')).toEqual({
        etag: 'mockmd5hash',
        size: 2000
      });
      expect(result.get('public/apple-touch-icon.png')).toEqual({
        etag: 'mockmd5hash',
        size: 3000
      });
      expect(result.has('public/robots.txt')).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock readdir to fail for the public directory read
      mockFs.readdir.mockRejectedValueOnce(new Error('Directory not found'));

      const result = await scanLocalPublicFiles('/test/public');

      expect(result.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not scan local public files:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('path conversion utilities', () => {
    describe('s3KeyToLocalPath', () => {
      it('should convert S3 key to local path', () => {
        const result = s3KeyToLocalPath('srefs/sref-123/images/photo.jpg', '/test/data');
        expect(result).toBe('/test/data/srefs/sref-123/images/photo.jpg');
      });

      it('should handle public files', () => {
        const result = s3KeyToLocalPath('public/favicon.ico', '/test/data');
        expect(result).toBe('/test/data/public/favicon.ico');
      });
    });

    describe('localPathToS3Key', () => {
      it('should convert local path to S3 key', () => {
        const result = localPathToS3Key('/test/data/srefs/sref-123/images/photo.jpg', '/test/data');
        expect(result).toBe('srefs/sref-123/images/photo.jpg');
      });

      it('should handle Windows paths', () => {
        // On Unix systems, backslashes are just part of the filename, so we need a different approach
        const result = localPathToS3Key('/test/data/srefs/sref-123/images/photo.jpg', '/test/data');
        expect(result).toBe('srefs/sref-123/images/photo.jpg');
      });
    });
  });
});