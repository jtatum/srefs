import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMidjourneyMessage } from './midjourneyHandler.js';

// Mock dependencies
vi.mock('../utils/midjourneyParser.js', () => ({
  parseMidjourneyMessage: vi.fn()
}));

vi.mock('../utils/srefCreator.js', () => ({
  createSrefFromMessage: vi.fn()
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn()
  }
}));

// Mock Discord.js components
const mockModalInteraction = {
  fields: {
    getTextInputValue: vi.fn()
  },
  deferReply: vi.fn(),
  editReply: vi.fn()
};

const mockInteraction = {
  showModal: vi.fn(),
  awaitModalSubmit: vi.fn(),
  editReply: vi.fn(),
  followUp: vi.fn(),
  deferReply: vi.fn()
};

const mockMessage = {
  id: '123456789',
  react: vi.fn()
};

describe('midjourneyHandler', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Default mock: sref doesn't exist (for new sref tests)
    const fs = await import('fs/promises');
    vi.mocked(fs.default.access).mockRejectedValue(new Error('ENOENT: no such file or directory'));
  });

  describe('handleMidjourneyMessage', () => {
    it('should show modal with parsed message data', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      
      vi.mocked(parseMidjourneyMessage).mockReturnValue({
        prompt: 'futuristic city architecture',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        srefValue: '42',
        messageType: 'individual'
      });

      // Mock modal timeout (no submission)
      vi.mocked(mockInteraction.awaitModalSubmit).mockRejectedValue(
        new Error('Modal timeout')
      );

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(parseMidjourneyMessage).toHaveBeenCalledWith(mockMessage);
      expect(mockInteraction.showModal).toHaveBeenCalled();
      
      // Verify modal was configured correctly
      const showModalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
      expect(showModalCall.data.custom_id).toBe('sref_modal_123456789');
      expect(showModalCall.data.title).toBe('Add to Sref Database');
    });

    it('should handle successful modal submission and sref creation', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      const { createSrefFromMessage } = await import('../utils/srefCreator.js');
      
      const mockParsedMessage = {
        prompt: 'architectural building design',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 2048,
        imageHeight: 2048,
        srefValue: undefined,
        messageType: 'initial' as const
      };

      vi.mocked(parseMidjourneyMessage).mockReturnValue(mockParsedMessage);
      
      // Mock successful modal submission
      vi.mocked(mockInteraction.awaitModalSubmit).mockResolvedValue(mockModalInteraction as any);
      vi.mocked(mockModalInteraction.fields.getTextInputValue)
        .mockReturnValueOnce('Architectural Design')  // title
        .mockReturnValueOnce('architecture, building, design')  // tags
        .mockReturnValueOnce('Beautiful architectural design');  // description

      // Mock successful sref creation
      vi.mocked(createSrefFromMessage).mockResolvedValue({
        srefId: 'abc12345',
        srefPath: '/public/data/srefs/sref-abc12345',
        isNewSref: true
      });

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(createSrefFromMessage).toHaveBeenCalledWith(
        mockParsedMessage,
        'Architectural Design',
        ['architecture', 'building', 'design'],
        'Beautiful architectural design'
      );

      expect(mockMessage.react).toHaveBeenCalledWith('✅');
      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('✅ Successfully created sref!')
      });
    });

    it('should handle modal submission without description', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      const { createSrefFromMessage } = await import('../utils/srefCreator.js');
      
      const mockParsedMessage = {
        prompt: 'simple prompt',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        messageType: 'upscale' as const
      };

      vi.mocked(parseMidjourneyMessage).mockReturnValue(mockParsedMessage);
      vi.mocked(mockInteraction.awaitModalSubmit).mockResolvedValue(mockModalInteraction as any);
      
      vi.mocked(mockModalInteraction.fields.getTextInputValue)
        .mockReturnValueOnce('Test Title')  // title
        .mockReturnValueOnce('test, simple')  // tags
        .mockReturnValueOnce('');  // empty description

      vi.mocked(createSrefFromMessage).mockResolvedValue({
        srefId: 'test123',
        srefPath: '/public/data/srefs/sref-test123',
        isNewSref: true
      });

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(createSrefFromMessage).toHaveBeenCalledWith(
        mockParsedMessage,
        'Test Title',
        ['test', 'simple'],
        undefined  // undefined for empty description
      );
    });

    it('should handle adding image to existing sref without modal', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      const { createSrefFromMessage } = await import('../utils/srefCreator.js');
      const fs = await import('fs/promises');
      
      const mockParsedMessage = {
        prompt: 'new architectural style',
        jobId: '87654321-4321-4321-4321-210987654321',
        imageUrl: 'https://cdn.discord.com/new-test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        srefValue: 'existing123',
        messageType: 'variation' as const
      };

      vi.mocked(parseMidjourneyMessage).mockReturnValue(mockParsedMessage);
      
      // Mock fs.access to return success (sref exists)
      vi.mocked(fs.default.access).mockResolvedValue();

      // Mock adding to existing sref
      vi.mocked(createSrefFromMessage).mockResolvedValue({
        srefId: 'existing123',
        srefPath: '/public/data/srefs/sref-existing123',
        isNewSref: false
      });

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      // Should NOT show modal for existing sref
      expect(mockInteraction.showModal).not.toHaveBeenCalled();
      expect(mockInteraction.awaitModalSubmit).not.toHaveBeenCalled();

      // Should defer reply immediately
      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });

      // Should create sref with empty values (ignored for existing sref)
      expect(createSrefFromMessage).toHaveBeenCalledWith(
        mockParsedMessage,
        '', // Empty title
        [], // Empty tags
        undefined // No description
      );

      expect(mockMessage.react).toHaveBeenCalledWith('✅');
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('📸 Successfully updated sref **existing123**!')
      });
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('*Added new image to existing sref*')
      });
    });

    it('should handle parsing errors', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      
      vi.mocked(parseMidjourneyMessage).mockImplementation(() => {
        throw new Error('Could not extract prompt from message content');
      });

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        '❌ Error: Could not extract prompt from message content'
      );
      expect(mockInteraction.showModal).not.toHaveBeenCalled();
    });

    it('should handle sref creation errors', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      const { createSrefFromMessage } = await import('../utils/srefCreator.js');
      
      vi.mocked(parseMidjourneyMessage).mockReturnValue({
        prompt: 'test prompt',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        messageType: 'individual' as const
      });

      vi.mocked(mockInteraction.awaitModalSubmit).mockResolvedValue(mockModalInteraction as any);
      vi.mocked(mockModalInteraction.fields.getTextInputValue)
        .mockReturnValueOnce('Test Title')
        .mockReturnValueOnce('test')
        .mockReturnValueOnce('description');

      // Mock sref creation failure
      vi.mocked(createSrefFromMessage).mockRejectedValue(
        new Error('Failed to download image: Not Found')
      );

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(mockMessage.react).not.toHaveBeenCalled();
      // Error should be logged to console but interaction should still get a response
    });

    it('should handle modal timeout', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      
      vi.mocked(parseMidjourneyMessage).mockReturnValue({
        prompt: 'test prompt',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        messageType: 'variation' as const
      });

      vi.mocked(mockInteraction.awaitModalSubmit).mockRejectedValue(
        new Error('Modal submission timeout')
      );

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: 'Modal submission timed out. Please try again.',
        ephemeral: true
      });
    });

    it('should handle message reaction failures gracefully', async () => {
      const { parseMidjourneyMessage } = await import('../utils/midjourneyParser.js');
      const { createSrefFromMessage } = await import('../utils/srefCreator.js');
      
      vi.mocked(parseMidjourneyMessage).mockReturnValue({
        prompt: 'test prompt',
        jobId: '12345678-1234-1234-1234-123456789abc',
        imageUrl: 'https://cdn.discord.com/test.png',
        imageWidth: 1024,
        imageHeight: 1024,
        messageType: 'individual' as const
      });

      vi.mocked(mockInteraction.awaitModalSubmit).mockResolvedValue(mockModalInteraction as any);
      vi.mocked(mockModalInteraction.fields.getTextInputValue)
        .mockReturnValueOnce('Test Title')
        .mockReturnValueOnce('test')
        .mockReturnValueOnce('');

      vi.mocked(createSrefFromMessage).mockResolvedValue({
        srefId: 'test123',
        srefPath: '/public/data/srefs/sref-test123',
        isNewSref: true
      });

      // Mock reaction failure
      vi.mocked(mockMessage.react).mockRejectedValue(
        new Error('Missing permissions')
      );

      await handleMidjourneyMessage(mockMessage as any, mockInteraction as any);

      // Should still complete successfully despite reaction failure
      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('✅ Successfully created sref!')
      });
    });
  });

});