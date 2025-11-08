const { SlashCommandBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeDefer, safeReply, deleteReplySafe } = require('../utils/responses');
const { createEmbedFromMessage } = require('../utils/embeds');
const { getMessage } = require('../utils/messages');

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
    
    const pingMsg = getMessage('ping', 'response');
    const formattedMsg = pingMsg.replace('{elapsed}', elapsed).replace('{heartbeat}', heartbeat);
    const embed = createEmbedFromMessage(formattedMsg, 'info');
    await safeReply(interaction, { embeds: [embed] });

    // Taikome timeout iš config (veikia ir ephemeral, ir non-ephemeral)
    if (timeoutMs > 0) {
      setTimeout(() => { deleteReplySafe(interaction); }, timeoutMs);
    }
  },
};
