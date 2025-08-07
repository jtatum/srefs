import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { handleMidjourneyMessage } from '../handlers/midjourneyHandler.js';

export const addToSrefCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Add to Sref Database')
    .setType(ApplicationCommandType.Message),
    
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const targetMessage = interaction.targetMessage;
    
    if (!targetMessage) {
      await interaction.reply({ content: 'Could not access the target message.', ephemeral: true });
      return;
    }

    if (targetMessage.author.username !== 'Midjourney Bot') {
      await interaction.reply({ 
        content: 'This command is only for Midjourney Bot messages.', 
        ephemeral: true 
      });
      return;
    }

    try {
      await handleMidjourneyMessage(targetMessage, interaction);
    } catch (error) {
      console.error('Error processing Midjourney message:', error);
      await interaction.reply({ 
        content: 'Failed to process the Midjourney message. Please try again.',
        ephemeral: true 
      });
    }
  },
};