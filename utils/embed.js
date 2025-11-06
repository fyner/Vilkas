const { EmbedBuilder } = require('discord.js');

function buildEmbedFromJson(json) {
  const embed = new EmbedBuilder();

  const LIMITS = {
    title: 256,
    description: 4096,
    fieldName: 256,
    fieldValue: 1024,
    footerText: 2048,
    authorName: 256,
    fieldsMax: 25,
    total: 6000,
  };

  const truncate = (val, max) => {
    if (typeof val !== 'string') return val;
    return val.length > max ? val.slice(0, max) : val;
  };

  let totalChars = 0;
  const addCount = (str) => {
    const len = typeof str === 'string' ? str.length : 0;
    totalChars += len;
    return len;
  };

  if (typeof json.title === 'string') {
    let v = truncate(json.title, LIMITS.title);
    addCount(v);
    embed.setTitle(v);
  }

  if (typeof json.description === 'string') {
    let v = truncate(json.description, LIMITS.description);
    if (totalChars + v.length > LIMITS.total) {
      v = v.slice(0, Math.max(0, LIMITS.total - totalChars));
    }
    addCount(v);
    embed.setDescription(v);
  }

  if (typeof json.url === 'string') {
    try { embed.setURL(json.url); } catch (_) {}
  }

  if (json.timestamp) {
    try { embed.setTimestamp(new Date(json.timestamp)); } catch (_) {}
  }

  if (typeof json.color === 'number' || typeof json.color === 'string') {
    try { embed.setColor(json.color); } catch (_) {}
  }

  if (json.author && typeof json.author === 'object') {
    const author = {
      name: typeof json.author.name === 'string' ? truncate(json.author.name, LIMITS.authorName) : undefined,
      url: typeof json.author.url === 'string' ? json.author.url : undefined,
      iconURL: typeof json.author.icon_url === 'string' ? json.author.icon_url : (typeof json.author.iconURL === 'string' ? json.author.iconURL : undefined),
    };
    if (author.name) {
      addCount(author.name);
      try { embed.setAuthor(author); } catch (_) {}
    }
  }

  if (json.thumbnail && typeof json.thumbnail === 'object' && typeof json.thumbnail.url === 'string') {
    try { embed.setThumbnail(json.thumbnail.url); } catch (_) {}
  }

  if (json.image && typeof json.image === 'object' && typeof json.image.url === 'string') {
    try { embed.setImage(json.image.url); } catch (_) {}
  }

  if (json.footer && typeof json.footer === 'object') {
    const footer = {
      text: typeof json.footer.text === 'string' ? truncate(json.footer.text, LIMITS.footerText) : undefined,
      iconURL: typeof json.footer.icon_url === 'string' ? json.footer.icon_url : (typeof json.footer.iconURL === 'string' ? json.footer.iconURL : undefined),
    };
    if (footer.text) {
      addCount(footer.text);
      try { embed.setFooter(footer); } catch (_) {}
    }
  }

  if (Array.isArray(json.fields) && json.fields.length > 0) {
    const limited = json.fields.slice(0, LIMITS.fieldsMax);
    const resultFields = [];
    for (const f of limited) {
      if (!f || typeof f !== 'object') continue;
      if (typeof f.name !== 'string' || typeof f.value !== 'string') continue;
      let name = truncate(f.name, LIMITS.fieldName);
      let value = truncate(f.value, LIMITS.fieldValue);

      if (totalChars + name.length + value.length > LIMITS.total) {
        let remain = Math.max(0, LIMITS.total - totalChars);
        if (remain <= 0) break;
        if (value.length > remain) {
          value = value.slice(0, remain);
          remain = 0;
        } else {
          remain -= value.length;
        }
        if (remain > 0 && name.length > remain) {
          name = name.slice(0, remain);
          remain = 0;
        }
      }

      addCount(name);
      addCount(value);
      resultFields.push({ name, value, inline: Boolean(f.inline) });
      if (totalChars >= LIMITS.total) break;
    }
    if (resultFields.length > 0) {
      try { embed.addFields(resultFields); } catch (_) {}
    }
  }

  return embed;
}

module.exports = { buildEmbedFromJson };


