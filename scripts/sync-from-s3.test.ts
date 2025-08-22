import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  determineFilesToDownload,
  getLocalPathForS3Key,
  createSyncConfig,
  type SyncConfig
} from './sync-from-s3';
import type { S3FileInfo, LocalFileInfo } from './utils/s3-sync-utils';

describe('sync-from-s3', () => {
  describe('determineFilesToDownload', () => {
    const s3Files: S3FileInfo[] = [
      {
        key: 'srefs/sref-123/images/photo.jpg',
        etag: '"abc123"',
        size: 1000
      },
      {
        key: 'srefs/sref-456/meta.yaml',
        etag: '"def456"',
        size: 500
      },
      {
        key: 'public/favicon.ico',
        etag: '"ico123"',
        size: 2000
      },
      {
        key: 'public/logo.png',
        etag: '"png456"',
        size: 3000
      }
    ];

    it('should return sref files that do not exist locally', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'abc123', size: 1000 }]
        // sref-456/meta.yaml is missing locally
      ]);

      const result = determineFilesToDownload(s3Files, localSrefFiles);

      // Should include missing sref file + all public files (always downloaded)
      expect(result).toHaveLength(3);
      expect(result.map(f => f.key)).toEqual([
        'srefs/sref-456/meta.yaml', // Missing locally
        'public/favicon.ico', // Public files always downloaded
        'public/logo.png' // Public files always downloaded
      ]);
    });

    it('should return sref files that have different ETags (single-part)', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'different123', size: 1000 }], // Different ETag
        ['srefs/sref-456/meta.yaml', { etag: 'def456', size: 500 }] // Same ETag
      ]);

      const result = determineFilesToDownload(s3Files, localSrefFiles);

      // Should include sref file with different ETag + all public files
      expect(result).toHaveLength(3);
      expect(result.map(f => f.key)).toEqual([
        'srefs/sref-123/images/photo.jpg', // Different ETag
        'public/favicon.ico', // Public files always downloaded
        'public/logo.png' // Public files always downloaded
      ]);
    });

    it('should return sref files that have different sizes (multipart)', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'abc123', size: 1500 }], // Different size
        ['srefs/sref-456/meta.yaml', { etag: 'def456', size: 500 }] // Same size
      ]);

      // Simulate multipart upload ETags with dashes
      const s3FilesWithMultipart: S3FileInfo[] = [
        {
          key: 'srefs/sref-123/images/photo.jpg',
          etag: '"abc123-2"', // Multipart ETag (has dash)
          size: 1000 // Different size from local
        },
        {
          key: 'srefs/sref-456/meta.yaml',
          etag: '"def456-1"', // Multipart ETag, same size
          size: 500
        },
        ...s3Files.slice(2) // Keep public files
      ];

      const result = determineFilesToDownload(s3FilesWithMultipart, localSrefFiles);

      // Should include sref file with different size for multipart + all public files
      expect(result).toHaveLength(3);
      expect(result.map(f => f.key)).toEqual([
        'srefs/sref-123/images/photo.jpg', // Different size for multipart
        'public/favicon.ico', // Public files always downloaded
        'public/logo.png' // Public files always downloaded
      ]);
    });

    it('should always include public files regardless of local state', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'abc123', size: 1000 }],
        ['srefs/sref-456/meta.yaml', { etag: 'def456', size: 500 }]
      ]);

      const result = determineFilesToDownload(s3Files, localSrefFiles);

      // Should only include public files when all sref files are up to date
      expect(result).toHaveLength(2);
      expect(result.map(f => f.key)).toEqual([
        'public/favicon.ico',
        'public/logo.png'
      ]);
    });

    it('should handle empty local files map', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>();

      const result = determineFilesToDownload(s3Files, localSrefFiles);

      // Should include all files when no local files exist
      expect(result).toHaveLength(4);
      expect(result.map(f => f.key)).toEqual([
        'srefs/sref-123/images/photo.jpg',
        'srefs/sref-456/meta.yaml',
        'public/favicon.ico',
        'public/logo.png'
      ]);
    });

    it('should handle empty S3 files array', () => {
      const localSrefFiles = new Map<string, LocalFileInfo>([
        ['srefs/sref-123/images/photo.jpg', { etag: 'abc123', size: 1000 }]
      ]);

      const result = determineFilesToDownload([], localSrefFiles);

      expect(result).toHaveLength(0);
    });
  });

  describe('getLocalPathForS3Key', () => {
    const config: SyncConfig = {
      bucketName: 'test-bucket',
      region: 'us-east-1',
      localDataDir: '/test/data',
      publicDir: '/test/public',
      srefsPrefix: 'srefs/',
      publicPrefix: 'public/'
    };

    it('should convert sref S3 keys to local paths', () => {
      const result1 = getLocalPathForS3Key('srefs/sref-123/images/photo.jpg', config);
      expect(result1).toBe('/test/data/srefs/sref-123/images/photo.jpg');

      const result2 = getLocalPathForS3Key('srefs/sref-456/meta.yaml', config);
      expect(result2).toBe('/test/data/srefs/sref-456/meta.yaml');
    });

    it('should convert public S3 keys to local paths', () => {
      const result1 = getLocalPathForS3Key('public/favicon.ico', config);
      expect(result1).toBe('/test/public/favicon.ico');

      const result2 = getLocalPathForS3Key('public/logos/brand.png', config);
      expect(result2).toBe('/test/public/logos/brand.png');
    });

    it('should handle nested paths correctly', () => {
      const result1 = getLocalPathForS3Key('srefs/sref-123/images/subfolder/image.jpg', config);
      expect(result1).toBe('/test/data/srefs/sref-123/images/subfolder/image.jpg');

      const result2 = getLocalPathForS3Key('public/assets/icons/logo.svg', config);
      expect(result2).toBe('/test/public/assets/icons/logo.svg');
    });

    it('should handle edge cases', () => {
      const result1 = getLocalPathForS3Key('public/', config);
      expect(result1).toBe('/test/public'); // path.join removes trailing slash

      const result2 = getLocalPathForS3Key('srefs/', config);
      expect(result2).toBe('/test/data/srefs'); // path.join removes trailing slash
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