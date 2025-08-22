#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  theme_color: string;
  background_color: string;
  display: string;
}

/**
 * Transform site.webmanifest to use CDN URLs for icons when CDN is enabled
 */
async function transformManifest(): Promise<void> {
  const manifestPath = path.join(process.cwd(), 'dist', 'site.webmanifest');
  
  try {
    // Check if manifest exists
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: WebManifest = JSON.parse(manifestContent);
    
    // Check if CDN is enabled
    const USE_CDN = process.env.PUBLIC_USE_CDN === 'true';
    const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
    
    if (USE_CDN && CLOUDFRONT_DOMAIN) {
      console.log('🔄 Transforming site.webmanifest to use CDN URLs...');
      
      // Transform icon URLs to use CDN
      manifest.icons = manifest.icons.map(icon => {
        if (icon.src.startsWith('/')) {
          const filename = icon.src.substring(1); // Remove leading slash
          return {
            ...icon,
            src: `https://${CLOUDFRONT_DOMAIN}/public/${filename}`
          };
        }
        return icon;
      });
      
      // Write back the transformed manifest
      const transformedContent = JSON.stringify(manifest, null, 2);
      await fs.writeFile(manifestPath, transformedContent, 'utf-8');
      
      console.log('✅ Transformed site.webmanifest icons to use CDN URLs');
      console.log(`📦 Updated ${manifest.icons.length} icon references`);
    } else {
      console.log('⏭️  CDN not enabled, skipping manifest transformation');
    }
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      console.log('⚠️  site.webmanifest not found, skipping transformation');
    } else {
      console.error('❌ Failed to transform manifest:', error);
      process.exit(1);
    }
  }
}

transformManifest().catch(console.error);