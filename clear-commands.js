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

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 Išvalau visas komandas...');

    // Išvalyti globalias komandas
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('✅ Išvalytos globalios komandos.');
    } catch (error) {
      console.warn('⚠️ Nepavyko išvalyti globalių komandų:', error.message);
    }

    // Išvalyti gildijos komandas (jei nurodytas guildId)
    if (guildId && !guildId.startsWith('PAKEISKITE') && guildId.length > 0) {
      try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(`✅ Išvalytos gildijos komandos (${guildId}).`);
      } catch (error) {
        console.warn('⚠️ Nepavyko išvalyti gildijos komandų:', error.message);
      }
    }

    console.log('✅ Visos komandos išvalytos. Dabar paleiskite "npm run deploy:commands" kad vėl užregistruotumėte komandas.');
  } catch (error) {
    console.error('❌ Klaida išvalant komandas:', error);
    process.exit(1);
  }
})();

