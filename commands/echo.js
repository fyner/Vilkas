const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { hasBotPerm } = require('../utils/permissions');
const { safeReply, safeDefer } = require('../utils/responses');

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
    ,
  async execute(interaction) {
    const message = interaction.options.getString('zinute');
    const { ephemeral: useEphemeral, timeoutMs } = getCommandSettings('echo');

    // Jei reikia pašalinti "+ used /echo" antraštę, negalime naudoti viešo interaction reply.
    if (!useEphemeral) {
      // Jei trūksta leidimo siųsti žinutes, grįžtame su ephemeral
      const canSend = hasBotPerm(interaction.channel, interaction.client.user.id, PermissionFlagsBits.SendMessages);
      if (!canSend) {
        await safeReply(interaction, { content: message, flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds });
        return;
      }

      // Atsakome ephemeraliai ir tuoj pat ištriname, kad paslėpti system header
      await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      try { await interaction.deleteReply(); } catch (_) {}

      const sent = await interaction.channel.send({
        content: message,
        flags: MessageFlags.SuppressEmbeds,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        embeds: [],
        components: [],
        tts: false,
      });

      if (timeoutMs > 0) {
        setTimeout(() => { try { sent.delete(); } catch (_) {} }, timeoutMs);
      }
      return;
    }

    // Ephemeral atvejui: Discord vis tiek rodys "+ used /echo" bloką (to paslėpti neįmanoma)
    await safeReply(interaction, {
      content: message,
      flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds,
      allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      embeds: [],
      components: [],
      tts: false,
    });
  },
};
