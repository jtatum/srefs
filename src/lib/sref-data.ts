import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { SrefMetadata } from './types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'srefs');

export async function getSrefCount(): Promise<number> {
  try {
    const srefDirs = await fs.readdir(DATA_DIR);
    // Much faster: just count directories that start with 'sref-'
    // This assumes the bot and manual creation follow naming convention
    return srefDirs.filter(dir => dir.startsWith('sref-')).length;
  } catch (error) {
    console.error('Error counting srefs:', error);
    return 0;
  }
}

export async function getAllSrefMetadata(): Promise<SrefMetadata[]> {
  try {
    const srefDirs = await fs.readdir(DATA_DIR);
    const srefs = await Promise.all(
      srefDirs.map(async (dir) => {
        try {
          return await loadSrefMetadata(dir);
        } catch (error) {
          console.error(`Error loading sref ${dir}:`, error);
          return null;
        }
      })
    );
    
    return srefs.filter((sref): sref is SrefMetadata => sref !== null);
  } catch (error) {
    console.error('Error reading srefs directory:', error);
    return [];
  }
}

export async function getSrefMetadataById(id: string): Promise<SrefMetadata | null> {
  const srefDirs = await fs.readdir(DATA_DIR);
  const matchingDir = srefDirs.find(dir => dir.includes(id));
  
  if (!matchingDir) {
    return null;
  }
  
  return loadSrefMetadata(matchingDir);
}

async function loadSrefMetadata(dirName: string): Promise<SrefMetadata> {
  const srefPath = path.join(DATA_DIR, dirName);
  const metaPath = path.join(srefPath, 'meta.yaml');
  
  const metaContent = await fs.readFile(metaPath, 'utf-8');
  const metadata = yaml.load(metaContent) as SrefMetadata;
  
  // Auto-discover images if not specified in metadata
  if (!metadata.images || metadata.images.length === 0) {
    const imagesDir = path.join(srefPath, 'images');
    try {
      const imageFiles = await fs.readdir(imagesDir);
      metadata.images = imageFiles
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .map(filename => ({ filename }));
    } catch (error) {
      metadata.images = [];
    }
  }
  
  return metadata;
}