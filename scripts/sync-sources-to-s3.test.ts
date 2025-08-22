import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import {
  createLocalSourceFilesFromSrefMap,
  createLocalSourceFilesFromPublicMap,
  determineFilesToUpload,
  getContentType,
  formatBytes,
  createSyncConfig,
  type LocalSourceFile,
  type SyncConfig
} from './sync-sources-to-s3';
import type { LocalFileInfo, S3FileInfo } from './utils/s3-sync-utils';

describe('sync-sources-to-s3', () => {
  describe('createLocalSourceFilesFromSrefMap', () => {
    it('should convert sref file map to LocalSourceFile array', () => {
      const srefFileMap = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'abc123', size: 1000 }],
        ['srefs/sref-456/meta.yaml', { etag: 'def456', size: 500 }]
      ]);
      const localDataDir = '/test/data';

      const result = createLocalSourceFilesFromSrefMap(srefFileMap, localDataDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filePath: '/test/data/srefs/sref-123/images/photo.jpg',
        s3Key: 'srefs/sref-123/images/photo.jpg',
        contentType: 'image/jpeg',
        size: 1000,
        etag: 'abc123'
      });
      expect(result[1]).toEqual({
        filePath: '/test/data/srefs/sref-456/meta.yaml',
        s3Key: 'srefs/sref-456/meta.yaml',
        contentType: 'text/yaml',
        size: 500,
        etag: 'def456'
      });
    });

    it('should handle empty map', () => {
      const srefFileMap = new Map<string, LocalFileInfo>();
      const localDataDir = '/test/data';

      const result = createLocalSourceFilesFromSrefMap(srefFileMap, localDataDir);

      expect(result).toHaveLength(0);
    });
  });

  describe('createLocalSourceFilesFromPublicMap', () => {
    it('should convert public file map to LocalSourceFile array', () => {
      const publicFileMap = new Map<string, LocalFileInfo>([
        ['public/favicon.ico', { etag: 'ico123', size: 2000 }],
        ['public/logo.png', { etag: 'png456', size: 3000 }]
      ]);
      const publicDir = '/test/public';

      const result = createLocalSourceFilesFromPublicMap(publicFileMap, publicDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filePath: '/test/public/favicon.ico',
        s3Key: 'public/favicon.ico',
        contentType: 'image/vnd.microsoft.icon',
        size: 2000,
        etag: 'ico123'
      });
      expect(result[1]).toEqual({
        filePath: '/test/public/logo.png',
        s3Key: 'public/logo.png',
        contentType: 'image/png',
        size: 3000,
        etag: 'png456'
      });
    });

    it('should handle files with public/ prefix correctly', () => {
      const publicFileMap = new Map<string, LocalFileInfo>([
        ['public/subfolder/icon.svg', { etag: 'svg123', size: 1500 }]
      ]);
      const publicDir = '/test/public';

      const result = createLocalSourceFilesFromPublicMap(publicFileMap, publicDir);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filePath: '/test/public/subfolder/icon.svg',
        s3Key: 'public/subfolder/icon.svg',
        contentType: 'image/svg+xml',
        size: 1500,
        etag: 'svg123'
      });
    });
  });

  describe('determineFilesToUpload', () => {
    const localFiles: LocalSourceFile[] = [
      {
        filePath: '/local/file1.jpg',
        s3Key: 'srefs/sref-123/images/file1.jpg',
        contentType: 'image/jpeg',
        size: 1000,
        etag: 'abc123'
      },
      {
        filePath: '/local/file2.png',
        s3Key: 'srefs/sref-456/images/file2.png',
        contentType: 'image/png',
        size: 2000,
        etag: 'def456'
      },
      {
        filePath: '/local/file3.webp',
        s3Key: 'public/file3.webp',
        contentType: 'image/webp',
        size: 3000,
        etag: 'ghi789'
      }
    ];

    it('should return files that do not exist in S3', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['srefs/sref-123/images/file1.jpg', {
          key: 'srefs/sref-123/images/file1.jpg',
          etag: '"abc123"',
          size: 1000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'srefs/sref-456/images/file2.png',
        'public/file3.webp'
      ]);
    });

    it('should return files that have different ETags (single-part)', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['srefs/sref-123/images/file1.jpg', {
          key: 'srefs/sref-123/images/file1.jpg',
          etag: '"different123"', // Different ETag
          size: 1000
        }],
        ['srefs/sref-456/images/file2.png', {
          key: 'srefs/sref-456/images/file2.png',
          etag: '"def456"', // Same ETag
          size: 2000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'srefs/sref-123/images/file1.jpg', // Different ETag
        'public/file3.webp' // Doesn't exist in S3
      ]);
    });

    it('should return files that have different sizes (multipart)', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['srefs/sref-123/images/file1.jpg', {
          key: 'srefs/sref-123/images/file1.jpg',
          etag: '"abc123-2"', // Multipart ETag (has dash)
          size: 1500 // Different size
        }],
        ['srefs/sref-456/images/file2.png', {
          key: 'srefs/sref-456/images/file2.png',
          etag: '"def456-3"', // Multipart ETag, same size
          size: 2000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'srefs/sref-123/images/file1.jpg', // Different size for multipart
        'public/file3.webp' // Doesn't exist in S3
      ]);
    });

    it('should return no files when all are up to date', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['srefs/sref-123/images/file1.jpg', {
          key: 'srefs/sref-123/images/file1.jpg',
          etag: '"abc123"',
          size: 1000
        }],
        ['srefs/sref-456/images/file2.png', {
          key: 'srefs/sref-456/images/file2.png',
          etag: '"def456"',
          size: 2000
        }],
        ['public/file3.webp', {
          key: 'public/file3.webp',
          etag: '"ghi789"',
          size: 3000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(0);
    });
  });

  describe('getContentType', () => {
    it('should return correct MIME types for image files', () => {
      expect(getContentType('/path/to/file.jpg')).toBe('image/jpeg');
      expect(getContentType('/path/to/file.jpeg')).toBe('image/jpeg');
      expect(getContentType('/path/to/file.png')).toBe('image/png');
      expect(getContentType('/path/to/file.webp')).toBe('image/webp');
      expect(getContentType('/path/to/file.avif')).toBe('image/avif');
      expect(getContentType('/path/to/file.gif')).toBe('image/gif');
      expect(getContentType('/path/to/file.ico')).toBe('image/vnd.microsoft.icon');
      expect(getContentType('/path/to/file.svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME types for YAML files', () => {
      expect(getContentType('/path/to/meta.yaml')).toBe('text/yaml');
      expect(getContentType('/path/to/meta.yml')).toBe('text/yaml');
    });

    it('should handle case insensitive extensions', () => {
      expect(getContentType('/path/to/file.JPG')).toBe('image/jpeg');
      expect(getContentType('/path/to/file.PNG')).toBe('image/png');
      expect(getContentType('/path/to/meta.YAML')).toBe('text/yaml');
    });

    it('should return default content type for unknown extensions', () => {
      expect(getContentType('/path/to/file.txt')).toBe('application/octet-stream');
      expect(getContentType('/path/to/file.pdf')).toBe('application/octet-stream');
      expect(getContentType('/path/to/file')).toBe('application/octet-stream');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(512)).toBe('512 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
    });

    it('should handle decimal places correctly', () => {
      expect(formatBytes(1587)).toBe('1.55 KB');
      expect(formatBytes(1024 * 1024 * 1.25)).toBe('1.25 MB');
    });
  });

  describe('createSyncConfig', () => {
    it('should create config with provided bucket and region', () => {
      const config = createSyncConfig('test-bucket', 'us-west-2');

      expect(config).toEqual({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        localDataDir: path.join(process.cwd(), 'src', 'data'),
        publicDir: path.join(process.cwd(), 'public'),
        srefsPrefix: 'srefs/',
        publicPrefix: 'public/'
      });
    });

    it('should use default region when not provided', () => {
      const config = createSyncConfig('test-bucket', undefined);

      expect(config?.region).toBe('us-east-1');
    });

    it('should return null when bucket name is not provided', () => {
      const config = createSyncConfig(undefined, 'us-west-2');

      expect(config).toBeNull();
    });

    it('should return null when bucket name is empty string', () => {
      const config = createSyncConfig('', 'us-west-2');

      expect(config).toBeNull();
    });
  });
});