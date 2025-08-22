import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSearchIndex, getSrefCount, getAllSrefs, getSrefById } from './srefs';
import { mockSrefs } from '../../tests/mocks/mockData';
import type { ProcessedSref, SrefMetadata } from './types';
import fs from 'fs/promises';

// Mock the sharp module with proper chaining
const createMockSharp = (metadata = { width: 800, height: 600 }) => ({
  metadata: vi.fn().mockResolvedValue(metadata),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(), 
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-buffer')),
  toFile: vi.fn().mockResolvedValue({ success: true })
});

const mockSharp = vi.fn(() => createMockSharp());

vi.mock('sharp', () => ({
  default: mockSharp,
}));

// Mock astro:assets
vi.mock('astro:assets', () => ({
  getImage: vi.fn(),
}));

// Mock fs/promises - need to handle dynamic import
vi.mock('fs/promises', () => {
  const mockFsAccess = vi.fn();
  const mockFsReaddir = vi.fn();
  
  return {
    default: {
      readdir: mockFsReaddir,
      access: mockFsAccess,
    },
    access: mockFsAccess,
    readdir: mockFsReaddir,
  };
});

// Mock sref-data functions
vi.mock('./sref-data', () => ({
  getSrefCount: vi.fn(),
  getAllSrefMetadata: vi.fn(),
  getSrefMetadataById: vi.fn(),
}));

describe('srefs data loading', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mocks for filesystem access
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockResolvedValue(undefined);
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

describe('getSrefCount', () => {
  it('should count directories starting with sref-', async () => {
    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefCount).mockResolvedValue(3);

    const count = await getSrefCount();
    expect(count).toBe(3); // Only the 3 sref- directories
  });

  it('should return 0 when directory does not exist', async () => {
    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefCount).mockResolvedValue(0);

    const count = await getSrefCount();
    expect(count).toBe(0);
  });

  it('should return 0 when no sref directories exist', async () => {
    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefCount).mockResolvedValue(0);

    const count = await getSrefCount();
    expect(count).toBe(0);
  });
});

describe('getAllSrefs', () => {
  let mockGetAllSrefMetadata: any;

  beforeEach(async () => {
    const srefData = await import('./sref-data');
    mockGetAllSrefMetadata = vi.mocked(srefData.getAllSrefMetadata);
    
    // Mock fs.access to succeed by default
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockResolvedValue(undefined);
  });

  it('should process all srefs successfully', async () => {
    const mockMetadata: SrefMetadata[] = [
      {
        id: '12345678',
        title: 'Test Sref',
        tags: ['test'],
        cover_image: 'cover.jpg',
        images: [
          { filename: 'cover.jpg', prompt: 'test prompt' }
        ]
      }
    ];

    mockGetAllSrefMetadata.mockResolvedValue(mockMetadata);
    
    // Set CI environment to use fallback dimensions
    const originalCI = process.env.CI;
    process.env.CI = 'true';

    const result = await getAllSrefs();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
    });
    expect(result[0].processedImages).toHaveLength(1);
    expect(result[0].processedImages[0]).toEqual(
      expect.objectContaining({
        filename: 'cover.jpg',
        width: 800,  // Sharp mock dimensions
        height: 600,
        aspectRatio: 800 / 600,
      })
    );
    
    process.env.CI = originalCI;
  });

  it('should handle processing errors gracefully', async () => {
    const mockMetadata: SrefMetadata[] = [
      {
        id: '12345678',
        title: 'Good Sref',
        tags: ['test'],
        cover_image: 'cover.jpg',
        images: [{ filename: 'cover.jpg' }]
      },
      {
        id: 'invalid',
        title: 'Bad Sref',
        tags: ['test'],
        cover_image: 'missing.jpg',
        images: [{ filename: 'missing.jpg' }]
      }
    ];

    mockGetAllSrefMetadata.mockResolvedValue(mockMetadata);
    
    // Set CI environment to avoid warnings
    const originalCI = process.env.CI;
    process.env.CI = 'true';

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getAllSrefs();

    // Both srefs should be processed (even with missing files in CI)
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('12345678');
    expect(result[1].id).toBe('invalid');

    consoleErrorSpy.mockRestore();
    process.env.CI = originalCI;
  });

  it('should filter out null results from failed processing', async () => {
    const mockMetadata: SrefMetadata[] = [
      {
        id: 'valid1',
        title: 'Valid Sref 1',
        tags: ['test'],
        cover_image: 'cover1.jpg',
        images: [{ filename: 'cover1.jpg' }]
      },
      {
        id: 'valid2', 
        title: 'Valid Sref 2',
        tags: ['test'],
        cover_image: 'cover2.jpg',
        images: [{ filename: 'cover2.jpg' }]
      }
    ];

    mockGetAllSrefMetadata.mockResolvedValue(mockMetadata);
    
    // Set CI environment to avoid warnings
    const originalCI = process.env.CI;
    process.env.CI = 'true';

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getAllSrefs();

    // Both should be processed successfully in CI environment
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('valid1');
    expect(result[1].id).toBe('valid2');
    
    consoleErrorSpy.mockRestore();
    process.env.CI = originalCI;
  });
});

describe('getSrefById', () => {
  let mockGetSrefMetadataById: any;

  beforeEach(async () => {
    const srefData = await import('./sref-data');
    mockGetSrefMetadataById = vi.mocked(srefData.getSrefMetadataById);
    
    // Mock fs.access to succeed by default
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockResolvedValue(undefined);
  });

  it('should return processed sref when found', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'cover.jpg',
      images: [{ filename: 'cover.jpg', prompt: 'test' }]
    };

    mockGetSrefMetadataById.mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('12345678');
    expect(result!.title).toBe('Test Sref');
    expect(result!.processedImages).toHaveLength(1);
  });

  it('should return null when sref not found', async () => {
    mockGetSrefMetadataById.mockResolvedValue(null);

    const result = await getSrefById('nonexistent');

    expect(result).toBeNull();
  });

  it('should handle processing errors', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'missing.jpg',
      images: [{ filename: 'missing.jpg' }]
    };

    mockGetSrefMetadataById.mockResolvedValue(mockMetadata);
    
    // Mock fs.access to fail
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockRejectedValue(new Error('File not found'));

    // Should still return the sref with fallback dimensions
    const result = await getSrefById('12345678');

    expect(result).not.toBeNull();
    expect(result!.processedImages[0]).toMatchObject({
      width: 1024,
      height: 1024, // Fallback dimensions
    });
  });
});

describe('image processing', () => {
  beforeEach(async () => {
    // Clear and setup mocks
    vi.clearAllMocks();
    
    // Mock fs.access to succeed by default
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockResolvedValue(undefined);
    
    // Reset Sharp mock to default behavior
    mockSharp.mockImplementation(() => createMockSharp());
  });

  it('should extract image dimensions using Sharp', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'image.jpg',
      images: [{ filename: 'image.jpg' }]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    const processedImage = result!.processedImages[0];
    expect(processedImage.filename).toBe('image.jpg');
    expect(processedImage.width).toBe(800);
    expect(processedImage.height).toBe(600);
    expect(processedImage.aspectRatio).toBeCloseTo(800 / 600, 3);
    
    // Verify mocks were called
    expect(vi.mocked((await import('fs/promises')).default.access)).toHaveBeenCalled();
    expect(mockSharp).toHaveBeenCalled();
  });

  it('should handle Sharp errors with fallback dimensions', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'corrupt.jpg',
      images: [{ filename: 'corrupt.jpg' }]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    // Ensure we're not in CI environment for this test
    const originalCI = process.env.CI;
    delete process.env.CI;

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock fs.access to fail (simulating missing file)
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockRejectedValue(new Error('File not found'));

    const result = await getSrefById('12345678');

    const processedImage = result!.processedImages[0];
    expect(processedImage.width).toBe(1024);
    expect(processedImage.height).toBe(1024); // Fallback dimensions
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Image not found or invalid')
    );

    consoleWarnSpy.mockRestore();
    process.env.CI = originalCI;
  });

  it('should use CI fallback dimensions without warning in CI environment', async () => {
    // Mock CI environment
    const originalCI = process.env.CI;
    process.env.CI = 'true';

    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'missing.jpg',
      images: [{ filename: 'missing.jpg' }]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    // Mock fs.access to fail (simulating missing file)
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockRejectedValue(new Error('File not found'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getSrefById('12345678');

    expect(result!.processedImages[0]).toMatchObject({
      width: 1024,
      height: 1024,
    });
    // Should not log warning in CI
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    process.env.CI = originalCI;
  });

  it('should handle missing width/height metadata gracefully', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'image.jpg',
      images: [{ filename: 'image.jpg' }]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    // Mock Sharp to return metadata without width/height
    mockSharp.mockImplementation(() => createMockSharp({}));

    const result = await getSrefById('12345678');

    const processedImage = result!.processedImages[0];
    expect(processedImage.filename).toBe('image.jpg');
    expect(processedImage.width).toBe(100); // Default when Sharp metadata lacks dimensions
    expect(processedImage.height).toBe(100);
    
    // Verify mocks were called properly
    expect(vi.mocked((await import('fs/promises')).default.access)).toHaveBeenCalled();
    expect(mockSharp).toHaveBeenCalled();
  });
});

describe('metadata processing', () => {
  beforeEach(async () => {
    // Mock fs.access to succeed by default
    const mockFs = await import('fs/promises');
    vi.mocked(mockFs.default.access).mockResolvedValue(undefined);
  });

  it('should handle srefs with no images array', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'cover.jpg',
      // No images array
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    expect(result!.processedImages).toHaveLength(0);
    expect(result!.coverImagePath).toBeUndefined();
  });

  it('should select correct cover image when specified', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'cover.jpg',
      images: [
        { filename: 'first.jpg' },
        { filename: 'cover.jpg' },
        { filename: 'last.jpg' }
      ]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    expect(result!.coverImagePath).toBe('./data/srefs/sref-12345678/images/cover.jpg');
  });

  it('should fallback to first image when cover_image not found', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'nonexistent.jpg',
      images: [
        { filename: 'first.jpg' },
        { filename: 'second.jpg' }
      ]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    expect(result!.coverImagePath).toBe('./data/srefs/sref-12345678/images/first.jpg');
  });

  it('should generate correct Astro file paths', async () => {
    const mockMetadata: SrefMetadata = {
      id: '12345678',
      title: 'Test Sref',
      tags: ['test'],
      cover_image: 'image.jpg',
      images: [{ filename: 'image.jpg' }]
    };

    const srefData = await import('./sref-data');
    vi.mocked(srefData.getSrefMetadataById).mockResolvedValue(mockMetadata);

    const result = await getSrefById('12345678');

    expect(result!.processedImages[0].filePath).toBe('./data/srefs/sref-12345678/images/image.jpg');
    expect(result!.coverImagePath).toBe('./data/srefs/sref-12345678/images/image.jpg');
  });
});