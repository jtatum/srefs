import type { ProcessedSref, SearchableItem } from '../../src/lib/types';

export const mockSrefs: ProcessedSref[] = [
  {
    id: '12345678',
    title: 'Watercolor Dreams',
    description: 'Soft watercolor style',
    tags: ['watercolor', 'soft', 'artistic'],
    cover_image: 'cover1.jpg',
    created: '2024-01-15',
    path: '/sref/12345678',
    coverImageUrl: '/data/srefs/sref-12345678/images/cover1.jpg',
    processedImages: [
      {
        filename: 'cover1.jpg',
        url: '/data/srefs/sref-12345678/images/cover1.jpg',
        width: 800,
        height: 600,
        aspectRatio: 1.333,
        prompt: 'watercolor landscape',
      },
    ],
  },
  {
    id: '87654321',
    title: 'Cyberpunk Neon',
    description: 'Dark futuristic style with neon',
    tags: ['cyberpunk', 'neon', 'dark'],
    cover_image: 'cyber1.jpg',
    created: '2024-02-20',
    path: '/sref/87654321',
    coverImageUrl: '/data/srefs/sref-87654321/images/cyber1.jpg',
    processedImages: [
      {
        filename: 'cyber1.jpg',
        url: '/data/srefs/sref-87654321/images/cyber1.jpg',
        width: 1024,
        height: 768,
        aspectRatio: 1.333,
        prompt: 'neon city',
      },
    ],
  },
  {
    id: '11111111',
    title: 'Abstract Geometry',
    description: 'Geometric patterns and shapes',
    tags: ['abstract', 'geometric', 'modern'],
    cover_image: 'geo1.jpg',
    created: '2024-03-10',
    path: '/sref/11111111',
    coverImageUrl: '/data/srefs/sref-11111111/images/geo1.jpg',
    processedImages: [
      {
        filename: 'geo1.jpg',
        url: '/data/srefs/sref-11111111/images/geo1.jpg',
        width: 900,
        height: 900,
        aspectRatio: 1,
      },
    ],
  },
];

export const mockSearchItems: SearchableItem[] = mockSrefs.map(sref => ({
  id: sref.id,
  title: sref.title,
  description: sref.description || '',
  tags: sref.tags,
  searchText: `${sref.id} ${sref.title} ${sref.description || ''} ${sref.tags.join(' ')}`.toLowerCase(),
  coverImageUrl: sref.coverImageUrl,
  path: sref.path,
}));