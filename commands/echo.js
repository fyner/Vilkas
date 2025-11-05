const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Pakartoti pateiktą tekstą, skirta testuojant atsakymus.')
    .addStringOption((option) =>
      option
        .setName('zinute')
        .setDescription('Tekstas, kurį norite, kad botas pakartotų.')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('ephemeral')
        .setDescription('Pasirinkite "true", jei atsakymas turi būti matomas tik jums.')
    ),
  async execute(interaction) {
    const message = interaction.options.getString('zinute');
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

    await interaction.reply({
      content: `🔁 ${message}`,
      ephemeral,
    });
  },
};
