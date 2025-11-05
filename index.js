const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
require('dotenv').config();

const config = require('./config.json');

const token = process.env.DISCORD_TOKEN || config.token;

if (!token || token.startsWith('PAKEISKITE')) {
  console.error('❌ Nenurodytas Discord boto tokenas. Atnaujinkite .env arba config.json.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => entry.name);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Įkelta komanda: ${command.data.name}`);
  } else {
    console.warn(`⚠️ Komandos faile ${file} trūksta būtino "data" arba "execute" eksporto.`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Prisijungta kaip ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`❔ Komanda ${interaction.commandName} nerasta.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`💥 Klaida vykdant komandą ${interaction.commandName}:`, error);

    // Saugus atsakymas klaidos atveju: necrash'inti, jei webhook/žinutė jau nebegaliojanti
    try {
      if (interaction.replied) {
        await interaction.followUp({
          content: 'Įvyko klaida vykdant komandą. Bandykite dar kartą vėliau.',
          flags: MessageFlags.Ephemeral,
        });
      } else if (interaction.deferred) {
        // Jei „deferred“, bandome užbaigti su editReply
        await interaction.editReply({
          content: 'Įvyko klaida vykdant komandą. Bandykite dar kartą vėliau.',
        });
      } else {
        await interaction.reply({
          content: 'Įvyko klaida vykdant komandą. Bandykite dar kartą vėliau.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (respondError) {
      // Nutylime žinomus atvejus (pvz., Unknown Message, pasibaigęs interaction token)
      console.warn('Nepavyko išsiųsti klaidos atsakymo:', respondError?.code || respondError?.message || respondError);
    }
  }
});

client.login(token);
