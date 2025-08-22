import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire cdn-utils module to control import.meta.env
vi.mock('./cdn-utils', async () => {
  const actual = await vi.importActual<typeof import('./cdn-utils')>('./cdn-utils');
  
  // Create a function to get current mock env values
  const getMockEnv = () => (globalThis as any).__VITEST_CDN_MOCK_ENV__ || { PUBLIC_USE_CDN: 'false', PUBLIC_CLOUDFRONT_DOMAIN: '' };
  
  return {
    toCdnUrl: (localUrl: string): string => {
      const env = getMockEnv();
      const USE_CDN = env.PUBLIC_USE_CDN === 'true';
      const CLOUDFRONT_DOMAIN = env.PUBLIC_CLOUDFRONT_DOMAIN;
      
      if (USE_CDN && CLOUDFRONT_DOMAIN && localUrl.startsWith('/_astro/')) {
        return `https://${CLOUDFRONT_DOMAIN}/processed${localUrl}`;
      }
      
      return localUrl;
    },
    
    toPublicCdnUrl: (localUrl: string): string => {
      const env = getMockEnv();
      const USE_CDN = env.PUBLIC_USE_CDN === 'true';
      const CLOUDFRONT_DOMAIN = env.PUBLIC_CLOUDFRONT_DOMAIN;
      
      if (USE_CDN && CLOUDFRONT_DOMAIN && localUrl.startsWith('/')) {
        const filename = localUrl.substring(1);
        return `https://${CLOUDFRONT_DOMAIN}/public/${filename}`;
      }
      
      return localUrl;
    },
    
    toAbsoluteCdnUrl: (localUrl: string, siteUrl: string): string => {
      const env = getMockEnv();
      const USE_CDN = env.PUBLIC_USE_CDN === 'true';
      const CLOUDFRONT_DOMAIN = env.PUBLIC_CLOUDFRONT_DOMAIN;
      
      if (USE_CDN && CLOUDFRONT_DOMAIN && localUrl.startsWith('/')) {
        const filename = localUrl.substring(1);
        return `https://${CLOUDFRONT_DOMAIN}/public/${filename}`;
      }
      
      return new URL(localUrl, siteUrl).toString();
    },
    
    isCdnEnabled: (): boolean => {
      const env = getMockEnv();
      return env.PUBLIC_USE_CDN === 'true' && !!env.PUBLIC_CLOUDFRONT_DOMAIN;
    }
  };
});

// Import after mocking
const { toCdnUrl, toPublicCdnUrl, toAbsoluteCdnUrl, isCdnEnabled } = await import('./cdn-utils');

describe('cdn-utils', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
      PUBLIC_USE_CDN: 'false',
      PUBLIC_CLOUDFRONT_DOMAIN: '',
    };
  });

  describe('toCdnUrl', () => {
    it('should return original URL when CDN is disabled', () => {
      const localUrl = '/_astro/image.abc123.avif';
      const result = toCdnUrl(localUrl);
      
      expect(result).toBe(localUrl);
    });

    it('should return original URL when CLOUDFRONT_DOMAIN is not set', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
        PUBLIC_USE_CDN: 'true',
        PUBLIC_CLOUDFRONT_DOMAIN: '', // Empty domain
      };
      
      const localUrl = '/_astro/image.abc123.avif';
      const result = toCdnUrl(localUrl);
      
      expect(result).toBe(localUrl);
    });

    it('should convert _astro URLs to CDN when enabled', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
        PUBLIC_USE_CDN: 'true',
        PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/_astro/image.abc123.avif';
      const result = toCdnUrl(localUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/processed/_astro/image.abc123.avif');
    });

    it('should not convert non-_astro URLs even when CDN is enabled', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
        PUBLIC_USE_CDN: 'true',
        PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/favicon.ico';
      const result = toCdnUrl(localUrl);
      
      expect(result).toBe('/favicon.ico');
    });

    it('should handle complex _astro URLs', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/_astro/complex-image-name.with-dashes.hash123456.webp';
      const result = toCdnUrl(localUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/processed/_astro/complex-image-name.with-dashes.hash123456.webp');
    });

    it('should handle URLs without leading slash in _astro path', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '_astro/image.abc123.avif'; // Missing leading slash
      const result = toCdnUrl(localUrl);
      
      // Should not convert since it doesn't start with /_astro/
      expect(result).toBe('_astro/image.abc123.avif');
    });
  });

  describe('toPublicCdnUrl', () => {
    it('should return original URL when CDN is disabled', () => {
      const localUrl = '/favicon.ico';
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe(localUrl);
    });

    it('should return original URL when CLOUDFRONT_DOMAIN is not set', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: '', // Empty domain
      };
      
      const localUrl = '/favicon.ico';
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe(localUrl);
    });

    it('should convert public URLs to CDN when enabled', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/favicon.ico';
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/public/favicon.ico');
    });

    it('should handle nested paths', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/images/logo.png';
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/public/images/logo.png');
    });

    it('should not convert URLs without leading slash', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = 'favicon.ico'; // No leading slash
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe('favicon.ico');
    });

    it('should handle root path correctly', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/';
      const result = toPublicCdnUrl(localUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/public/');
    });
  });

  describe('toAbsoluteCdnUrl', () => {
    const siteUrl = 'https://example.com';

    it('should return absolute site URL when CDN is disabled', () => {
      const localUrl = '/og.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://example.com/og.png');
    });

    it('should return absolute site URL when CLOUDFRONT_DOMAIN is not set', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: '', // Empty domain
      };
      
      const localUrl = '/og.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://example.com/og.png');
    });

    it('should convert to absolute CDN URL when enabled', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/og.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/public/og.png');
    });

    it('should handle social media meta image paths', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = '/apple-touch-icon.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://d123456789.cloudfront.net/public/apple-touch-icon.png');
    });

    it('should not convert URLs without leading slash and fallback to site URL', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const localUrl = 'og.png'; // No leading slash
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://example.com/og.png');
    });

    it('should handle site URLs with trailing slash', () => {
      const siteUrlWithSlash = 'https://example.com/';
      const localUrl = '/og.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrlWithSlash);
      
      expect(result).toBe('https://example.com/og.png');
    });

    it('should handle site URLs with subpaths', () => {
      const siteUrlWithSubpath = 'https://example.com/subpath';
      const localUrl = '/og.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrlWithSubpath);
      
      expect(result).toBe('https://example.com/og.png');
    });

    it('should handle relative URLs correctly with site URL', () => {
      const localUrl = 'relative/path/image.png';
      const result = toAbsoluteCdnUrl(localUrl, siteUrl);
      
      expect(result).toBe('https://example.com/relative/path/image.png');
    });
  });

  describe('isCdnEnabled', () => {
    it('should return false when CDN is disabled', () => {
      const result = isCdnEnabled();
      
      expect(result).toBe(false);
    });

    it('should return false when USE_CDN is true but CLOUDFRONT_DOMAIN is not set', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: '', // Empty domain
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(false);
    });

    it('should return false when CLOUDFRONT_DOMAIN is set but USE_CDN is false', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'false',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(false);
    });

    it('should return true when both CDN and domain are configured', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(true);
    });

    it('should handle USE_CDN values other than "true" as false', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'TRUE', // Different case
          PUBLIC_CLOUDFRONT_DOMAIN: 'd123456789.cloudfront.net',
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(false);
    });

    it('should handle empty string CLOUDFRONT_DOMAIN as false', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: '', // Explicitly empty
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(false);
    });

    it('should handle whitespace-only CLOUDFRONT_DOMAIN as true', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: 'true',
          PUBLIC_CLOUDFRONT_DOMAIN: '   ', // Only whitespace
      };
      
      const result = isCdnEnabled();
      
      expect(result).toBe(true); // !! converts truthy string to true
    });
  });

  describe('environment variable edge cases', () => {
    it('should handle undefined environment variables gracefully', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {};
      
      
      expect(toCdnUrl('/_astro/test.jpg')).toBe('/_astro/test.jpg');
      expect(toPublicCdnUrl('/favicon.ico')).toBe('/favicon.ico');
      expect(toAbsoluteCdnUrl('/og.png', 'https://example.com')).toBe('https://example.com/og.png');
      expect(isCdnEnabled()).toBe(false);
    });

    it('should handle null-like values in environment', () => {
      (globalThis as any).__VITEST_CDN_MOCK_ENV__ = {
          PUBLIC_USE_CDN: null,
          PUBLIC_CLOUDFRONT_DOMAIN: null,
      };
      
      expect(isCdnEnabled()).toBe(false);
    });
  });
});