import { describe, it, expect, beforeEach, vi } from 'vitest';
import { downloadImage, ensureDirectoryExists } from './imageDownloader.js';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
global.fetch = vi.fn();

const mockFs = vi.mocked(fs);
const mockFetch = vi.mocked(fetch);

describe('imageDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('downloadImage', () => {
    it('should download and save image successfully', async () => {
      const mockImageData = new ArrayBuffer(1000);
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData)
      };
      
      mockFetch.mockResolvedValue(mockResponse as any);
      mockFs.writeFile.mockResolvedValue();

      await downloadImage('https://example.com/image.png', '/path/to/save/image.png');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.png');
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/save/image.png',
        Buffer.from(mockImageData)
      );
    });

    it('should throw error when fetch fails', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found'
      };
      
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(downloadImage('https://example.com/nonexistent.png', '/path/to/save.png'))
        .rejects.toThrow('Failed to download image: Not Found');

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(downloadImage('https://example.com/image.png', '/path/to/save.png'))
        .rejects.toThrow('Network error');

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file write errors', async () => {
      const mockImageData = new ArrayBuffer(1000);
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData)
      };
      
      mockFetch.mockResolvedValue(mockResponse as any);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(downloadImage('https://example.com/image.png', '/path/to/save.png'))
        .rejects.toThrow('Permission denied');

      expect(mockFetch).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle different response status codes', async () => {
      const testCases = [
        { status: 404, statusText: 'Not Found' },
        { status: 403, statusText: 'Forbidden' },
        { status: 500, statusText: 'Internal Server Error' }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValue({
          ok: false,
          statusText: testCase.statusText
        } as any);

        await expect(downloadImage('https://example.com/image.png', '/path/to/save.png'))
          .rejects.toThrow(`Failed to download image: ${testCase.statusText}`);
      }
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it already exists', async () => {
      mockFs.access.mockResolvedValue();

      await ensureDirectoryExists('/existing/directory');

      expect(mockFs.access).toHaveBeenCalledWith('/existing/directory');
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue();

      await ensureDirectoryExists('/new/directory');

      expect(mockFs.access).toHaveBeenCalledWith('/new/directory');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/new/directory', { recursive: true });
    });

    it('should handle mkdir errors', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(ensureDirectoryExists('/protected/directory'))
        .rejects.toThrow('Permission denied');

      expect(mockFs.access).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('should create nested directories recursively', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue();

      await ensureDirectoryExists('/very/deeply/nested/directory/structure');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/very/deeply/nested/directory/structure',
        { recursive: true }
      );
    });

    it('should handle access check errors other than non-existence', async () => {
      mockFs.access.mockRejectedValue(new Error('Permission denied'));
      mockFs.mkdir.mockResolvedValue();

      // Should still try to create directory even if access check fails
      await ensureDirectoryExists('/permission/test');

      expect(mockFs.access).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalledWith('/permission/test', { recursive: true });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete download workflow', async () => {
      // Setup: Directory doesn't exist, fetch succeeds
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue();
      
      const mockImageData = new ArrayBuffer(2048);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData)
      } as any);
      
      mockFs.writeFile.mockResolvedValue();

      // Simulate creating directory and downloading image
      await ensureDirectoryExists('/path/to/images');
      await downloadImage('https://cdn.discord.com/image.png', '/path/to/images/image.png');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/path/to/images', { recursive: true });
      expect(mockFetch).toHaveBeenCalledWith('https://cdn.discord.com/image.png');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/images/image.png',
        Buffer.from(mockImageData)
      );
    });
  });
});