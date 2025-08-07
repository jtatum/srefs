import { Message, MessageContextMenuCommandInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { parseMidjourneyMessage } from '../utils/midjourneyParser.js';
import { createSrefFromMessage } from '../utils/srefCreator.js';

export async function handleMidjourneyMessage(
  message: Message, 
  interaction: MessageContextMenuCommandInteraction
) {
  try {
    const parsedMessage = parseMidjourneyMessage(message);
    
    console.log('=== PARSED MIDJOURNEY MESSAGE ===');
    console.log('Prompt:', parsedMessage.prompt);
    console.log('Job ID:', parsedMessage.jobId);
    console.log('Image URL:', parsedMessage.imageUrl);
    console.log('Dimensions:', `${parsedMessage.imageWidth}x${parsedMessage.imageHeight}`);
    console.log('Sref Value:', parsedMessage.srefValue || 'None');
    console.log('Message Type:', parsedMessage.messageType);
    console.log('=== END PARSED MESSAGE ===\n');

    const modal = new ModalBuilder()
      .setCustomId(`sref_modal_${message.id}`)
      .setTitle('Add to Sref Database');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(generateTitleFromPrompt(parsedMessage.prompt))
      .setMaxLength(100);

    const tagsInput = new TextInputBuilder()
      .setCustomId('tags')
      .setLabel('Tags (comma-separated)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(generateTagsFromPrompt(parsedMessage.prompt))
      .setMaxLength(200);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue(parsedMessage.prompt)
      .setMaxLength(500);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(tagsInput);
    const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    await interaction.showModal(modal);

    const modalFilter = (i: any) => i.customId === `sref_modal_${message.id}`;
    
    try {
      const modalInteraction = await interaction.awaitModalSubmit({ 
        filter: modalFilter, 
        time: 300000 
      });

      const title = modalInteraction.fields.getTextInputValue('title');
      const tags = modalInteraction.fields.getTextInputValue('tags').split(',').map(t => t.trim());
      const description = modalInteraction.fields.getTextInputValue('description') || undefined;

      await modalInteraction.deferReply({ ephemeral: true });

      const { srefId, srefPath } = await createSrefFromMessage(parsedMessage, title, tags, description);

      // Add reaction emoji to original message
      try {
        await message.react('✅');
      } catch (error) {
        console.error('Failed to add reaction to message:', error);
      }

      await modalInteraction.editReply({
        content: `✅ Successfully created sref!\n\n**ID:** ${srefId}\n**Title:** ${title}\n**Tags:** ${tags.join(', ')}\n**Path:** ${srefPath}\n\nRun \`npm run build\` to regenerate the site.`
      });

    } catch (error) {
      console.error('Modal submission timeout or error:', error);
      await interaction.followUp({ 
        content: 'Modal submission timed out. Please try again.', 
        ephemeral: true 
      });
    }

  } catch (error) {
    console.error('Error parsing Midjourney message:', error);
    await interaction.editReply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateTitleFromPrompt(prompt: string): string {
  const words = prompt.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3);
  
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function generateTagsFromPrompt(prompt: string): string {
  const commonTags = ['futurism', 'cyberpunk', 'architecture', 'piranesi', 'scifi', 'building', 'diagram', 'schematic'];
  const promptLower = prompt.toLowerCase();
  
  const foundTags = commonTags.filter(tag => promptLower.includes(tag));
  
  if (foundTags.length === 0) {
    foundTags.push('midjourney', 'art');
  }
  
  return foundTags.slice(0, 5).join(', ');
}