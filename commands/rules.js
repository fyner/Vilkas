const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');
const { buildEmbedFromJson } = require('../utils/embed');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Įkelti taisykles iš JSON failo ir pridėti mygtukus (OK/No).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addAttachmentOption((option) =>
      option
        .setName('failas')
        .setDescription('JSON failas su taisyklių embed turiniu')
        .setRequired(true)
    ),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('help'); // naudokime viešą pagal nutylėjimą

    const attachment = interaction.options.getAttachment('failas', true);
    const isJson = attachment.name.toLowerCase().endsWith('.json');
    if (!isJson) {
      await safeReply(interaction, { content: '❌ Failas turi būti .json formato.', ephemeral: true });
      return;
    }

    // Pagrindinės saugumo/konfig patikros
    const roleId = config?.rules?.roleId;
    if (!roleId || roleId.startsWith('PAKEISKITE')) {
      await safeReply(interaction, { content: '❌ Nenurodytas roles ID `config.json` faile (`rules.roleId`).', ephemeral: true });
      return;
    }

    // Nuskaityti JSON
    let jsonData;
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error('Nepavyko pasiekti failo');
      const content = await res.text();
      jsonData = JSON.parse(content);
    } catch (e) {
      await safeReply(interaction, { content: '❌ Nepavyko perskaityti JSON failo.', ephemeral: true });
      return;
    }

    // Patikrinti ar tai embed (kaip ir echo)
    if (!jsonData || !(jsonData.title || jsonData.fields || jsonData.color || jsonData.author || jsonData.thumbnail || jsonData.image || jsonData.footer)) {
      await safeReply(interaction, { content: '❌ JSON neatitinka embed struktūros.', ephemeral: true });
      return;
    }

    // Paruošti embed
    const embed = buildEmbedFromJson(jsonData);

    // Paruošti mygtukus
    const acceptLabel = config?.rules?.buttons?.acceptLabel || 'OK';
    const rejectLabel = config?.rules?.buttons?.rejectLabel || 'No';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rules_accept').setLabel(acceptLabel).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rules_reject').setLabel(rejectLabel).setStyle(ButtonStyle.Danger)
    );

    // Siųsti į kanalą
    await safeDefer(interaction); // viešai, kad žinutė liktų kanale
    try {
      const sent = await interaction.channel.send({
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
      });

      await safeReply(interaction, { content: `✅ Taisyklės išsiųstos. Žinutės ID: ${sent.id}`, ephemeral: true });

      if (timeoutMs > 0) {
        setTimeout(() => { try { deleteReplySafe(interaction); } catch (_) {} }, timeoutMs);
      }
    } catch (e) {
      await safeReply(interaction, { content: '❌ Nepavyko išsiųsti taisyklių į šį kanalą.', ephemeral: true });
    }
  },
};


