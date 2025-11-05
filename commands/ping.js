const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Testinė komanda, parodanti boto ping laiką.'),
  async execute(interaction) {
    const start = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const elapsed = Date.now() - start;
    const heartbeat = interaction.client.ws.ping;

    await interaction.editReply(
      `🏓 Pong! Komandos apdorojimas: ${elapsed}ms, WebSocket ping: ${heartbeat}ms.`
    );
  },
};
