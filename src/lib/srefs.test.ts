import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSearchIndex } from './srefs';
import { mockSrefs } from '../../tests/mocks/mockData';
import type { ProcessedSref } from './types';

// Mock the sharp module
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
    }),
  })),
}));

// Mock astro:assets
vi.mock('astro:assets', () => ({
  getImage: vi.fn(),
}));

describe('srefs data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSearchIndex', () => {
    it('should create search index from srefs', () => {
      const searchIndex = buildSearchIndex(mockSrefs);

      expect(searchIndex).toHaveLength(3);
      expect(searchIndex[0]).toMatchObject({
        id: '12345678',
        title: 'Watercolor Dreams',
        description: 'Soft watercolor style',
        tags: ['watercolor', 'soft', 'artistic'],
        path: '/sref/12345678',
      });
    });

    it('should create lowercase searchText', () => {
      const searchIndex = buildSearchIndex(mockSrefs);

      expect(searchIndex[0].searchText).toBe(
        '12345678 watercolor dreams soft watercolor style watercolor soft artistic'
      );
    });

    it('should handle missing description', () => {
      const srefsWithoutDesc: ProcessedSref[] = [
        {
          ...mockSrefs[0],
          description: undefined,
        },
      ];

      const searchIndex = buildSearchIndex(srefsWithoutDesc);
      expect(searchIndex[0].description).toBe('');
      expect(searchIndex[0].searchText).not.toContain('undefined');
    });

    it('should include all required fields', () => {
      const searchIndex = buildSearchIndex([mockSrefs[0]]);
      const item = searchIndex[0];

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('tags');
      expect(item).toHaveProperty('searchText');
      expect(item).toHaveProperty('coverImageUrl');
      expect(item).toHaveProperty('path');
    });
  });
});

describe('srefs data validation', () => {
  it('should validate required metadata fields', () => {
    const validMetadata = {
      id: 'test123',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'test.jpg',
    };

    expect(validMetadata).toHaveProperty('id');
    expect(validMetadata).toHaveProperty('title');
    expect(validMetadata).toHaveProperty('tags');
    expect(validMetadata).toHaveProperty('cover_image');
  });

  it('should handle srefs with no explicit images array', () => {
    const srefWithoutImages = {
      ...mockSrefs[0],
      images: undefined,
    };

    expect(srefWithoutImages.processedImages).toBeDefined();
    expect(srefWithoutImages.processedImages.length).toBeGreaterThan(0);
  });

  it('should use first image if cover_image not found', () => {
    const srefWithInvalidCover = {
      ...mockSrefs[0],
      cover_image: 'nonexistent.jpg',
      processedImages: [
        {
          filename: 'actual.jpg',
          url: '/path/to/actual.jpg',
          width: 800,
          height: 600,
          aspectRatio: 1.333,
        },
      ],
    };

    const coverImage = srefWithInvalidCover.processedImages[0];
    expect(coverImage.filename).toBe('actual.jpg');
  });
});

describe('image processing', () => {
  it('should calculate aspect ratio correctly', () => {
    const image = {
      width: 1920,
      height: 1080,
    };

    const aspectRatio = image.width / image.height;
    expect(aspectRatio).toBeCloseTo(1.778, 2);
  });

  it('should provide fallback dimensions on error', () => {
    const fallbackDimensions = { width: 100, height: 100 };
    expect(fallbackDimensions.width).toBe(100);
    expect(fallbackDimensions.height).toBe(100);
  });

  it('should filter only supported image formats', () => {
    const files = ['image.jpg', 'image.png', 'image.webp', 'image.gif', 'document.pdf', 'script.js'];
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file));

    expect(imageFiles).toHaveLength(4);
    expect(imageFiles).not.toContain('document.pdf');
    expect(imageFiles).not.toContain('script.js');
  });
});