const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ChannelType, AttachmentBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Rodo rolės leidimus: pasirenkant VISI arba konkretų kanalą.')
    .addRoleOption(opt => opt.setName('role').setDescription('Pasirinkite rolę').setRequired(true))
    .addStringOption(opt =>
      opt
        .setName('rodymas')
        .setDescription('Pasirinkite: visi arba kanalas')
        .addChoices(
          { name: 'visi', value: 'visi' },
          { name: 'kanalas', value: 'kanalas' }
        )
    )
    .addChannelOption(opt => opt.setName('kanalas').setDescription('Kanalas (naudojamas, kai rodymas=kanalas)')),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('roleinfo');
    if (ephemeral) {
      await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    }

    const role = interaction.options.getRole('role', true);
    const rodymas = interaction.options.getString('rodymas') || 'visi';
    const channel = rodymas === 'kanalas' ? interaction.options.getChannel('kanalas') : null;
    const visi = rodymas === 'visi';

    if (channel && channel.type === ChannelType.DM) {
      await safeReply(interaction, { content: 'Kanalas turi būti gildijos kanalas.' });
      return;
    }

    // Globalūs leidimai
    const globalPerms = role.permissions?.toArray?.() || [];

    // Kanalo leidimai (jei nurodytas kanalas)
    let channelPerms = null;
    if (channel && channel.permissionsFor) {
      try {
        const resolved = channel.permissionsFor(role);
        if (resolved) channelPerms = resolved.toArray();
      } catch (_) {}
    }

    const fmt = (arr) => (arr && arr.length ? arr.map(p => `\`${p}\``).join(', ') : 'nėra');

    // Bendra įrankinė gražiam embedui
    const roleColor = role.color && role.color !== 0 ? role.color : 0x2b2d31;
    const roleIcon = typeof role.iconURL === 'function' ? (role.iconURL({ size: 128 }) || undefined) : undefined;

    if (visi && interaction.guild) {
      // Ataskaita visiems kanalams – santrauka su pagrindiniais leidimais
      const channels = interaction.guild.channels.cache
        .filter(c => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(c.type))
        .sort((a, b) => a.rawPosition - b.rawPosition);

      const keyPerms = [
        // Tekstiniai kanalai
        'ViewChannel',
        'SendMessages',
        'SendMessagesInThreads',
        'ReadMessageHistory',
        'AddReactions',
        'EmbedLinks',
        'AttachFiles',
        'UseExternalEmojis',
        'MentionEveryone',
        'ManageMessages',
        'ManageThreads',
        // Valdymas
        'ManageChannels',
        // Balsiniai kanalai
        'Connect',
        'Speak',
        'Stream',
        'UseVAD',
        'MuteMembers',
        'DeafenMembers',
        'MoveMembers',
      ];

      const lines = [];
      lines.push(`# Rolė: ${role.name}`);
      lines.push('Kanalo leidimų santrauka:');
      for (const c of channels.values()) {
        let permsArr = [];
        try {
          const resolved = c.permissionsFor(role);
          permsArr = resolved ? resolved.toArray() : [];
        } catch (_) {}
        const allowed = keyPerms.filter(k => permsArr.includes(k));
        const mapLine = allowed.length ? allowed.map(k => `\`${k}\``).join(' · ') : 'nėra leidimų';
        lines.push(`- #${c.name} → ${mapLine}`);
      }

      const report = lines.join('\n');
      // Santrauka embede (pirmi 20 eilučių), pilna ataskaita priede jei ilga
      const summaryLines = lines.slice(0, 22); // antraštės + ~20 įrašų
      const embed = new EmbedBuilder()
        .setColor(roleColor)
        .setAuthor({ name: `Rolė: ${role.name}`, iconURL: roleIcon })
        .setDescription('Leidimų santrauka pasirinktiems pagrindiniams leidimams:')
        .addFields(
          { name: 'Tikrinami leidimai', value: keyPerms.map(k => `\`${k}\``).join(' · ') }
        )
        .addFields(
          { name: 'Kanalai', value: `\n${summaryLines.join('\n')}`.slice(0, 1000) }
        )
        .setFooter({ text: summaryLines.length < lines.length ? 'Rodyti pilną ataskaitą prisegtame faile' : 'Visi kanalai pateikti' })
        .setTimestamp(new Date());

      const messageOptions = {
        embeds: [embed],
        ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
        allowedMentions: { parse: [] },
      };

      if (report.length > 1800) {
        const buffer = Buffer.from(report, 'utf8');
        const file = new AttachmentBuilder(buffer, { name: `role-perms-${role.id}.txt` });
        messageOptions.files = [file];
      }

      await safeReply(interaction, messageOptions);

      if (!ephemeral && timeoutMs > 0) {
        setTimeout(() => deleteReplySafe(interaction), timeoutMs);
      }
      return;
    }

    // Bandome tiksliau paskaičiuoti narių skaičių rolei.
    let membersCount = role.members?.size ?? 0;
    try {
      if (membersCount === 0 && interaction.guild && interaction.guild.members?.fetch) {
        // Užkrauname narių cache (reikalauja Server Members Intent)
        await interaction.guild.members.fetch();
        membersCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
      }
    } catch (_) {}

    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setAuthor({ name: `Rolė: ${role.name}`, iconURL: roleIcon || interaction.guild?.iconURL({ size: 128 }) || undefined })
      .addFields(
        { name: 'Rolės ID', value: role.id, inline: true },
        { name: 'Narių skaičius', value: String(membersCount), inline: true },
        { name: 'Paminėjimas', value: `<@&${role.id}>`, inline: true },
      )
      .addFields({ name: 'Globalūs leidimai', value: fmt(globalPerms) })
      .setFooter({ text: channel ? `Leidimai kanale #${channel.name}` : 'Globalūs leidimai' })
      .setTimestamp(new Date());

    if (channelPerms) {
      embed.addFields({ name: `Leidimai kanale #${channel.name}`, value: fmt(channelPerms) });
    }

    await safeReply(interaction, {
      embeds: [embed],
      ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
      allowedMentions: { parse: [] },
    });

    if (!ephemeral && timeoutMs > 0) {
      setTimeout(() => deleteReplySafe(interaction), timeoutMs);
    }
  },
};


