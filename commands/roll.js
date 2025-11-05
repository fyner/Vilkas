const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Mesti kauliuką testavimui.')
    .addIntegerOption((option) =>
      option
        .setName('kryptis')
        .setDescription('Kauliuko kraštinių skaičius (pvz., 6).')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100)
    ),
  async execute(interaction) {
    const sides = interaction.options.getInteger('kryptis') ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;

    await interaction.reply({
      content: `🎲 Mestas d${sides}: iškrito **${result}**!`,
      ephemeral: false,
    });
  },
};
