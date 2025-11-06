const { SlashCommandBuilder, MessageFlags, ChannelType, AttachmentBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Eksportuoja HTML failą su rolės leidimais visuose kanaluose.')
    .addRoleOption(opt => opt.setName('role').setDescription('Rolė (pasirenkama - jei nenurodysite, eksportuos visas roles)')),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('roleinfo');
    
    if (ephemeral) {
      await safeDefer(interaction, { ephemeral: true });
    } else {
      await safeDefer(interaction);
    }

    const guild = interaction.guild;
    if (!guild) {
      await safeReply(interaction, { content: 'Ši komanda veikia tik gildijose.' });
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

      // Generuojame HTML
      const html = filterRole 
        ? generateRoleHTML(guild, filterRole, channels)
        : generateAllRolesHTML(guild, channels);
      
      // Sukuriame failo vardą
      const fileName = filterRole
        ? `roleinfo-${filterRole.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}.html`
        : `roleinfo-all-roles-${Date.now()}.html`;
      
      // Sukuriame Buffer iš HTML
      const buffer = Buffer.from(html, 'utf-8');
      
      // Sukuriame attachment
      const attachment = new AttachmentBuilder(buffer, { name: fileName });
      
      // Siunčiame failą kaip attachment
      await safeReply(interaction, {
        content: filterRole
          ? `✅ HTML failas sugeneruotas. Paspaudę ant failo galite jį atsisiųsti.`
          : `✅ HTML failas sugeneruotas. Paspaudę ant failo galite jį atsisiųsti.`,
        files: [attachment],
        flags: MessageFlags.SuppressEmbeds,
        ...(ephemeral ? { ephemeral: true } : {}),
      });

      if (timeoutMs > 0 && !ephemeral) {
        setTimeout(() => deleteReplySafe(interaction), timeoutMs);
      }
    } catch (error) {
      console.error('Klaida generuojant roleinfo:', error);
      const errorMessage = error.message || 'Nežinoma klaida';
      await safeReply(interaction, {
        content: `❌ Klaida generuojant arba išsaugant HTML failą: ${errorMessage}`,
        ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
      });
    }
  },
};

function generateRoleHTML(guild, role, channels) {
  const guildName = guild.name;
  const timestamp = new Date().toLocaleString('lt-LT');
  const roleColor = role.color && role.color !== 0 ? role.color.toString(16).padStart(6, '0') : '99aab5';
  const roleIcon = typeof role.iconURL === 'function' ? (role.iconURL({ size: 128 }) || undefined) : undefined;
  
  // Skaičiuojame narių skaičių
    let membersCount = role.members?.size ?? 0;
  
  // Globalūs leidimai
  const globalPerms = role.permissions?.toArray?.() || [];
  
  let html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${guildName} - ${escapeHtml(role.name)}</title>
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
    }
    .stat {
      background: #313338;
      padding: 12px 16px;
      border-radius: 6px;
      flex: 1;
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
      <div class="meta">${timestamp} • ${channels.size} kanalai</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Narių</div>
        <div class="stat-value">${membersCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Kanalų</div>
        <div class="stat-value">${channels.size}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Globalūs leidimai</div>
        <div class="stat-value">${globalPerms.length}</div>
      </div>
    </div>
    
    <div class="role-card">
      <div class="role-header">
        ${roleIcon ? `<img src="${roleIcon}" alt="${escapeHtml(role.name)}" class="role-icon" onerror="this.style.display='none'">` : ''}
        <div class="role-info">
          <div class="role-name" style="color: #${roleColor};">${escapeHtml(role.name)}</div>
          <div class="role-id">${role.id}</div>
        </div>
        <div class="role-badges">
          <div class="role-badge">${membersCount} narių</div>
          <div class="role-badge" style="background: #80848e;">${globalPerms.length} leidimai</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Globalūs leidimai</div>
        <div class="perms-grid">`;

  if (globalPerms.length > 0) {
    for (const perm of globalPerms) {
      html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
    }
  } else {
    html += `<div class="empty">Nėra globalių leidimų</div>`;
  }

  html += `
        </div>
      </div>
      
      <div class="channel-block">
        <div class="section-title">Kanalų leidimai</div>`;

  // Kiekvienam kanalui surinkime leidimus
  for (const channel of channels.values()) {
    html += `
        <div style="margin-bottom: 16px;">
          <div class="channel-title">#${escapeHtml(channel.name)}</div>
          <div class="perms-grid">`;

    try {
      const permissions = channel.permissionsFor(role);
      
      if (permissions) {
        const allowed = permissions.toArray();
        
        if (allowed.length > 0) {
          for (const perm of allowed) {
            html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
          }
        } else {
          html += `<div class="empty">Nėra leidimų</div>`;
        }
      } else {
        html += `<div class="empty">Nepavyko nustatyti</div>`;
      }
    } catch (error) {
      html += `<div class="empty">Klaida</div>`;
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

function generateAllRolesHTML(guild, channels) {
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
  <title>${guildName} - Roles Info</title>
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
    }
    .stat {
      background: #313338;
      padding: 12px 16px;
      border-radius: 6px;
      flex: 1;
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
      <div class="meta">${timestamp} • ${roles.length} rolės • ${channels.size} kanalai</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Rolių</div>
        <div class="stat-value">${roles.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Kanalų</div>
        <div class="stat-value">${channels.size}</div>
      </div>
    </div>`;

  // Generuojame kiekvieną rolę
  let roleIndex = 0;
  for (const role of roles) {
    const roleColor = role.color && role.color !== 0 ? role.color.toString(16).padStart(6, '0') : '99aab5';
    const membersCount = role.members?.size ?? 0;
    const globalPerms = role.permissions?.toArray?.() || [];
    const roleId = `role-${roleIndex++}`;

    html += `
    <div class="role-item">
      <div class="role-header" onclick="toggleRole('${roleId}')">
        <div class="role-title">
          <div class="role-name" style="color: #${roleColor};">${escapeHtml(role.name)}</div>
          <div class="role-badge">${membersCount} narių</div>
          <div class="role-badge" style="background: #80848e;">${globalPerms.length} leidimai</div>
        </div>
        <div class="role-toggle" id="${roleId}-toggle">▼</div>
      </div>
      <div class="role-content" id="${roleId}">
        <div style="margin-bottom: 12px;">
          <div style="color: #b5bac1; font-size: 13px; margin-bottom: 8px;">Globalūs leidimai:</div>
          <div class="perms-grid">`;

    if (globalPerms.length > 0) {
      for (const perm of globalPerms) {
        html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
      }
    } else {
      html += `<div class="empty">Nėra globalių leidimų</div>`;
    }

    html += `
          </div>
        </div>
        <div class="channel-block">
          <div style="color: #b5bac1; font-size: 13px; margin-bottom: 12px;">Kanalų leidimai:</div>`;

    // Kiekvienam kanalui surinkime leidimus
    for (const channel of channels.values()) {
      html += `
          <div style="margin-bottom: 12px;">
            <div class="channel-title">#${escapeHtml(channel.name)}</div>
            <div class="perms-grid">`;

      try {
        const permissions = channel.permissionsFor(role);
        
        if (permissions) {
          const allowed = permissions.toArray();
          
          if (allowed.length > 0) {
            for (const perm of allowed) {
              html += `<div class="perm-tag">${escapeHtml(perm)}</div>`;
            }
          } else {
            html += `<div class="empty">Nėra leidimų</div>`;
          }
        } else {
          html += `<div class="empty">Nepavyko nustatyti</div>`;
        }
      } catch (error) {
        html += `<div class="empty">Klaida</div>`;
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
      const content = document.getElementById(id);
      const toggle = document.getElementById(id + '-toggle');
      if (content.classList.contains('active')) {
        content.classList.remove('active');
        toggle.textContent = '▼';
      } else {
        content.classList.add('active');
        toggle.textContent = '▲';
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
