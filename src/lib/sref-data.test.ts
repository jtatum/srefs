import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { getSrefCount, getAllSrefMetadata, getSrefMetadataById } from './sref-data';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock yaml module
vi.mock('js-yaml');
const mockYaml = vi.mocked(yaml);

describe('sref-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSrefCount', () => {
    it('should count directories that start with "sref-"', async () => {
      mockFs.readdir.mockResolvedValue(['sref-123', 'sref-456', 'other-dir', 'sref-789'] as any);
      
      const count = await getSrefCount();
      
      expect(count).toBe(3);
    });

    it('should return 0 when directory read fails', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      const count = await getSrefCount();
      
      expect(count).toBe(0);
    });
  });

  describe('getAllSrefMetadata', () => {
    it('should load all sref metadata successfully', async () => {
      mockFs.readdir.mockResolvedValue(['sref-123', 'sref-456'] as any);
      mockFs.readFile
        .mockResolvedValueOnce('id: "123"\ntitle: "Test 1"\ntags: [test]\ncover_image: "cover.png"')
        .mockResolvedValueOnce('id: "456"\ntitle: "Test 2"\ntags: [test, demo]\ncover_image: "cover.jpg"');
      
      mockYaml.load
        .mockReturnValueOnce({ id: '123', title: 'Test 1', tags: ['test'], cover_image: 'cover.png', images: [] })
        .mockReturnValueOnce({ id: '456', title: 'Test 2', tags: ['test', 'demo'], cover_image: 'cover.jpg', images: [] });

      // Mock image directory reads for auto-discovery
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123', 'sref-456'] as any) // Initial directory read
        .mockResolvedValueOnce(['image1.png', 'image2.jpg'] as any) // First sref images
        .mockResolvedValueOnce(['cover.png'] as any); // Second sref images
      
      const srefs = await getAllSrefMetadata();
      
      expect(srefs).toHaveLength(2);
      expect(srefs[0]).toMatchObject({
        id: '123',
        title: 'Test 1',
        tags: ['test']
      });
      expect(srefs[1]).toMatchObject({
        id: '456',
        title: 'Test 2',
        tags: ['test', 'demo']
      });
    });

    it('should handle sref loading errors gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['sref-123', 'sref-456'] as any);
      mockFs.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('id: "456"\ntitle: "Test 2"\ntags: [test]\ncover_image: "cover.png"');
      
      mockYaml.load
        .mockReturnValueOnce({ id: '456', title: 'Test 2', tags: ['test'], cover_image: 'cover.png', images: [] });

      // Mock successful image directory read for the working sref
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123', 'sref-456'] as any) // Initial directory read
        .mockResolvedValueOnce(['image.png'] as any); // Second sref images
      
      const srefs = await getAllSrefMetadata();
      
      expect(srefs).toHaveLength(1);
      expect(srefs[0].id).toBe('456');
    });
  });

  describe('getSrefMetadataById', () => {
    it('should find and load sref by ID', async () => {
      // Mock directory listing to find matching sref
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123', 'sref-456'] as any) // Initial directory read
        .mockResolvedValueOnce(['image.png'] as any); // Image directory read
      
      mockFs.readFile.mockResolvedValue('id: "123"\ntitle: "Test"\ntags: [test]\ncover_image: "cover.png"');
      mockYaml.load.mockReturnValue({ id: '123', title: 'Test', tags: ['test'], cover_image: 'cover.png', images: [] });
      
      const sref = await getSrefMetadataById('123');
      
      expect(sref).toMatchObject({
        id: '123',
        title: 'Test',
        tags: ['test']
      });
    });

    it('should return null when sref not found', async () => {
      mockFs.readdir.mockResolvedValue(['sref-456', 'sref-789'] as any);
      
      const sref = await getSrefMetadataById('123');
      
      expect(sref).toBeNull();
    });
  });
});