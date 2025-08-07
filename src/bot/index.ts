import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import { addToSrefCommand } from './commands/addToSref.js';

interface ExtendedClient extends Client {
  commands: Collection<string, any>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
}) as ExtendedClient;

client.commands = new Collection();

const commands = [
  addToSrefCommand.data.toJSON(),
];

client.commands.set(addToSrefCommand.data.name, addToSrefCommand);

client.once('ready', async () => {
  console.log(`Bot is ready! Logged in as ${client.user?.tag}`);
  
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_TOKEN) {
    console.error('Missing required environment variables: DISCORD_CLIENT_ID and DISCORD_TOKEN');
    process.exit(1);
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isContextMenuCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN environment variable is required');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);