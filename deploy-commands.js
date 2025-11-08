const fs = require('node:fs');
const path = require('node:path');
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
    console.warn(getConsoleMessage('deployCommandsFileSkipped').replace('{file}', file));
  }
}

if (!commands.length) {
  console.warn(getConsoleMessage('deployCommandsNoCommands'));
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    const isGuildTargeted = guildId && !guildId.startsWith('PAKEISKITE') && guildId.length > 0;
    const guildRoute = isGuildTargeted ? Routes.applicationGuildCommands(clientId, guildId) : null;
    const globalRoute = Routes.applicationCommands(clientId);

    if (isGuildTargeted) {
      console.log(getConsoleMessage('deployCommandsGuildStart').replace('{count}', commands.length).replace('{guildId}', guildId));
      await rest.put(guildRoute, { body: commands });
      console.log(getConsoleMessage('deployCommandsGuildSuccess'));
    } else {
      console.log(getConsoleMessage('deployCommandsGlobalStart').replace('{count}', commands.length));
      await rest.put(globalRoute, { body: commands });
      console.log(getConsoleMessage('deployCommandsGlobalSuccess'));
    }
  } catch (error) {
    console.error(getConsoleMessage('deployCommandsError'), error);
    process.exit(1);
  }
})();
