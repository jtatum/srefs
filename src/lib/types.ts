export interface SrefImage {
  filename: string;
  prompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export interface SrefMetadata {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  cover_image: string;
  created?: string;
  images?: SrefImage[];
}

export interface ProcessedSref extends SrefMetadata {
  path: string;
  coverImageUrl: string;
  coverImagePath?: string; // Local file path for getImage()
  processedImages: ProcessedImage[];
}

export interface ProcessedImage extends SrefImage {
  url: string;
  filePath: string; // Local file path for getImage()
  width: number;
  height: number;
  aspectRatio: number;
}

export interface SearchableItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  searchText: string;
  coverImageUrl: string;
  path: string;
}