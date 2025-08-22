import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import {
  createTransformConfig,
  transformManifestIcons,
  processManifestTransformation,
  transformManifest,
  type WebManifest
} from './transform-manifest';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('transform-manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockManifest: WebManifest = {
    name: "Midjourney Sref Gallery",
    short_name: "Sref Gallery",
    start_url: "/",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/android-chrome-512x512.png", 
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "https://external.com/icon.png", // External URL should not be transformed
        sizes: "96x96",
        type: "image/png"
      }
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone"
  };

  describe('createTransformConfig', () => {
    it('should create config with CDN enabled', () => {
      const config = createTransformConfig('true', 'd123.cloudfront.net', '/path/manifest');
      
      expect(config).toEqual({
        useCdn: true,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/path/manifest'
      });
    });

    it('should create config with CDN disabled', () => {
      const config = createTransformConfig('false', 'd123.cloudfront.net', '/path/manifest');
      
      expect(config).toEqual({
        useCdn: false,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/path/manifest'
      });
    });

    it('should handle undefined values', () => {
      const config = createTransformConfig(undefined, undefined, '/path/manifest');
      
      expect(config).toEqual({
        useCdn: false,
        cloudfrontDomain: undefined,
        manifestPath: '/path/manifest'
      });
    });
  });

  describe('transformManifestIcons', () => {
    it('should transform absolute URLs to CDN URLs', () => {
      const result = transformManifestIcons(mockManifest, 'd123.cloudfront.net');
      
      expect(result.icons[0].src).toBe('https://d123.cloudfront.net/public/android-chrome-192x192.png');
      expect(result.icons[1].src).toBe('https://d123.cloudfront.net/public/android-chrome-512x512.png');
      expect(result.icons[2].src).toBe('https://external.com/icon.png'); // External URL unchanged
    });

    it('should preserve other manifest properties', () => {
      const result = transformManifestIcons(mockManifest, 'd123.cloudfront.net');
      
      expect(result.name).toBe(mockManifest.name);
      expect(result.short_name).toBe(mockManifest.short_name);
      expect(result.start_url).toBe(mockManifest.start_url);
      expect(result.theme_color).toBe(mockManifest.theme_color);
      expect(result.background_color).toBe(mockManifest.background_color);
      expect(result.display).toBe(mockManifest.display);
    });

    it('should preserve icon properties other than src', () => {
      const result = transformManifestIcons(mockManifest, 'd123.cloudfront.net');
      
      expect(result.icons[0].sizes).toBe(mockManifest.icons[0].sizes);
      expect(result.icons[0].type).toBe(mockManifest.icons[0].type);
    });

    it('should not transform relative URLs without leading slash', () => {
      const manifestWithRelativeIcon: WebManifest = {
        ...mockManifest,
        icons: [
          {
            src: "android-chrome-192x192.png", // No leading slash
            sizes: "192x192",
            type: "image/png"
          }
        ]
      };

      const result = transformManifestIcons(manifestWithRelativeIcon, 'd123.cloudfront.net');
      
      expect(result.icons[0].src).toBe('android-chrome-192x192.png'); // Unchanged
    });
  });

  describe('processManifestTransformation', () => {
    it('should transform manifest when CDN is enabled', async () => {
      const config = {
        useCdn: true,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/test/manifest.json'
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockManifest));
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processManifestTransformation(config);

      expect(mockFs.readFile).toHaveBeenCalledWith('/test/manifest.json', 'utf-8');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/manifest.json',
        expect.stringContaining('https://d123.cloudfront.net/public/android-chrome-192x192.png'),
        'utf-8'
      );

      expect(consoleSpy).toHaveBeenCalledWith('🔄 Transforming site.webmanifest to use CDN URLs...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Transformed site.webmanifest icons to use CDN URLs');
      expect(consoleSpy).toHaveBeenCalledWith('📦 Updated 3 icon references');

      consoleSpy.mockRestore();
    });

    it('should skip transformation when CDN is disabled', async () => {
      const config = {
        useCdn: false,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/test/manifest.json'
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockManifest));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processManifestTransformation(config);

      expect(mockFs.readFile).toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('⏭️  CDN not enabled, skipping manifest transformation');

      consoleSpy.mockRestore();
    });

    it('should skip transformation when cloudfront domain is not set', async () => {
      const config = {
        useCdn: true,
        cloudfrontDomain: undefined,
        manifestPath: '/test/manifest.json'
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockManifest));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processManifestTransformation(config);

      expect(mockFs.readFile).toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('⏭️  CDN not enabled, skipping manifest transformation');

      consoleSpy.mockRestore();
    });

    it('should handle missing manifest file gracefully', async () => {
      const config = {
        useCdn: true,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/test/manifest.json'
      };

      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(error);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processManifestTransformation(config);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  site.webmanifest not found, skipping transformation');

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in manifest file', async () => {
      const config = {
        useCdn: true,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/test/manifest.json'
      };

      mockFs.readFile.mockResolvedValueOnce('invalid json content');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await processManifestTransformation(config);
      } catch (error) {
        expect((error as Error).message).toBe('process.exit called');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to transform manifest:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle file system write errors', async () => {
      const config = {
        useCdn: true,
        cloudfrontDomain: 'd123.cloudfront.net',
        manifestPath: '/test/manifest.json'
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockManifest));
      mockFs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await processManifestTransformation(config);
      } catch (error) {
        expect((error as Error).message).toBe('process.exit called');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to transform manifest:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});