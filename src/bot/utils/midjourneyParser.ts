import { Message } from 'discord.js';

export interface ParsedMidjourneyMessage {
  prompt: string;
  jobId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  srefValue?: string;
  messageType: 'initial' | 'variation' | 'upscale' | 'individual';
}

export function parseMidjourneyMessage(message: Message): ParsedMidjourneyMessage | null {
  const content = message.content;
  const attachment = message.attachments.first();
  
  if (!attachment) {
    throw new Error('No attachment found in message');
  }

  const promptMatch = content.match(/\*\*(.*?)\*\*/);
  if (!promptMatch) {
    throw new Error('Could not extract prompt from message content');
  }

  let prompt = promptMatch[1];
  const srefMatch = prompt.match(/--sref\s+(\d+)/);
  const srefValue = srefMatch ? srefMatch[1] : undefined;
  
  if (srefMatch) {
    prompt = prompt.replace(/--sref\s+\d+\s*/, '').trim();
  }

  const jobId = extractJobId(message);
  if (!jobId) {
    throw new Error('Could not extract job ID from message components');
  }

  const messageType = determineMessageType(content, attachment.width || 0, attachment.height || 0);

  return {
    prompt: prompt.trim(),
    jobId,
    imageUrl: attachment.url,
    imageWidth: attachment.width || 0,
    imageHeight: attachment.height || 0,
    srefValue,
    messageType
  };
}

function extractJobId(message: Message): string | null {
  for (const row of message.components) {
    for (const component of row.components) {
      if ('customId' in component && component.customId) {
        const match = component.customId.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
        if (match) {
          return match[1];
        }
      }
    }
  }
  return null;
}

function determineMessageType(content: string, width: number, height: number): ParsedMidjourneyMessage['messageType'] {
  if (content.includes('Variations')) {
    return 'variation';
  } else if (content.includes('Image #')) {
    return 'individual';
  } else if (width === 2048 && height === 2048) {
    return 'initial';
  } else if (width === 1024 && height === 1024) {
    return 'upscale';
  }
  return 'individual';
}