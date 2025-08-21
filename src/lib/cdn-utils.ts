/**
 * Utility functions for CDN URL handling
 */

/**
 * Convert local asset URLs to CDN URLs when CDN is enabled
 * @param localUrl - The local URL (e.g., "/_astro/image.abc123.avif")
 * @returns The CDN URL if CDN is enabled, otherwise the original URL
 */
export function toCdnUrl(localUrl: string): string {
  // Get environment variables (PUBLIC_ prefix required for Astro)
  const USE_CDN = import.meta.env.PUBLIC_USE_CDN === 'true';
  const CLOUDFRONT_DOMAIN = import.meta.env.PUBLIC_CLOUDFRONT_DOMAIN;
  
  // Only convert _astro URLs to CDN when enabled
  if (USE_CDN && CLOUDFRONT_DOMAIN && localUrl.startsWith('/_astro/')) {
    return `https://${CLOUDFRONT_DOMAIN}/processed${localUrl}`;
  }
  
  return localUrl;
}

/**
 * Check if CDN is enabled
 * @returns True if CDN should be used
 */
export function isCdnEnabled(): boolean {
  return import.meta.env.PUBLIC_USE_CDN === 'true' && !!import.meta.env.PUBLIC_CLOUDFRONT_DOMAIN;
}