const { SlashCommandBuilder, ChannelType, AttachmentBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');
const { createEmbedFromMessage } = require('../utils/embeds');
const { getMessage, getConsoleMessage } = require('../utils/messages');
const archiver = require('archiver');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Eksportuoja HTML failą su rolės leidimais visuose kanaluose.')
    .addRoleOption(opt => opt.setName('role').setDescription('Rolė (pasirenkama - jei nenurodysite, eksportuos visas roles)')),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('roleinfo');
    
    // Visada defer'inu, kad turėtume laiko generuoti
    if (ephemeral) {
      await safeDefer(interaction, { ephemeral: true });
    } else {
      await safeDefer(interaction);
    }

    const guild = interaction.guild;
    if (!guild) {
      const embed = createEmbedFromMessage(getMessage('roleinfo', 'errors.notGuild'), 'error');
      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    const filterRole = interaction.options.getRole('role');
    
    try {
      // Surinkime visus kanalus
      const channels = guild.channels.cache
        .filter(c => [
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildStageVoice,
        ].includes(c.type))
        .sort((a, b) => a.rawPosition - b.rawPosition);

      // Jei reikia, atnaujiname members cache (jei jis nėra pilnas)
      // Patikriname, ar cache turi mažiau nei 90% narių (apytikslis skaičius)
      const expectedMemberCount = guild.memberCount || 0;
      const cachedMemberCount = guild.members.cache.size;
      if (expectedMemberCount > 0 && cachedMemberCount < expectedMemberCount * 0.9) {
        // Bandoma fetch'inti narius, bet neblokuojame, jei nepavyksta
        try {
          await guild.members.fetch().catch(() => {});
        } catch (e) {
          // Ignoruojame klaidas
        }
      }

      // Generuojame HTML (gali užtrukti su daug rolių/kanalų)
      const htmlTexts = config?.messages?.roleinfo?.html || {};
      const getHtmlText = (path, fallback) => {
        const keys = path.split('.');
        let value = htmlTexts;
        for (const k of keys) {
          value = value?.[k];
        }
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return fallback;
        }
        return value;
      };
      
      const htmlTextsObj = {
        labelMembers: getHtmlText('labels.members', 'Narių'),
        labelChannels: getHtmlText('labels.channels', 'Kanalų'),
        labelRoles: getHtmlText('labels.roles', 'Rolių'),
        labelGlobalPermissions: getHtmlText('labels.globalPermissions', 'Globalūs leidimai'),
        labelChannelPermissions: getHtmlText('labels.channelPermissions', 'Kanalų leidimai'),
        badgeMembers: getHtmlText('badges.members', 'narių'),
        badgePermissions: getHtmlText('badges.permissions', 'leidimai'),
        noGlobalPermissions: getHtmlText('empty.noGlobalPermissions', 'Nėra globalių leidimų'),
        noChannelPermissions: getHtmlText('empty.noChannelPermissions', 'Nėra kanalo specifinių leidimų'),
        denied: getHtmlText('misc.denied', '(uždrausta)'),
        error: getHtmlText('misc.error', 'Klaida:'),
        channels: getHtmlText('misc.channels', 'kanalai'),
        roles: getHtmlText('misc.roles', 'rolės')
      };
      
      let html;
      try {
        html = filterRole 
          ? generateRoleHTML(guild, filterRole, channels, htmlTextsObj)
          : generateAllRolesHTML(guild, channels, htmlTextsObj);
      } catch (htmlError) {
        console.error(getConsoleMessage('roleinfoHtmlError'), htmlError);
        const errorMsg = getMessage('roleinfo', 'errors.htmlGeneration').replace('{error}', htmlError.message || 'Nežinoma klaida');
        const embed = createEmbedFromMessage(errorMsg, 'error');
        await safeReply(interaction, {
          embeds: [embed],
          ...(ephemeral ? { ephemeral: true } : {}),
        });
        return;
      }
      
      // Sukuriame failo vardus
      const htmlFileName = filterRole
        ? `roleinfo-${filterRole.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}.html`
        : `roleinfo-all-roles-${Date.now()}.html`;
      
      const zipFileName = htmlFileName.replace('.html', '.zip');
      
      // Sukuriame ZIP failą su HTML viduje
      let zipBuffer;
      try {
        zipBuffer = await createZipFile(html, htmlFileName);
      } catch (zipError) {
        console.error(getConsoleMessage('roleinfoZipError'), zipError);
        const errorMsg = getMessage('roleinfo', 'errors.zipCreation').replace('{error}', zipError.message || 'Nežinoma klaida');
        const embed = createEmbedFromMessage(errorMsg, 'error');
        await safeReply(interaction, {
          embeds: [embed],
          ...(ephemeral ? { ephemeral: true } : {}),
        });
        return;
      }
      
      // Patikriname failo dydį (Discord limitas 25MB, bet saugumo sumetimais apribojame)
      // Šis limitas gali būti keičiamas config.json faile (roleinfo.maxFileSizeMB)
      const maxSizeMB = config?.roleinfo?.maxFileSizeMB ?? 20;
      const maxSize = maxSizeMB * 1024 * 1024;
      if (zipBuffer.length > maxSize) {
        const errorMsg = getMessage('roleinfo', 'errors.fileTooLarge');
        const embed = createEmbedFromMessage(errorMsg, 'error');
        await safeReply(interaction, {
          embeds: [embed],
          ...(ephemeral ? { ephemeral: true } : {}),
        });
        return;
      }
      
      // Sukuriame embed žinutę
      const message = filterRole
        ? getMessage('roleinfo', 'success.reportGeneratedSingle').replace('{role}', filterRole.toString())
        : getMessage('roleinfo', 'success.reportGeneratedAll');
      const embed = createEmbedFromMessage(message, 'success');
      
      // Sukuriame attachment
      const attachment = new AttachmentBuilder(zipBuffer, { name: zipFileName });
      
      // Siunčiame žinutę su failu
      await safeReply(interaction, {
        embeds: [embed],
        files: [attachment],
        ...(ephemeral ? { ephemeral: true } : {}),
      });

      // Taikome timeout (su ephemeral gali neveikti, nes Discord neleidžia trinti ephemeral žinučių)
      if (timeoutMs > 0) {
        setTimeout(() => deleteReplySafe(interaction), timeoutMs);
      }
    } catch (error) {
      console.error(getConsoleMessage('roleinfoError'), error);
      const errorMessage = error.message || 'Nežinoma klaida';
      const errorMsg = getMessage('roleinfo', 'errors.htmlFile').replace('{error}', errorMessage);
      const embed = createEmbedFromMessage(errorMsg, 'error');
      await safeReply(interaction, {
        embeds: [embed],
        ...(ephemeral ? { ephemeral: true } : {}),
      });
    }
  },
};

async function createZipFile(htmlContent, htmlFileName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maksimalus suspaudimas
    });

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));

    archive.append(htmlContent, { name: htmlFileName });
    archive.finalize();
  });
}

function generateRoleHTML(guild, role, channels, htmlTexts) {
  const guildName = guild.name;
  const timestamp = new Date().toLocaleString('lt-LT');
  // Validuojame spalvą - tik hex formatas
  const roleColor = role.color && role.color !== 0 
    ? role.color.toString(16).padStart(6, '0').replace(/[^0-9a-f]/gi, '0').substring(0, 6)
    : '99aab5';
  // Saugiai gauname icon URL
  let roleIcon = null;
  try {
    if (role.iconURL && typeof role.iconURL === 'function') {
      const iconUrl = role.iconURL({ size: 128 });
      // Validuojame, kad URL prasideda nuo https://
      if (iconUrl && typeof iconUrl === 'string' && iconUrl.startsWith('https://')) {
        roleIcon = iconUrl;
      }
    }
  } catch (error) {
    // Ignoruojame klaidas gaunant icon
  }
  
  // Skaičiuojame narių skaičių
  // Naudojame role.members, jei jis turi narių, kitaip naudojame guild.members.cache
  let membersCount = 0;
  try {
    // Pirmiausia bandoma naudoti role.members (jei jis yra Collection su nariais)
    if (role.members && typeof role.members.size === 'number' && role.members.size > 0) {
      membersCount = role.members.size;
    } else {
      // Jei role.members nėra prieinamas arba tuščias, skaičiuojame iš guild.members.cache
      membersCount = guild.members.cache.filter(member => {
        try {
          return member && member.roles && member.roles.cache && member.roles.cache.has(role.id);
        } catch (e) {
          return false;
        }
      }).size;
      
      // Jei cache'as nepilnas ir gavome 0, bandoma naudoti role.members kaip fallback
      if (membersCount === 0 && role.members && typeof role.members.size === 'number') {
        membersCount = role.members.size;
      }
    }
  } catch (error) {
    // Jei nepavyko, bandoma naudoti role.members kaip fallback
    try {
      if (role.members && typeof role.members.size === 'number') {
        membersCount = role.members.size;
      } else {
        membersCount = guild.members.cache.filter(member => {
          try {
            return member && member.roles && member.roles.cache && member.roles.cache.has(role.id);
          } catch (e) {
            return false;
          }
        }).size;
      }
    } catch (e) {
      membersCount = 0;
    }
  }
  
  // Globalūs leidimai
  const globalPerms = role.permissions?.toArray?.() || [];
  
  let html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(guildName)} - ${escapeHtml(role.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1f22;
      color: #dbdee1;
      padding: 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #2b2d31;
      border-radius: 8px;
      padding: 24px;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #404249;
    }
    h1 {
      color: #fff;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .meta {
      color: #b5bac1;
      font-size: 14px;
    }
    .role-card {
      background: #313338;
      border-radius: 6px;
      padding: 20px;
      border: 1px solid #404249;
    }
    .role-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #404249;
    }
    .role-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
    }
    .role-info {
      flex: 1;
    }
    .role-name {
      color: #fff;
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 4px;
    }
    .role-id {
      color: #80848e;
      font-size: 13px;
      font-family: 'Courier New', monospace;
    }
    .role-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .role-badge {
      background: #5865f2;
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }
    .section {
      margin-top: 20px;
    }
    .section-title {
      color: #b5bac1;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .perms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }
    .perm-tag {
      background: #23a55a;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    }
    .channel-block {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #404249;
    }
    .channel-title {
      color: #5865f2;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .empty {
      color: #80848e;
      font-size: 13px;
      font-style: italic;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .stat {
      background: #313338;
      padding: 12px 16px;
      border-radius: 6px;
      flex: 1;
      min-width: 150px;
    }
    .stat-label {
      color: #b5bac1;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .stat-value {
      color: #fff;
      font-size: 20px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(guildName)}</h1>
      <div class="meta">${escapeHtml(timestamp)} • ${channels.size} ${escapeHtml(htmlTexts.channels)}</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-label">${escapeHtml(htmlTexts.labelMembers)}</div>
        <div class="stat-value">${membersCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${escapeHtml(htmlTexts.labelChannels)}</div>
        <div class="stat-value">${channels.size}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${escapeHtml(htmlTexts.labelGlobalPermissions)}</div>
        <div class="stat-value">${globalPerms.length}</div>
      </div>
    </div>
    
    <div class="role-card">
      <div class="role-header">
        ${roleIcon ? `<img src="${escapeHtml(roleIcon)}" alt="${escapeHtml(role.name)}" class="role-icon" onerror="this.style.display='none'">` : ''}
        <div class="role-info">
          <div class="role-name" style="color: #${roleColor};">${escapeHtml(role.name)}</div>
          <div class="role-id">${escapeHtml(String(role.id))}</div>
        </div>
        <div class="role-badges">
          <div class="role-badge">${membersCount} ${escapeHtml(htmlTexts.badgeMembers)}</div>
          <div class="role-badge" style="background: #80848e;">${globalPerms.length} ${escapeHtml(htmlTexts.badgePermissions)}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">${escapeHtml(htmlTexts.labelGlobalPermissions)}</div>
        <div class="perms-grid">`;

  if (globalPerms.length > 0) {
    for (const perm of globalPerms) {
      html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
    }
  } else {
    html += `<div class="empty">${escapeHtml(htmlTexts.noGlobalPermissions)}</div>`;
  }

  html += `
        </div>
      </div>
      
      <div class="channel-block">
        <div class="section-title">${escapeHtml(htmlTexts.labelChannelPermissions)}</div>`;

  // Kiekvienam kanalui surinkime leidimus
  for (const channel of channels.values()) {
    html += `
        <div style="margin-bottom: 16px;">
          <div class="channel-title">#${escapeHtml(channel.name)}</div>
          <div class="perms-grid">`;

    try {
      // Gauname kanalo specifinius leidimus (override'us)
      const channelPerms = channel.permissionOverwrites.cache.get(role.id);
      
      if (channelPerms) {
        const allowPerms = channelPerms.allow.toArray();
        const denyPerms = channelPerms.deny.toArray();
        
        // Rodome visus kanalo override'us (leidimus ir uždraudimus)
        const channelSpecificPerms = [];
        
        // Leidimai, kurie yra kanalo override'uose
        for (const perm of allowPerms) {
          channelSpecificPerms.push({ name: perm, type: 'allow' });
        }
        
        // Uždrausti leidimai kanalo override'uose
        for (const perm of denyPerms) {
          channelSpecificPerms.push({ name: perm, type: 'deny' });
        }
        
        if (channelSpecificPerms.length > 0) {
          for (const perm of channelSpecificPerms) {
            const style = perm.type === 'deny' ? 'background: #f23f42;' : '';
            html += `<div class="perm-tag" style="${style}">${escapeHtml(perm.name)}${perm.type === 'deny' ? ' ' + escapeHtml(htmlTexts.denied) : ''}</div>`;
          }
        } else {
          html += `<div class="empty">${escapeHtml(htmlTexts.noChannelPermissions)}</div>`;
        }
      } else {
        html += `<div class="empty">${escapeHtml(htmlTexts.noChannelPermissions)}</div>`;
      }
    } catch (error) {
      html += `<div class="empty">${escapeHtml(htmlTexts.error)} ${escapeHtml(error.message || 'Nežinoma klaida')}</div>`;
    }

    html += `
          </div>
        </div>`;
  }

  html += `
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function generateAllRolesHTML(guild, channels, htmlTexts) {
  const guildName = guild.name;
  const timestamp = new Date().toLocaleString('lt-LT');
  
  // Surinkime visas roles (išskyrus @everyone)
  const roles = Array.from(guild.roles.cache.values())
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  
  let html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(guildName)} - Visos rolės</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1f22;
      color: #dbdee1;
      padding: 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #2b2d31;
      border-radius: 8px;
      padding: 24px;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #404249;
    }
    h1 {
      color: #fff;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .meta {
      color: #b5bac1;
      font-size: 14px;
    }
    .role-item {
      background: #313338;
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
      border: 1px solid #404249;
    }
    .role-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .role-header:hover {
      background: #383a40;
    }
    .role-title {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      flex-wrap: wrap;
    }
    .role-name {
      color: #fff;
      font-weight: 600;
      font-size: 15px;
    }
    .role-badge {
      background: #5865f2;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .role-toggle {
      color: #b5bac1;
      font-size: 14px;
      transition: transform 0.2s;
    }
    .role-content {
      display: none;
      padding: 16px;
      border-top: 1px solid #404249;
    }
    .role-content.active {
      display: block;
    }
    .perms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .perm-tag {
      background: #23a55a;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    }
    .channel-block {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #404249;
    }
    .channel-title {
      color: #5865f2;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .empty {
      color: #80848e;
      font-size: 13px;
      font-style: italic;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .stat {
      background: #313338;
      padding: 12px 16px;
      border-radius: 6px;
      flex: 1;
      min-width: 150px;
    }
    .stat-label {
      color: #b5bac1;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .stat-value {
      color: #fff;
      font-size: 20px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(guildName)}</h1>
      <div class="meta">${escapeHtml(timestamp)} • ${roles.length} ${escapeHtml(htmlTexts.roles)} • ${channels.size} ${escapeHtml(htmlTexts.channels)}</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-label">${escapeHtml(htmlTexts.labelRoles)}</div>
        <div class="stat-value">${roles.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${escapeHtml(htmlTexts.labelChannels)}</div>
        <div class="stat-value">${channels.size}</div>
      </div>
    </div>`;

  // Generuojame kiekvieną rolę
  let roleIndex = 0;
  for (const role of roles) {
    // Validuojame spalvą - tik hex formatas
    const roleColor = role.color && role.color !== 0 
      ? role.color.toString(16).padStart(6, '0').replace(/[^0-9a-f]/gi, '0').substring(0, 6)
      : '99aab5';
    // Skaičiuojame narių skaičių
    // Naudojame role.members, jei jis turi narių, kitaip naudojame guild.members.cache
    let membersCount = 0;
    try {
      // Pirmiausia bandoma naudoti role.members (jei jis yra Collection su nariais)
      if (role.members && typeof role.members.size === 'number' && role.members.size > 0) {
        membersCount = role.members.size;
      } else {
        // Jei role.members nėra prieinamas arba tuščias, skaičiuojame iš guild.members.cache
        membersCount = guild.members.cache.filter(member => {
          try {
            return member && member.roles && member.roles.cache && member.roles.cache.has(role.id);
          } catch (e) {
            return false;
          }
        }).size;
        
        // Jei cache'as nepilnas ir gavome 0, bandoma naudoti role.members kaip fallback
        if (membersCount === 0 && role.members && typeof role.members.size === 'number') {
          membersCount = role.members.size;
        }
      }
    } catch (error) {
      // Jei nepavyko, bandoma naudoti role.members kaip fallback
      try {
        if (role.members && typeof role.members.size === 'number') {
          membersCount = role.members.size;
        } else {
          membersCount = guild.members.cache.filter(member => {
            try {
              return member && member.roles && member.roles.cache && member.roles.cache.has(role.id);
            } catch (e) {
              return false;
            }
          }).size;
        }
      } catch (e) {
        membersCount = 0;
      }
    }
    const globalPerms = role.permissions?.toArray?.() || [];
    // Saugiai generuojame roleId (naudojame index, ne role.id, kad būtų saugu)
    const roleId = `role-${roleIndex}`;
    roleIndex++;

    html += `
    <div class="role-item">
      <div class="role-header" onclick="toggleRole('${escapeHtml(roleId)}')">
        <div class="role-title">
          <div class="role-name" style="color: #${roleColor};">${escapeHtml(role.name)}</div>
          <div class="role-badge">${membersCount} ${escapeHtml(htmlTexts.badgeMembers)}</div>
          <div class="role-badge" style="background: #80848e;">${globalPerms.length} ${escapeHtml(htmlTexts.badgePermissions)}</div>
        </div>
        <div class="role-toggle" id="${escapeHtml(roleId)}-toggle">▼</div>
      </div>
      <div class="role-content" id="${escapeHtml(roleId)}">
        <div style="margin-bottom: 12px;">
          <div style="color: #b5bac1; font-size: 13px; margin-bottom: 8px;">${escapeHtml(htmlTexts.labelGlobalPermissions)}:</div>
          <div class="perms-grid">`;

    if (globalPerms.length > 0) {
      for (const perm of globalPerms) {
        html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
      }
    } else {
      html += `<div class="empty">${escapeHtml(htmlTexts.noGlobalPermissions)}</div>`;
    }

    html += `
          </div>
        </div>
        <div class="channel-block">
          <div style="color: #b5bac1; font-size: 13px; margin-bottom: 12px;">${escapeHtml(htmlTexts.labelChannelPermissions)}:</div>`;

    // Kiekvienam kanalui surinkime leidimus
    for (const channel of channels.values()) {
      html += `
          <div style="margin-bottom: 12px;">
            <div class="channel-title">#${escapeHtml(channel.name)}</div>
            <div class="perms-grid">`;

      try {
        // Gauname kanalo specifinius leidimus (override'us)
        const channelPerms = channel.permissionOverwrites.cache.get(role.id);
        
        if (channelPerms) {
          const allowPerms = channelPerms.allow.toArray();
          const denyPerms = channelPerms.deny.toArray();
          
          // Rodome visus kanalo override'us (leidimus ir uždraudimus)
          const channelSpecificPerms = [];
          
          // Leidimai, kurie yra kanalo override'uose
          for (const perm of allowPerms) {
            channelSpecificPerms.push({ name: perm, type: 'allow' });
          }
          
          // Uždrausti leidimai kanalo override'uose
          for (const perm of denyPerms) {
            channelSpecificPerms.push({ name: perm, type: 'deny' });
          }
          
          if (channelSpecificPerms.length > 0) {
            for (const perm of channelSpecificPerms) {
              const style = perm.type === 'deny' ? 'background: #f23f42;' : '';
              html += `<div class="perm-tag" style="${style}">${escapeHtml(perm.name)}${perm.type === 'deny' ? ' ' + escapeHtml(htmlTexts.denied) : ''}</div>`;
            }
          } else {
            html += `<div class="empty">${escapeHtml(htmlTexts.noChannelPermissions)}</div>`;
          }
        } else {
          html += `<div class="empty">${escapeHtml(htmlTexts.noChannelPermissions)}</div>`;
        }
      } catch (error) {
        html += `<div class="empty">${escapeHtml(htmlTexts.error)} ${escapeHtml(error.message || 'Nežinoma klaida')}</div>`;
      }

      html += `
            </div>
          </div>`;
    }

    html += `
        </div>
      </div>
    </div>`;
  }

  html += `
  </div>
  <script>
    function toggleRole(id) {
      // Saugumo patikra - tik alphanumeric ir brūkšneliai
      if (!/^role-\\d+$/.test(id)) return; // XSS apsauga: validuojame ID formatą
      const content = document.getElementById(id);
      const toggle = document.getElementById(id + '-toggle');
      if (content && toggle) {
        if (content.classList.contains('active')) {
          content.classList.remove('active');
          toggle.textContent = '▼';
        } else {
          content.classList.add('active');
          toggle.textContent = '▲';
        }
      }
    }
  </script>
</body>
</html>`;

  return html;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

