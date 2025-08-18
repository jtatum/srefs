import path from 'path';
import type { ProcessedSref, ProcessedImage, SrefMetadata, SrefImage } from './types';
import { getImage } from 'astro:assets';
import { getSrefCount as getCount, getAllSrefMetadata, getSrefMetadataById } from './sref-data';

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'srefs');

export { getSrefCount } from './sref-data';

export async function getAllSrefs(): Promise<ProcessedSref[]> {
  const metadataList = await getAllSrefMetadata();
  const srefs = await Promise.all(
    metadataList.map(async (metadata) => {
      try {
        return await processMetadata(metadata);
      } catch (error) {
        console.error(`Error processing sref ${metadata.id}:`, error);
        return null;
      }
    })
  );
  
  return srefs.filter((sref): sref is ProcessedSref => sref !== null);
}

export async function getSrefById(id: string): Promise<ProcessedSref | null> {
  const metadata = await getSrefMetadataById(id);
  if (!metadata) {
    return null;
  }
  
  return processMetadata(metadata);
}

async function processImageToProcessedImage(img: SrefImage, dirName: string, imagesDir: string): Promise<ProcessedImage> {
  const imagePath = `${import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/'}data/srefs/${dirName}/images/${img.filename}`;
  const dimensions = await getImageDimensions(path.join(imagesDir, img.filename));
  
  return {
    ...img,
    url: imagePath,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.width / dimensions.height,
  };
}

async function processMetadata(metadata: SrefMetadata): Promise<ProcessedSref> {
  const dirName = `sref-${metadata.id}`;
  const imagesDir = path.join(DATA_DIR, dirName, 'images');
  
  const processedImages: ProcessedImage[] = await Promise.all(
    (metadata.images || []).map(async (img) => 
      processImageToProcessedImage(img, dirName, imagesDir)
    )
  );
  
  const coverImage = processedImages.find(img => img.filename === metadata.cover_image) || processedImages[0];
  
  return {
    ...metadata,
    path: `${import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/'}sref/${metadata.id}`,
    coverImageUrl: coverImage?.url || '',
    processedImages,
  };
}

async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  try {
    const sharp = await import('sharp');
    const metadata = await sharp.default(imagePath).metadata();
    
    return {
      width: metadata.width || 100,
      height: metadata.height || 100,
    };
  } catch (error) {
    console.error(`Error getting dimensions for ${imagePath}:`, error);
    return { width: 100, height: 100 };
  }
}

export function buildSearchIndex(srefs: ProcessedSref[]) {
  return srefs.map(sref => ({
    id: sref.id,
    title: sref.title,
    description: sref.description || '',
    tags: sref.tags,
    searchText: `${sref.id} ${sref.title} ${sref.description || ''} ${sref.tags.join(' ')}`.toLowerCase(),
    coverImageUrl: sref.coverImageUrl,
    path: sref.path,
  }));
}