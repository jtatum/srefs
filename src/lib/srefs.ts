import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { SrefMetadata, ProcessedSref, ProcessedImage } from './types';
import { getImage } from 'astro:assets';

const DATA_DIR = path.join(process.cwd(), 'data', 'srefs');

export async function getAllSrefs(): Promise<ProcessedSref[]> {
  try {
    const srefDirs = await fs.readdir(DATA_DIR);
    const srefs = await Promise.all(
      srefDirs.map(async (dir) => {
        try {
          return await loadSref(dir);
        } catch (error) {
          console.error(`Error loading sref ${dir}:`, error);
          return null;
        }
      })
    );
    
    return srefs.filter((sref): sref is ProcessedSref => sref !== null);
  } catch (error) {
    console.error('Error reading srefs directory:', error);
    return [];
  }
}

export async function getSrefById(id: string): Promise<ProcessedSref | null> {
  const srefDirs = await fs.readdir(DATA_DIR);
  const matchingDir = srefDirs.find(dir => dir.includes(id));
  
  if (!matchingDir) {
    return null;
  }
  
  return loadSref(matchingDir);
}

async function loadSref(dirName: string): Promise<ProcessedSref> {
  const srefPath = path.join(DATA_DIR, dirName);
  const metaPath = path.join(srefPath, 'meta.yaml');
  
  const metaContent = await fs.readFile(metaPath, 'utf-8');
  const metadata = yaml.load(metaContent) as SrefMetadata;
  
  const imagesDir = path.join(srefPath, 'images');
  let processedImages: ProcessedImage[] = [];
  
  if (metadata.images && metadata.images.length > 0) {
    processedImages = await Promise.all(
      metadata.images.map(async (img) => {
        const imagePath = `/data/srefs/${dirName}/images/${img.filename}`;
        const dimensions = await getImageDimensions(path.join(imagesDir, img.filename));
        
        return {
          ...img,
          url: imagePath,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: dimensions.width / dimensions.height,
        };
      })
    );
  } else {
    const imageFiles = await fs.readdir(imagesDir).catch(() => []);
    processedImages = await Promise.all(
      imageFiles
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .map(async (filename) => {
          const imagePath = `/data/srefs/${dirName}/images/${filename}`;
          const dimensions = await getImageDimensions(path.join(imagesDir, filename));
          
          return {
            filename,
            url: imagePath,
            width: dimensions.width,
            height: dimensions.height,
            aspectRatio: dimensions.width / dimensions.height,
          };
        })
    );
  }
  
  const coverImage = processedImages.find(img => img.filename === metadata.cover_image) || processedImages[0];
  
  return {
    ...metadata,
    path: `/sref/${metadata.id}`,
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