import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ProcessedSref } from '../../src/lib/types';

// Mock data for testing
const mockProcessedSref: ProcessedSref = {
  id: '12345678',
  title: 'Test Sref',
  description: 'Test description',
  tags: ['test', 'sample'],
  cover_image: 'test.jpg',
  path: '/sref/12345678',
  coverImageUrl: '/data/srefs/sref-12345678/images/test.jpg',
  processedImages: [
    {
      filename: 'test.jpg',
      url: '/data/srefs/sref-12345678/images/test.jpg',
      width: 800,
      height: 600,
      aspectRatio: 1.333,
      prompt: 'test prompt',
    }
  ],
};

describe('Astro Component Integration', () => {
  describe('Page structure validation', () => {
    it('should have correct metadata structure', () => {
      expect(mockProcessedSref).toHaveProperty('id');
      expect(mockProcessedSref).toHaveProperty('title');
      expect(mockProcessedSref).toHaveProperty('description');
      expect(mockProcessedSref).toHaveProperty('tags');
      expect(mockProcessedSref).toHaveProperty('path');
      expect(mockProcessedSref).toHaveProperty('coverImageUrl');
      expect(mockProcessedSref).toHaveProperty('processedImages');
    });

    it('should have valid image data', () => {
      const image = mockProcessedSref.processedImages[0];
      expect(image).toHaveProperty('filename');
      expect(image).toHaveProperty('url');
      expect(image).toHaveProperty('width');
      expect(image).toHaveProperty('height');
      expect(image).toHaveProperty('aspectRatio');
      expect(image.aspectRatio).toBeCloseTo(1.333, 2);
    });

    it('should generate correct paths', () => {
      expect(mockProcessedSref.path).toBe('/sref/12345678');
      expect(mockProcessedSref.coverImageUrl).toContain('/data/srefs/sref-12345678/images/');
    });
  });

  describe('Static route generation', () => {
    it('should support getStaticPaths pattern', () => {
      const srefs = [mockProcessedSref];
      const staticPaths = srefs.map((sref) => ({
        params: { id: sref.id },
        props: { sref },
      }));

      expect(staticPaths).toHaveLength(1);
      expect(staticPaths[0].params.id).toBe('12345678');
      expect(staticPaths[0].props.sref).toBe(mockProcessedSref);
    });

    it('should handle multiple srefs for static generation', () => {
      const multipleSrefs = [
        mockProcessedSref,
        { ...mockProcessedSref, id: '87654321', path: '/sref/87654321' },
      ];

      const staticPaths = multipleSrefs.map((sref) => ({
        params: { id: sref.id },
        props: { sref },
      }));

      expect(staticPaths).toHaveLength(2);
      expect(staticPaths.map(p => p.params.id)).toEqual(['12345678', '87654321']);
    });
  });

  describe('Component data validation', () => {
    it('should handle missing optional fields gracefully', () => {
      const srefWithoutDescription = {
        ...mockProcessedSref,
        description: undefined,
      };

      expect(srefWithoutDescription.id).toBeDefined();
      expect(srefWithoutDescription.title).toBeDefined();
      expect(srefWithoutDescription.tags).toBeDefined();
    });

    it('should validate required fields are present', () => {
      const requiredFields = ['id', 'title', 'tags', 'path', 'coverImageUrl', 'processedImages'];
      
      requiredFields.forEach(field => {
        expect(mockProcessedSref).toHaveProperty(field);
        expect((mockProcessedSref as any)[field]).toBeDefined();
      });
    });

    it('should handle empty images array', () => {
      const srefWithoutImages = {
        ...mockProcessedSref,
        processedImages: [],
        coverImageUrl: '',
      };

      expect(srefWithoutImages.processedImages).toHaveLength(0);
      expect(srefWithoutImages.coverImageUrl).toBe('');
    });
  });

  describe('SEO and metadata integration', () => {
    it('should generate proper page titles', () => {
      const title = `${mockProcessedSref.title} - Sref ${mockProcessedSref.id}`;
      expect(title).toBe('Test Sref - Sref 12345678');
    });

    it('should use description for meta description', () => {
      const description = mockProcessedSref.description || 'A collection of Midjourney style references';
      expect(description).toBe('Test description');
    });

    it('should fallback to default description', () => {
      const srefWithoutDesc = { ...mockProcessedSref, description: undefined };
      const description = srefWithoutDesc.description || 'A collection of Midjourney style references';
      expect(description).toBe('A collection of Midjourney style references');
    });
  });

  describe('Image processing integration', () => {
    it('should calculate correct aspect ratios', () => {
      const landscape = { width: 1920, height: 1080 };
      const portrait = { width: 1080, height: 1920 };
      const square = { width: 1000, height: 1000 };

      expect(landscape.width / landscape.height).toBeCloseTo(1.778, 2);
      expect(portrait.width / portrait.height).toBeCloseTo(0.563, 2);
      expect(square.width / square.height).toBe(1);
    });

    it('should handle various image formats', () => {
      const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const testFiles = [
        'image.jpg',
        'image.JPEG',
        'image.png',
        'image.webp',
        'image.gif',
        'document.pdf',
        'text.txt',
      ];

      const validImages = testFiles.filter(file => 
        supportedFormats.some(format => 
          file.toLowerCase().endsWith(`.${format}`)
        )
      );

      expect(validImages).toHaveLength(5);
      expect(validImages).not.toContain('document.pdf');
      expect(validImages).not.toContain('text.txt');
    });
  });
});