const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');
const { buildEmbedFromJson } = require('../utils/embed');
const { createEmbedFromMessage } = require('../utils/embeds');
const { getMessage } = require('../utils/messages');
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
    const attachment = interaction.options.getAttachment('failas', true);
    const isJson = attachment.name.toLowerCase().endsWith('.json');
    if (!isJson) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.fileNotJson'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    // Pagrindinės saugumo/konfig patikros
    const roleId = config?.rules?.roleId;
    if (!roleId || roleId.startsWith('PAKEISKITE')) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.roleIdNotSet'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
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
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.jsonReadError'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    // Patikrinti ar tai embed (kaip ir echo)
    if (!jsonData || !(jsonData.title || jsonData.fields || jsonData.color || jsonData.author || jsonData.thumbnail || jsonData.image || jsonData.footer)) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.jsonInvalidStructure'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    // Paruošti embed
    const embed = buildEmbedFromJson(jsonData);

    // Paruošti mygtukus
    const acceptLabel = config?.rules?.buttons?.acceptLabel;
    const rejectLabel = config?.rules?.buttons?.rejectLabel;
    
    if (!acceptLabel || typeof acceptLabel !== 'string' || acceptLabel.trim().length === 0) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.configMissing').replace('{key}', 'rules.buttons.acceptLabel'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }
    
    if (!rejectLabel || typeof rejectLabel !== 'string' || rejectLabel.trim().length === 0) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.configMissing').replace('{key}', 'rules.buttons.rejectLabel'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rules_accept').setLabel(acceptLabel).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rules_reject').setLabel(rejectLabel).setStyle(ButtonStyle.Danger)
    );

    // Siųsti viešą žinutę į kanalą su mygtukais (žinutė neturi dingti)
    await safeDefer(interaction); // defer be ephemeral, kad galėtume ištrinti atsakymą
    try {
      const sent = await interaction.channel.send({
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
      });

      // Ištriname atsakymą, kad paslėptume "used /rules"
      try {
        await interaction.deleteReply();
      } catch (_) {
        // Jei nepavyko ištrinti, ignoruojame
      }
    } catch (e) {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.sendError'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
  },
};


