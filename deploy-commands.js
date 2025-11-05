const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const config = require('./config.json');

const token = process.env.DISCORD_TOKEN || config.token;
const clientId = process.env.DISCORD_CLIENT_ID || config.clientId;
const guildId = process.env.DISCORD_GUILD_ID || config.guildId;

if (!token || token.startsWith('PAKEISKITE')) {
  console.error('❌ Trūksta boto tokeno. Papildykite .env failą arba config.json.');
  process.exit(1);
}

if (!clientId || clientId.startsWith('PAKEISKITE')) {
  console.error('❌ Trūksta programėlės (client) ID. Papildykite .env failą arba config.json.');
  process.exit(1);
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => entry.name);

const commands = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`⚠️ Komandos failas ${file} praleidžiamas dėl netinkamo eksporto.`);
  }
}

if (!commands.length) {
  console.warn('⚠️ Nerasta komandų registracijai. Įsitikinkite, kad aplanke "commands" yra .js failų.');
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    const isGuildTargeted = guildId && !guildId.startsWith('PAKEISKITE') && guildId.length > 0;
    const route = isGuildTargeted
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    if (!isGuildTargeted) {
      console.warn(
        'ℹ️ Nepateiktas GUILD_ID, komandos bus registruojamos globaliai. Tai gali užtrukti iki 1 valandos.'
      );
    }

    console.log(`🔄 Registruojamos ${commands.length} komandos...`);
    const data = await rest.put(route, { body: commands });

    console.log(`✅ Užregistruota komandų: ${Array.isArray(data) ? data.length : 'nežinoma'}.`);
  } catch (error) {
    console.error('❌ Klaida registruojant komandas:', error);
    process.exit(1);
  }
})();
