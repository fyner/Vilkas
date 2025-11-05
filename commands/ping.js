const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeDefer, safeReply, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Testinė komanda, parodanti boto ping laiką.'),
  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('ping');
    const start = Date.now();
    await safeDefer(interaction, ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
    const elapsed = Date.now() - start;
    const heartbeat = interaction.client.ws.ping;

    await safeReply(interaction, `🏓 Pong! Komandos apdorojimas: ${elapsed}ms, WebSocket ping: ${heartbeat}ms.`);

    if (!ephemeral && timeoutMs > 0) {
      setTimeout(() => { deleteReplySafe(interaction); }, timeoutMs);
    }
  },
};
