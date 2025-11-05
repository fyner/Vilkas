const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Paprasta testinė komanda, patvirtinanti, kad botas reaguoja.'),
  async execute(interaction) {
    await interaction.reply({
      content: '✅ Testinė komanda veikia puikiai! Jei matai šį pranešimą, botas pasirengęs.',
      ephemeral: true,
    });
  },
};
