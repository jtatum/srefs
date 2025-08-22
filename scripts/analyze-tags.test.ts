import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SrefMetadata } from '../src/lib/types';

// Mock the getAllSrefMetadata function
vi.mock('../src/lib/sref-data', () => ({
  getAllSrefMetadata: vi.fn()
}));

import { analyzeTagsFromSrefs, printTagAnalysis, analyzeTags } from './analyze-tags';
import { getAllSrefMetadata } from '../src/lib/sref-data';

const mockGetAllSrefMetadata = vi.mocked(getAllSrefMetadata);

describe('analyze-tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSrefs: SrefMetadata[] = [
    {
      id: '123',
      title: 'Test 1',
      tags: ['illustration', 'anime', 'colorful'],
      cover_image: 'cover1.jpg',
      images: []
    },
    {
      id: '456', 
      title: 'Test 2',
      tags: ['illustration', 'portrait', 'realistic'],
      cover_image: 'cover2.jpg',
      images: []
    },
    {
      id: '789',
      title: 'Test 3', 
      tags: ['anime', 'manga', 'cute'],
      cover_image: 'cover3.jpg',
      images: []
    },
    {
      id: '999',
      title: 'Test 4',
      tags: ['illustration', 'portrait'],
      cover_image: 'cover4.jpg',
      images: []
    }
  ];

  describe('analyzeTagsFromSrefs', () => {
    it('should analyze tag usage and calculate statistics correctly', () => {
      const result = analyzeTagsFromSrefs(mockSrefs);

      expect(result.totalTags).toBe(7);
      expect(result.mostUsedTag.tag).toBe('illustration');
      expect(result.mostUsedTag.count).toBe(3);
      expect(result.singleUseTags).toBe(4); // colorful, realistic, manga, cute
      expect(result.lowUsageTags).toHaveLength(7); // All tags ≤3 uses
      expect(result.allTagStats).toHaveLength(7);

      // Verify specific tag counts
      const illustrationTag = result.allTagStats.find(stat => stat.tag === 'illustration');
      expect(illustrationTag?.count).toBe(3);
      expect(illustrationTag?.srefs).toEqual(['123', '456', '999']);
      
      const animeTag = result.allTagStats.find(stat => stat.tag === 'anime');
      expect(animeTag?.count).toBe(2);
      expect(animeTag?.srefs).toEqual(['123', '789']);

      const portraitTag = result.allTagStats.find(stat => stat.tag === 'portrait');
      expect(portraitTag?.count).toBe(2);
      expect(portraitTag?.srefs).toEqual(['456', '999']);
    });

    it('should handle empty sref list', () => {
      const result = analyzeTagsFromSrefs([]);

      expect(result.totalTags).toBe(0);
      expect(result.mostUsedTag).toEqual({ tag: '', count: 0, srefs: [] });
      expect(result.singleUseTags).toBe(0);
      expect(result.lowUsageTags).toHaveLength(0);
      expect(result.allTagStats).toHaveLength(0);
      expect(result.usageBuckets.size).toBe(0);
    });

    it('should handle srefs with no tags', () => {
      const srefsWithNoTags: SrefMetadata[] = [
        {
          id: '123',
          title: 'Test 1',
          tags: [],
          cover_image: 'cover1.jpg',
          images: []
        }
      ];

      const result = analyzeTagsFromSrefs(srefsWithNoTags);

      expect(result.totalTags).toBe(0);
      expect(result.mostUsedTag).toEqual({ tag: '', count: 0, srefs: [] });
      expect(result.singleUseTags).toBe(0);
      expect(result.lowUsageTags).toHaveLength(0);
      expect(result.allTagStats).toHaveLength(0);
    });

    it('should calculate usage buckets correctly', () => {
      const result = analyzeTagsFromSrefs(mockSrefs);

      // Expected: 4 tags with 1 use, 2 tags with 2 uses, 1 tag with 3 uses
      expect(result.usageBuckets.get(1)).toBe(4); // colorful, realistic, manga, cute
      expect(result.usageBuckets.get(2)).toBe(2); // anime, portrait
      expect(result.usageBuckets.get(3)).toBe(1); // illustration
    });

    it('should sort tags by count ascending', () => {
      const result = analyzeTagsFromSrefs(mockSrefs);

      // Tags should be sorted by count (ascending)
      const counts = result.allTagStats.map(stat => stat.count);
      expect(counts).toEqual([1, 1, 1, 1, 2, 2, 3]);
      
      // Most used should be last
      expect(result.allTagStats[result.allTagStats.length - 1].tag).toBe('illustration');
    });
  });

  describe('printTagAnalysis', () => {
    it('should print tag analysis correctly', () => {
      const result = analyzeTagsFromSrefs(mockSrefs);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printTagAnalysis(result, mockSrefs.length);

      expect(consoleSpy).toHaveBeenCalledWith('=== TAG USAGE ANALYSIS ===\n');
      expect(consoleSpy).toHaveBeenCalledWith('📊 Total unique tags: 7');
      expect(consoleSpy).toHaveBeenCalledWith('📈 Most used tag: "illustration" (3 times)');
      expect(consoleSpy).toHaveBeenCalledWith('📉 Least used tags: 4 tags used only once\n');
      expect(consoleSpy).toHaveBeenCalledWith('🔍 LOW USAGE TAGS (≤3 uses):');
      expect(consoleSpy).toHaveBeenCalledWith('📋 ALL TAG STATISTICS (sorted by usage):');
      expect(consoleSpy).toHaveBeenCalledWith('\n📈 USAGE DISTRIBUTION:');

      consoleSpy.mockRestore();
    });

    it('should handle empty results', () => {
      const result = analyzeTagsFromSrefs([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printTagAnalysis(result, 0);

      expect(consoleSpy).toHaveBeenCalledWith('=== TAG USAGE ANALYSIS ===\n');
      expect(consoleSpy).toHaveBeenCalledWith('📊 Total unique tags: 0');
      // Should not print most used tag info when no tags
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Most used tag:'));

      consoleSpy.mockRestore();
    });
  });

  describe('analyzeTags', () => {
    it('should handle errors from getAllSrefMetadata', async () => {
      const error = new Error('Failed to load data');
      mockGetAllSrefMetadata.mockRejectedValueOnce(error);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await analyzeTags();
      } catch (error) {
        expect((error as Error).message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('Loading all srefs...');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load sref data:', 'Failed to load data');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should analyze tags successfully', async () => {
      mockGetAllSrefMetadata.mockResolvedValueOnce(mockSrefs);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await analyzeTags();

      expect(consoleLogSpy).toHaveBeenCalledWith('Loading all srefs...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Found 4 srefs\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('=== TAG USAGE ANALYSIS ===\n');

      consoleLogSpy.mockRestore();
    });
  });
});