import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { SrefMetadata } from '../../lib/types.js';
import { downloadImage, ensureDirectoryExists } from './imageDownloader.js';
import type { ParsedMidjourneyMessage } from './midjourneyParser.js';

export async function createSrefFromMessage(
  parsedMessage: ParsedMidjourneyMessage,
  title: string,
  tags: string[],
  description?: string
): Promise<{ srefId: string; srefPath: string }> {
  const srefId = generateSrefId();
  const srefDirName = `sref-${srefId}`;
  const srefPath = path.join(process.cwd(), 'data', 'srefs', srefDirName);
  const imagesPath = path.join(srefPath, 'images');

  await ensureDirectoryExists(imagesPath);

  const imageExtension = getImageExtension(parsedMessage.imageUrl);
  const imageFilename = `image.${imageExtension}`;
  const imagePath = path.join(imagesPath, imageFilename);

  await downloadImage(parsedMessage.imageUrl, imagePath);

  const metadata: SrefMetadata = {
    id: srefId,
    title,
    description,
    tags,
    cover_image: imageFilename,
    created: new Date().toISOString().split('T')[0],
    images: [
      {
        filename: imageFilename,
        prompt: parsedMessage.prompt,
        width: parsedMessage.imageWidth,
        height: parsedMessage.imageHeight,
        aspectRatio: parsedMessage.imageWidth / parsedMessage.imageHeight
      }
    ]
  };

  const metaPath = path.join(srefPath, 'meta.yaml');
  const yamlContent = yaml.dump(metadata, { 
    defaultFlowStyle: false,
    quotingType: '"',
    forceQuotes: false
  });
  
  await fs.writeFile(metaPath, yamlContent, 'utf-8');

  return { srefId, srefPath };
}

function generateSrefId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getImageExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z]{3,4})(?:\?|$)/);
  return match ? match[1] : 'png';
}