#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

export interface WebManifest {
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

export interface TransformConfig {
  useCdn: boolean;
  cloudfrontDomain?: string;
  manifestPath: string;
}

export function createTransformConfig(
  useCdn: string | undefined,
  cloudfrontDomain: string | undefined,
  manifestPath: string
): TransformConfig {
  return {
    useCdn: useCdn === 'true',
    cloudfrontDomain,
    manifestPath
  };
}

export function transformManifestIcons(manifest: WebManifest, cloudfrontDomain: string): WebManifest {
  return {
    ...manifest,
    icons: manifest.icons.map(icon => {
      if (icon.src.startsWith('/')) {
        const filename = icon.src.substring(1); // Remove leading slash
        return {
          ...icon,
          src: `https://${cloudfrontDomain}/public/${filename}`
        };
      }
      return icon;
    })
  };
}

export async function processManifestTransformation(config: TransformConfig): Promise<void> {
  try {
    // Check if manifest exists
    const manifestContent = await fs.readFile(config.manifestPath, 'utf-8');
    const manifest: WebManifest = JSON.parse(manifestContent);
    
    if (config.useCdn && config.cloudfrontDomain) {
      console.log('🔄 Transforming site.webmanifest to use CDN URLs...');
      
      // Transform icon URLs to use CDN
      const transformedManifest = transformManifestIcons(manifest, config.cloudfrontDomain);
      
      // Write back the transformed manifest
      const transformedContent = JSON.stringify(transformedManifest, null, 2);
      await fs.writeFile(config.manifestPath, transformedContent, 'utf-8');
      
      console.log('✅ Transformed site.webmanifest icons to use CDN URLs');
      console.log(`📦 Updated ${transformedManifest.icons.length} icon references`);
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

export async function transformManifest(): Promise<void> {
  const manifestPath = path.join(process.cwd(), 'dist', 'site.webmanifest');
  const config = createTransformConfig(
    process.env.PUBLIC_USE_CDN,
    process.env.CLOUDFRONT_DOMAIN,
    manifestPath
  );
  
  await processManifestTransformation(config);
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  transformManifest().catch(console.error);
}