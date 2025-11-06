const { SlashCommandBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeDefer, safeReply, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Testinė komanda, parodanti boto ping laiką.'),
  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('ping');
    const start = Date.now();
    
    // Defer tik jei ephemeral, kad galėtume ištrinti po timeout
    if (ephemeral) {
      await safeDefer(interaction, { ephemeral: true });
    }
    
    const elapsed = Date.now() - start;
    const heartbeat = interaction.client.ws.ping;

    await safeReply(interaction, `🏓 Pong! Komandos apdorojimas: ${elapsed}ms, WebSocket ping: ${heartbeat}ms.`);

    // Taikome timeout iš config (veikia ir ephemeral, ir non-ephemeral)
    if (timeoutMs > 0) {
      setTimeout(() => { deleteReplySafe(interaction); }, timeoutMs);
    }
  },
};
