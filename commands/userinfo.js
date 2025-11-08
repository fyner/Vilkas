const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');
const { getMessage } = require('../utils/messages');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Rodo vartotojo informaciją.')
    .addUserOption(opt =>
      opt
        .setName('vartotojas')
        .setDescription('Pasirenkamas vartotojas; jei nenurodysi, rodys tave')
    ),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('userinfo');
    if (ephemeral) {
      await safeDefer(interaction, { ephemeral: true });
    }

    const user = interaction.options.getUser('vartotojas') || interaction.user;
    const member = interaction.guild ? interaction.guild.members.resolve(user.id) : null;

    const created = Math.floor(user.createdTimestamp / 1000);
    const joined = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    // Rolės (be @everyone), iki 10 trumpai
    const roles = member?.roles?.cache
      ? member.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position)
      : null;
    const topRole = roles && roles.first() ? roles.first() : null;
    const rolesList = roles && roles.size > 0
      ? (roles.first(10).map(r => `<@&${r.id}>`).join(', ') + (roles.size > 10 ? ` +${roles.size - 10} dar` : ''))
      : 'nėra';

    // Spalva gali būti hex string (pvz., "0x2b2d31") arba skaičius
    const colorValue = config?.embeds?.defaultColor;
    const defaultColor = colorValue ? (typeof colorValue === 'string' ? parseInt(colorValue, 16) : colorValue) : 0x2b2d31; // Fallback: Discord default color
    const embed = new EmbedBuilder()
      .setColor(topRole?.color || defaultColor)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Paskyra sukurta', value: `<t:${created}:F>\n<t:${created}:R>`, inline: true },
        { name: 'Ar botas', value: user.bot ? 'Taip' : 'Ne', inline: true },
      )
      .addFields(
        joined ? { name: 'Prisijungė prie serverio', value: `<t:${joined}:F>\n<t:${joined}:R>`, inline: true } : { name: '\u200b', value: '\u200b', inline: true },
        topRole ? { name: 'Aukščiausia rolė', value: `<@&${topRole.id}>`, inline: true } : { name: 'Aukščiausia rolė', value: 'nėra', inline: true },
        { name: 'Rolės', value: rolesList, inline: false },
      )
      .setFooter({ text: getMessage('userinfo', 'footer') })
      .setTimestamp(new Date());

    await safeReply(interaction, {
      embeds: [embed],
      ...(ephemeral ? { ephemeral: true } : {}),
      allowedMentions: { parse: [] },
    });

    if (timeoutMs > 0) {
      setTimeout(() => deleteReplySafe(interaction), timeoutMs);
    }
  },
};


