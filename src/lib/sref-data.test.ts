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
    // Clear console spies to avoid interference between tests
    vi.restoreAllMocks();
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

    it('should return null and log error when directory read fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      const sref = await getSrefMetadataById('123');
      
      expect(sref).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should return null and log error when metadata loading fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockFs.readdir.mockResolvedValue(['sref-123'] as any);
      mockFs.readFile.mockRejectedValue(new Error('File corrupted'));
      
      const sref = await getSrefMetadataById('123');
      expect(sref).toBeNull();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('autoDiscoverImages error handling', () => {
    it('should return empty array when images directory does not exist', async () => {
      // Test lines 73-74 - error handling in autoDiscoverImages when directory read fails
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123'] as any) // Initial directory read
        .mockRejectedValueOnce(new Error('ENOENT: no such file or directory')); // Images directory read fails
      
      mockFs.readFile.mockResolvedValue('id: "123"\ntitle: "Test"\ntags: [test]\ncover_image: "cover.png"');
      mockYaml.load.mockReturnValue({ 
        id: '123', 
        title: 'Test', 
        tags: ['test'], 
        cover_image: 'cover.png' 
        // No images array - should trigger auto-discovery
      });
      
      const sref = await getSrefMetadataById('123');
      
      expect(sref).not.toBeNull();
      expect(sref!.images).toEqual([]); // Should return empty array when directory read fails
    });

    it('should handle permission errors during image discovery', async () => {
      // Test lines 73-74 - error handling in autoDiscoverImages with different error types
      mockFs.readdir
        .mockResolvedValueOnce(['sref-123'] as any) // Initial directory read
        .mockRejectedValueOnce(new Error('EACCES: permission denied')); // Images directory read fails
      
      mockFs.readFile.mockResolvedValue('id: "123"\ntitle: "Test"\ntags: [test]\ncover_image: "cover.png"');
      mockYaml.load.mockReturnValue({ 
        id: '123', 
        title: 'Test', 
        tags: ['test'], 
        cover_image: 'cover.png',
        images: [] // Empty images array should also trigger auto-discovery
      });
      
      const sref = await getSrefMetadataById('123');
      
      expect(sref).not.toBeNull();
      expect(sref!.images).toEqual([]); // Should gracefully handle permission errors
    });
  });

  describe('metadata validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate metadata and handle errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Test case: Invalid metadata missing required fields
      // When getSrefMetadataById tries to load metadata, validation errors should be caught and return null
      mockFs.readdir.mockResolvedValueOnce(['sref-123'] as any);
      mockFs.readFile.mockResolvedValueOnce('invalid: "data"');
      mockYaml.load.mockReturnValueOnce({ invalid: 'data' }); // Missing required fields
      
      const sref = await getSrefMetadataById('123');
      expect(sref).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error finding sref 123:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });
});