const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ChannelType } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Rodo šio serverio pagrindinę informaciją.'),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('serverinfo');

    // Defer jei ephemeral, kad neprarastume atsakymo laiko
    if (ephemeral) {
      await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    }

    const guild = interaction.guild;
    if (!guild) {
      await safeReply(interaction, { content: 'Ši komanda veikia tik gildijose.' });
      return;
    }

    const created = Math.floor(guild.createdTimestamp / 1000);

    // Kanalų statistika
    const channels = guild.channels.cache;
    const textCount = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const threadCount = channels.filter(c => c.isThread?.()).size;
    const categoryCount = channels.filter(c => c.type === ChannelType.GuildCategory).size;

    const rolesCount = guild.roles.cache.size;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL({ size: 128 }) ?? undefined })
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Nariai', value: String(guild.memberCount ?? 'n/d'), inline: true },
        { name: 'Sukurta', value: `<t:${created}:F>\n<t:${created}:R>`, inline: true },
      )
      .addFields(
        { name: 'Kanalai', value: `Tekstiniai: ${textCount}\nBalsiniai: ${voiceCount}\nGijos: ${threadCount}\nKategorijos: ${categoryCount}`, inline: true },
        { name: 'Rolės', value: String(rolesCount), inline: true },
        guild.ownerId ? { name: 'Savininkas', value: `<@${guild.ownerId}>`, inline: true } : { name: '\u200b', value: '\u200b', inline: true },
      )
      .setFooter({ text: 'Serverio informacija' })
      .setTimestamp(new Date());

    await safeReply(interaction, {
      embeds: [embed],
      ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
      allowedMentions: { parse: [] },
    });

    if (timeoutMs > 0) {
      setTimeout(() => deleteReplySafe(interaction), timeoutMs);
    }
  },
};


