import { describe, it, expect } from 'vitest';
import { parseMidjourneyMessage } from './midjourneyParser.js';
import type { Message } from 'discord.js';

// Mock Discord Collection
class MockCollection extends Map {
  first() {
    return this.values().next().value;
  }
}

// Mock message factory
function createMockMessage(
  content: string,
  attachment: { url: string; width?: number; height?: number } | null,
  components: Array<{ customId: string; label?: string }[]> = []
): Partial<Message> {
  const mockComponents = components.map(row => ({
    components: row.map(comp => ({
      type: 2,
      customId: comp.customId,
      label: comp.label || null
    }))
  }));

  const attachments = new MockCollection();
  if (attachment) {
    attachments.set('123', {
      url: attachment.url,
      width: attachment.width || 1024,
      height: attachment.height || 1024,
      name: 'test.png',
      size: 1000000,
      contentType: 'image/png'
    } as any);
  }

  return {
    content,
    attachments: attachments as any,
    components: mockComponents as any
  };
}

describe('parseMidjourneyMessage', () => {
  it('should parse initial generation message', () => {
    const message = createMockMessage(
      '**giovanni battista piranesi building --sref 42** - <@250410386782814209> (relaxed, stealth)',
      { url: 'https://cdn.discord.com/image.png', width: 2048, height: 2048 },
      [[
        { customId: 'MJ::JOB::upsample::1::6ed08d10-79a0-40e0-89da-0acbeb05f8ce', label: 'U1' },
        { customId: 'MJ::JOB::upsample::2::6ed08d10-79a0-40e0-89da-0acbeb05f8ce', label: 'U2' }
      ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result).toEqual({
      prompt: 'giovanni battista piranesi building',
      jobId: '6ed08d10-79a0-40e0-89da-0acbeb05f8ce',
      imageUrl: 'https://cdn.discord.com/image.png',
      imageWidth: 2048,
      imageHeight: 2048,
      srefValue: '42',
      messageType: 'initial'
    });
  });

  it('should parse variation message', () => {
    const message = createMockMessage(
      '**<https://s.mj.run/hkzAhf7EO4Y> futurism Italo Ferro** - Variations (Strong) by <@479071738093764619> (relaxed)',
      { url: 'https://cdn.discord.com/variation.png', width: 2048, height: 2048 },
      [[
        { customId: 'MJ::JOB::variation::1::1ec542cb-5f2f-4a48-b390-179855b327da', label: 'V1' }
      ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result).toEqual({
      prompt: '<https://s.mj.run/hkzAhf7EO4Y> futurism Italo Ferro',
      jobId: '1ec542cb-5f2f-4a48-b390-179855b327da',
      imageUrl: 'https://cdn.discord.com/variation.png',
      imageWidth: 2048,
      imageHeight: 2048,
      srefValue: undefined,
      messageType: 'variation'
    });
  });

  it('should parse individual image message', () => {
    const message = createMockMessage(
      '**labeled cutaway schematic diagram of a pig monorail in the very futuristic internet cyberspace cyberpunk alien writing star wars at-at in the style of giovanni battista piranesi --sref 2067381016** - Image #3 <@250410386782814209>',
      { url: 'https://cdn.discord.com/individual.png', width: 1024, height: 1024 },
      [[
        { customId: 'MJ::JOB::upsample_v7_2x_subtle::1::6a563e03-5b34-46d0-9583-549fe0730e3e::SOLO', label: 'Upscale (Subtle)' }
      ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result).toEqual({
      prompt: 'labeled cutaway schematic diagram of a pig monorail in the very futuristic internet cyberspace cyberpunk alien writing star wars at-at in the style of giovanni battista piranesi',
      jobId: '6a563e03-5b34-46d0-9583-549fe0730e3e',
      imageUrl: 'https://cdn.discord.com/individual.png',
      imageWidth: 1024,
      imageHeight: 1024,
      srefValue: '2067381016',
      messageType: 'individual'
    });
  });

  it('should handle upscale message type', () => {
    const message = createMockMessage(
      '**test prompt** - Upscaled by <@user> (fast)',
      { url: 'https://cdn.discord.com/upscaled.png', width: 1024, height: 1024 },
      [[
        { customId: 'MJ::JOB::some_action::1::abc12345-1234-1234-1234-123456789abc::SOLO', label: 'Action' }
      ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result?.messageType).toBe('upscale');
  });

  it('should throw error when no attachment found', () => {
    const message = createMockMessage('**test prompt**', null);

    expect(() => parseMidjourneyMessage(message as Message))
      .toThrow('No attachment found in message');
  });

  it('should throw error when no prompt found', () => {
    const message = createMockMessage(
      'no prompt markers here',
      { url: 'https://cdn.discord.com/test.png' }
    );

    expect(() => parseMidjourneyMessage(message as Message))
      .toThrow('Could not extract prompt from message content');
  });

  it('should throw error when no job ID found', () => {
    const message = createMockMessage(
      '**test prompt**',
      { url: 'https://cdn.discord.com/test.png' },
      [[ { customId: 'INVALID::FORMAT', label: 'Button' } ]]
    );

    expect(() => parseMidjourneyMessage(message as Message))
      .toThrow('Could not extract job ID from message components');
  });

  it('should handle prompt without sref parameter', () => {
    const message = createMockMessage(
      '**simple prompt without sref**',
      { url: 'https://cdn.discord.com/test.png' },
      [[ { customId: 'MJ::JOB::action::1::12345678-1234-1234-1234-123456789abc', label: 'Action' } ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result?.srefValue).toBeUndefined();
    expect(result?.prompt).toBe('simple prompt without sref');
  });

  it('should clean sref parameter from prompt', () => {
    const message = createMockMessage(
      '**architectural building design --sref 123 with more details**',
      { url: 'https://cdn.discord.com/test.png' },
      [[ { customId: 'MJ::JOB::action::1::12345678-1234-1234-1234-123456789abc', label: 'Action' } ]]
    );

    const result = parseMidjourneyMessage(message as Message);

    expect(result?.srefValue).toBe('123');
    expect(result?.prompt).toBe('architectural building design with more details');
  });
});