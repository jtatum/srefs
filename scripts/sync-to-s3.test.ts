import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  getS3KeyForFile,
  isImageFile,
  getContentType,
  formatBytes,
  determineFilesToUpload,
  createSyncConfig,
  type LocalFile,
  type SyncConfig
} from './sync-to-s3';
import type { S3FileInfo } from './utils/s3-sync-utils';

describe('sync-to-s3', () => {
  describe('getS3KeyForFile', () => {
    const distDir = '/test/dist';

    it('should generate S3 keys for processed files', () => {
      const filePath = '/test/dist/_astro/image.abc123.jpg';
      const result = getS3KeyForFile(filePath, 'processed', distDir);
      
      expect(result).toBe('cdn/processed/_astro/image.abc123.jpg');
    });

    it('should generate S3 keys for public files', () => {
      const filePath = '/test/dist/favicon.ico';
      const result = getS3KeyForFile(filePath, 'public', distDir);
      
      expect(result).toBe('cdn/public/favicon.ico');
    });

    it('should generate S3 keys for original files', () => {
      const filePath = '/test/dist/data/srefs/sref-123/images/photo.jpg';
      const result = getS3KeyForFile(filePath, 'original', distDir);
      
      expect(result).toBe('cdn/srefs/sref-123/images/photo.jpg');
    });

    it('should return null for original files without data/srefs in path', () => {
      const filePath = '/test/dist/some/other/image.jpg';
      const result = getS3KeyForFile(filePath, 'original', distDir);
      
      expect(result).toBeNull();
    });

    it('should handle nested processed files', () => {
      const filePath = '/test/dist/_astro/subfolder/image.def456.webp';
      const result = getS3KeyForFile(filePath, 'processed', distDir);
      
      expect(result).toBe('cdn/processed/_astro/subfolder/image.def456.webp');
    });

    it('should handle public files with complex names', () => {
      const filePath = '/test/dist/apple-touch-icon-180x180.png';
      const result = getS3KeyForFile(filePath, 'public', distDir);
      
      expect(result).toBe('cdn/public/apple-touch-icon-180x180.png');
    });

    it('should handle original files with nested structure', () => {
      const filePath = '/test/dist/data/srefs/sref-456/images/subfolder/image.gif';
      const result = getS3KeyForFile(filePath, 'original', distDir);
      
      expect(result).toBe('cdn/srefs/sref-456/images/subfolder/image.gif');
    });
  });

  describe('isImageFile', () => {
    it('should return true for image file extensions', () => {
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('photo.jpeg')).toBe(true);
      expect(isImageFile('icon.png')).toBe(true);
      expect(isImageFile('graphic.webp')).toBe(true);
      expect(isImageFile('modern.avif')).toBe(true);
      expect(isImageFile('animation.gif')).toBe(true);
      expect(isImageFile('favicon.ico')).toBe(true);
      expect(isImageFile('vector.svg')).toBe(true);
    });

    it('should handle case insensitive extensions', () => {
      expect(isImageFile('photo.JPG')).toBe(true);
      expect(isImageFile('icon.PNG')).toBe(true);
      expect(isImageFile('graphic.WEBP')).toBe(true);
      expect(isImageFile('vector.SVG')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile('document.pdf')).toBe(false);
      expect(isImageFile('text.txt')).toBe(false);
      expect(isImageFile('data.json')).toBe(false);
      expect(isImageFile('style.css')).toBe(false);
      expect(isImageFile('script.js')).toBe(false);
      expect(isImageFile('meta.yaml')).toBe(false);
    });

    it('should return false for files without extensions', () => {
      expect(isImageFile('README')).toBe(false);
      expect(isImageFile('Dockerfile')).toBe(false);
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

    it('should handle case insensitive extensions', () => {
      expect(getContentType('/path/to/file.JPG')).toBe('image/jpeg');
      expect(getContentType('/path/to/file.PNG')).toBe('image/png');
      expect(getContentType('/path/to/file.SVG')).toBe('image/svg+xml');
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

    it('should handle large file sizes', () => {
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });

  describe('determineFilesToUpload', () => {
    const localFiles: LocalFile[] = [
      {
        filePath: '/dist/image1.jpg',
        s3Key: 'cdn/processed/_astro/image1.abc123.jpg',
        contentType: 'image/jpeg',
        size: 1000,
        etag: 'abc123'
      },
      {
        filePath: '/dist/image2.png',
        s3Key: 'cdn/processed/_astro/image2.def456.png',
        contentType: 'image/png',
        size: 2000,
        etag: 'def456'
      },
      {
        filePath: '/dist/favicon.ico',
        s3Key: 'cdn/public/favicon.ico',
        contentType: 'image/vnd.microsoft.icon',
        size: 3000,
        etag: 'ghi789'
      }
    ];

    it('should return files that do not exist in S3', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['cdn/processed/_astro/image1.abc123.jpg', {
          key: 'cdn/processed/_astro/image1.abc123.jpg',
          etag: '"abc123"',
          size: 1000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'cdn/processed/_astro/image2.def456.png',
        'cdn/public/favicon.ico'
      ]);
    });

    it('should return files that have different ETags (single-part)', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['cdn/processed/_astro/image1.abc123.jpg', {
          key: 'cdn/processed/_astro/image1.abc123.jpg',
          etag: '"different123"', // Different ETag
          size: 1000
        }],
        ['cdn/processed/_astro/image2.def456.png', {
          key: 'cdn/processed/_astro/image2.def456.png',
          etag: '"def456"', // Same ETag
          size: 2000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'cdn/processed/_astro/image1.abc123.jpg', // Different ETag
        'cdn/public/favicon.ico' // Doesn't exist in S3
      ]);
    });

    it('should return files that have different sizes (multipart)', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['cdn/processed/_astro/image1.abc123.jpg', {
          key: 'cdn/processed/_astro/image1.abc123.jpg',
          etag: '"abc123-2"', // Multipart ETag (has dash)
          size: 1500 // Different size
        }],
        ['cdn/processed/_astro/image2.def456.png', {
          key: 'cdn/processed/_astro/image2.def456.png',
          etag: '"def456-3"', // Multipart ETag, same size
          size: 2000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.s3Key)).toEqual([
        'cdn/processed/_astro/image1.abc123.jpg', // Different size for multipart
        'cdn/public/favicon.ico' // Doesn't exist in S3
      ]);
    });

    it('should return no files when all are up to date', () => {
      const s3Files = new Map<string, S3FileInfo>([
        ['cdn/processed/_astro/image1.abc123.jpg', {
          key: 'cdn/processed/_astro/image1.abc123.jpg',
          etag: '"abc123"',
          size: 1000
        }],
        ['cdn/processed/_astro/image2.def456.png', {
          key: 'cdn/processed/_astro/image2.def456.png',
          etag: '"def456"',
          size: 2000
        }],
        ['cdn/public/favicon.ico', {
          key: 'cdn/public/favicon.ico',
          etag: '"ghi789"',
          size: 3000
        }]
      ]);

      const result = determineFilesToUpload(localFiles, s3Files);

      expect(result).toHaveLength(0);
    });

    it('should handle empty local files array', () => {
      const s3Files = new Map<string, S3FileInfo>();

      const result = determineFilesToUpload([], s3Files);

      expect(result).toHaveLength(0);
    });
  });

  describe('createSyncConfig', () => {
    it('should create config with provided bucket and region', () => {
      const config = createSyncConfig('test-bucket', 'us-west-2');

      expect(config).toEqual({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        distDir: path.join(process.cwd(), 'dist'),
        cdnPrefix: 'cdn/'
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