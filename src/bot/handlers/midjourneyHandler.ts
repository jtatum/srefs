import { Message, MessageContextMenuCommandInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { parseMidjourneyMessage } from '../utils/midjourneyParser.js';
import { createSrefFromMessage } from '../utils/srefCreator.js';
import fs from 'fs/promises';
import path from 'path';

async function checkSrefExists(srefId: string): Promise<boolean> {
  const srefDirName = `sref-${srefId}`;
  const metaPath = path.join(process.cwd(), 'src', 'data', 'srefs', srefDirName, 'meta.yaml');
  
  try {
    await fs.access(metaPath);
    return true;
  } catch {
    return false;
  }
}

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

    // Check if this is adding to an existing sref
    const srefId = parsedMessage.srefValue;
    const isExistingSref = srefId && await checkSrefExists(srefId);

    if (isExistingSref) {
      // Skip modal for existing srefs - add image directly
      await interaction.deferReply({ ephemeral: true });

      const { srefId: resultSrefId, srefPath, isNewSref } = await createSrefFromMessage(
        parsedMessage, 
        '', // Empty title - will be ignored for existing sref
        [], // Empty tags - will be ignored for existing sref  
        undefined // No description - will be ignored for existing sref
      );

      // Add reaction emoji to original message
      try {
        await message.react('✅');
      } catch (error) {
        console.error('Failed to add reaction to message:', error);
      }

      await interaction.editReply({
        content: `📸 Successfully updated sref **${resultSrefId}**!\n\n**Path:** ${srefPath}\n*Added new image to existing sref*\n\nRun \`npm run build\` to regenerate the site.`
      });

      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`sref_modal_${message.id}`)
      .setTitle('Add to Sref Database');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter a title for this sref...')
      .setMaxLength(100);

    const tagsInput = new TextInputBuilder()
      .setCustomId('tags')
      .setLabel('Tags (comma-separated)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('architecture, futuristic, cyberpunk')
      .setMaxLength(200);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder('Optional description or notes...')
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
      const tags = modalInteraction.fields.getTextInputValue('tags')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0); // Remove empty tags
      const description = modalInteraction.fields.getTextInputValue('description') || undefined;

      await modalInteraction.deferReply({ ephemeral: true });

      const { srefId, srefPath, isNewSref } = await createSrefFromMessage(parsedMessage, title, tags, description);

      // Add reaction emoji to original message
      try {
        await message.react('✅');
      } catch (error) {
        console.error('Failed to add reaction to message:', error);
      }

      const action = isNewSref ? 'created' : 'updated';
      const actionIcon = isNewSref ? '✅' : '📸';
      
      await modalInteraction.editReply({
        content: `${actionIcon} Successfully ${action} sref!\n\n**ID:** ${srefId}\n**Title:** ${title}\n**Tags:** ${tags.join(', ')}\n**Path:** ${srefPath}\n${isNewSref ? '' : '\n*Added new image to existing sref*'}\n\nRun \`npm run build\` to regenerate the site.`
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
