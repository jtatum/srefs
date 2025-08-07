import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSrefFromMessage } from './srefCreator.js';
import type { ParsedMidjourneyMessage } from './midjourneyParser.js';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

// Mock dependencies
vi.mock('./imageDownloader.js', () => ({
  downloadImage: vi.fn(),
  ensureDirectoryExists: vi.fn()
}));

vi.mock('fs/promises');
vi.mock('js-yaml');

const mockFs = vi.mocked(fs);
const mockYaml = vi.mocked(yaml);

describe('createSrefFromMessage', () => {
  const mockParsedMessage: ParsedMidjourneyMessage = {
    prompt: 'futuristic city architecture',
    jobId: '12345678-1234-1234-1234-123456789abc',
    imageUrl: 'https://cdn.discord.com/test.png',
    imageWidth: 1024,
    imageHeight: 1024,
    srefValue: '42',
    messageType: 'individual'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Math.random to return predictable ID
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    
    // Mock yaml.dump
    mockYaml.dump.mockReturnValue('mocked-yaml-content');
    
    // Mock fs.writeFile
    mockFs.writeFile.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create sref with all metadata fields', async () => {
    const { downloadImage, ensureDirectoryExists } = await import('./imageDownloader.js');
    
    const result = await createSrefFromMessage(
      mockParsedMessage,
      'Futuristic City',
      ['architecture', 'futuristic', 'city'],
      'A beautiful futuristic city design'
    );

    expect(result.srefId).toHaveLength(8); // Should be 8 characters
    expect(result.srefPath).toMatch(/data\/srefs\/sref-[a-z0-9]{8}$/);

    expect(ensureDirectoryExists).toHaveBeenCalledWith(
      expect.stringMatching(/data\/srefs\/sref-[a-z0-9]{8}\/images$/)
    );

    expect(downloadImage).toHaveBeenCalledWith(
      'https://cdn.discord.com/test.png',
      expect.stringMatching(/data\/srefs\/sref-[a-z0-9]{8}\/images\/image\.png$/)
    );

    expect(mockYaml.dump).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[a-z0-9]{8}$/),
      title: 'Futuristic City',
      description: 'A beautiful futuristic city design',
      tags: ['architecture', 'futuristic', 'city'],
      cover_image: 'image.png',
      created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      images: [{
        filename: 'image.png',
        prompt: 'futuristic city architecture',
        width: 1024,
        height: 1024,
        aspectRatio: 1
      }]
    }, {
      defaultFlowStyle: false,
      quotingType: '"',
      forceQuotes: false
    });

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/data\/srefs\/sref-[a-z0-9]{8}\/meta\.yaml$/),
      'mocked-yaml-content',
      'utf-8'
    );
  });

  it('should create sref without optional description', async () => {
    await createSrefFromMessage(
      mockParsedMessage,
      'Test Title',
      ['tag1', 'tag2']
    );

    const yamlCall = mockYaml.dump.mock.calls[0][0];
    expect(yamlCall.description).toBeUndefined();
    expect(yamlCall.title).toBe('Test Title');
    expect(yamlCall.tags).toEqual(['tag1', 'tag2']);
  });

  it('should handle different image formats', async () => {
    const messageWithJpg = {
      ...mockParsedMessage,
      imageUrl: 'https://cdn.discord.com/test.jpg?v=1'
    };

    await createSrefFromMessage(
      messageWithJpg,
      'Test Title',
      ['test']
    );

    const { downloadImage } = await import('./imageDownloader.js');
    expect(downloadImage).toHaveBeenCalledWith(
      'https://cdn.discord.com/test.jpg?v=1',
      expect.stringContaining('image.jpg')
    );

    const yamlCall = mockYaml.dump.mock.calls[0][0];
    expect(yamlCall.cover_image).toBe('image.jpg');
    expect(yamlCall.images[0].filename).toBe('image.jpg');
  });

  it('should handle URLs without clear extension', async () => {
    const messageWithoutExt = {
      ...mockParsedMessage,
      imageUrl: 'https://cdn.discord.com/attachment/123456'
    };

    await createSrefFromMessage(
      messageWithoutExt,
      'Test Title',
      ['test']
    );

    const { downloadImage } = await import('./imageDownloader.js');
    expect(downloadImage).toHaveBeenCalledWith(
      'https://cdn.discord.com/attachment/123456',
      expect.stringContaining('image.png')
    );
  });

  it('should calculate correct aspect ratio', async () => {
    const wideMessage = {
      ...mockParsedMessage,
      imageWidth: 2048,
      imageHeight: 1024
    };

    await createSrefFromMessage(
      wideMessage,
      'Wide Image',
      ['wide']
    );

    const yamlCall = mockYaml.dump.mock.calls[0][0];
    expect(yamlCall.images[0].aspectRatio).toBe(2);
  });

  it('should generate unique IDs for multiple calls', async () => {
    // Clear the mock and restore original Math.random for this test
    vi.mocked(Math.random).mockRestore();
    
    const result1 = await createSrefFromMessage(mockParsedMessage, 'Title 1', ['test']);
    const result2 = await createSrefFromMessage(mockParsedMessage, 'Title 2', ['test']);

    expect(result1.srefId).toHaveLength(8);
    expect(result2.srefId).toHaveLength(8);
    expect(result1.srefId).not.toBe(result2.srefId);
  });

  it('should use current date for created field', async () => {
    const mockDate = new Date('2024-01-15T10:30:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

    await createSrefFromMessage(
      mockParsedMessage,
      'Test Title',
      ['test']
    );

    const yamlCall = mockYaml.dump.mock.calls[0][0];
    expect(yamlCall.created).toBe('2024-01-15');
  });
});