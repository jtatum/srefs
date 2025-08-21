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
): Promise<{ srefId: string; srefPath: string; isNewSref: boolean }> {
  const srefId = parsedMessage.srefValue || generateSrefId();
  const srefDirName = `sref-${srefId}`;
  const srefPath = path.join(process.cwd(), 'src', 'data', 'srefs', srefDirName);
  const imagesPath = path.join(srefPath, 'images');
  const metaPath = path.join(srefPath, 'meta.yaml');

  // Check if sref already exists
  const srefExists = await fs.access(metaPath).then(() => true).catch(() => false);
  
  await ensureDirectoryExists(imagesPath);

  const imageExtension = getImageExtension(parsedMessage.imageUrl);
  
  let imageFilename: string;
  let metadata: SrefMetadata;

  if (srefExists) {
    // Load existing metadata
    const existingMetaContent = await fs.readFile(metaPath, 'utf-8');
    const existingMetadata = yaml.load(existingMetaContent) as SrefMetadata;
    
    // Generate unique filename for new image
    const existingImages = existingMetadata.images || [];
    const baseFilename = `image-${Date.now()}`;
    imageFilename = `${baseFilename}.${imageExtension}`;
    
    // Ensure filename is unique
    let counter = 1;
    while (existingImages.some(img => img.filename === imageFilename)) {
      imageFilename = `${baseFilename}-${counter}.${imageExtension}`;
      counter++;
    }
    
    const imagePath = path.join(imagesPath, imageFilename);
    await downloadImage(parsedMessage.imageUrl, imagePath);

    // Add new image to existing metadata
    const newImage = {
      filename: imageFilename,
      prompt: parsedMessage.prompt,
      width: parsedMessage.imageWidth,
      height: parsedMessage.imageHeight,
      aspectRatio: parsedMessage.imageWidth / parsedMessage.imageHeight
    };

    metadata = {
      ...existingMetadata,
      images: [...existingImages, newImage]
    };
  } else {
    // Create new sref
    imageFilename = `image.${imageExtension}`;
    const imagePath = path.join(imagesPath, imageFilename);
    
    await downloadImage(parsedMessage.imageUrl, imagePath);

    metadata = {
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
  }

  const yamlContent = yaml.dump(metadata, { 
    defaultFlowStyle: false,
    quotingType: '"',
    forceQuotes: false
  });
  
  await fs.writeFile(metaPath, yamlContent, 'utf-8');

  return { srefId, srefPath, isNewSref: !srefExists };
}

function generateSrefId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getImageExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z]{3,4})(?:\?|$)/);
  return match ? match[1] : 'png';
}