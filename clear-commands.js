const { REST, Routes } = require('discord.js');
const { getConsoleMessage } = require('./utils/messages');
require('dotenv').config();

let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error(getConsoleMessage('configLoadError'));
  process.exit(1);
}

const token = process.env.DISCORD_TOKEN || config.token;
const clientId = process.env.DISCORD_CLIENT_ID || config.clientId;
const guildId = process.env.DISCORD_GUILD_ID || config.guildId;

if (!token || token.startsWith('PAKEISKITE')) {
  console.error(getConsoleMessage('tokenMissing'));
  process.exit(1);
}

if (!clientId || clientId.startsWith('PAKEISKITE')) {
  console.error(getConsoleMessage('clientIdMissing'));
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(getConsoleMessage('clearCommandsStart'));

    // Išvalyti globalias komandas
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log(getConsoleMessage('clearCommandsGlobalSuccess'));
    } catch (error) {
      console.warn(getConsoleMessage('clearCommandsGlobalError'), error.message);
    }

    // Išvalyti gildijos komandas (jei nurodytas guildId)
    if (guildId && !guildId.startsWith('PAKEISKITE') && guildId.length > 0) {
      try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(getConsoleMessage('clearCommandsGuildSuccess').replace('{guildId}', guildId));
      } catch (error) {
        console.warn(getConsoleMessage('clearCommandsGuildError'), error.message);
      }
    }

    console.log(getConsoleMessage('clearCommandsComplete'));
  } catch (error) {
    console.error(getConsoleMessage('clearCommandsError'), error);
    process.exit(1);
  }
})();

