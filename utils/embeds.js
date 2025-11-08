const { EmbedBuilder } = require('discord.js');

/**
 * Sukuria embed iš pranešimo teksto
 * @param {string} messageText - Pranešimo tekstas su emoji ir formatavimu
 * @param {string} type - Pranešimo tipas: 'error', 'success', 'info', 'warning'
 * @returns {EmbedBuilder} Discord embed objektas
 */
function createEmbedFromMessage(messageText, type = 'info') {
  if (!messageText || typeof messageText !== 'string') {
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription('❌ **Klaida**\n\nNepavyko sukurti pranešimo.');
  }

  // Nustatome spalvą pagal tipą
  const colors = {
    error: 0xED4245,      // Raudona
    success: 0x57F287,    // Žalia
    info: 0x5865F2,       // Mėlyna
    warning: 0xFEE75C,    // Geltona
  };
  const color = colors[type] || colors.info;

  // Parsiname pranešimą
  const lines = messageText.split('\n').filter(line => line.trim().length > 0);
  
  let title = '';
  let description = '';
  let emoji = '';

  // Ieškome antraštės (pirmoji eilutė su emoji ir **bold**)
  if (lines.length > 0) {
    const firstLine = lines[0];
    // Ieškome emoji (bet koks emoji pradžioje)
    const emojiMatch = firstLine.match(/^(\p{Emoji}+)\s*/u);
    if (emojiMatch) {
      emoji = emojiMatch[1];
    }
    
    // Ieškome bold teksto (**tekstas**)
    const boldMatch = firstLine.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      title = boldMatch[1];
    } else {
      // Jei nėra bold, naudojame visą eilutę be emoji
      title = firstLine.replace(/^(\p{Emoji}+)\s*/u, '').trim();
    }
  }

  // Likęs tekstas yra aprašymas
  if (lines.length > 1) {
    description = lines.slice(1).join('\n');
  }

  // Sukuriame embed'ą
  const embed = new EmbedBuilder()
    .setColor(color);

  if (title) {
    embed.setTitle(emoji ? `${emoji} ${title}` : title);
  }

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

module.exports = { createEmbedFromMessage };

