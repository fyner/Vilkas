const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Rodo visas prieinamas komandas su aprašymais.'),

  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('help');
    
    if (ephemeral) {
      await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    }

    // Detalus aprašymas visoms komandoms (išskyrus help)
    const commands = {
      'ping': {
        category: 'Utility',
        description: 'Parodo boto ping laiką',
        params: [],
      },
      'echo text': {
        category: 'Utility',
        description: 'Pakartoja tekstą, įvestą tiesiogiai',
        params: [
          '`zinute:<tekstas>` — tekstas, kurį norite pakartoti',
        ],
      },
      'echo file': {
        category: 'Utility',
        description: 'Pakartoja tekstą iš failo',
        params: [
          '`failas:<failas>` — .txt arba .json failas (palaiko Discord embed formatą)',
        ],
      },
      'serverinfo': {
        category: 'Informacija',
        description: 'Rodo serverio informaciją',
        params: [],
      },
      'userinfo': {
        category: 'Informacija',
        description: 'Rodo vartotojo informaciją',
        params: [
          '`vartotojas` — pasirenkamas vartotojas (jei nenurodysite, rodys jus)',
        ],
      },
      'roleinfo': {
        category: 'Informacija',
        description: 'Eksportuoja HTML failą su rolės leidimais visuose kanaluose',
        params: [
          '`role` — rolė (pasirenkama - jei nenurodysite, eksportuos visas roles)',
        ],
      },
      'purge': {
        category: 'Moderavimas',
        description: 'Ištrina žinutes kanale',
        params: [
          '`amount` `kiekis:<1-100>` — ištrina paskutines N žinučių',
          '`all` — ištrina visas žinutes kanale',
        ],
        note: 'Reikia leidimo "Manage Messages"',
      },
    };

    // Sukuriame modernų, minimalistinį embed
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Komandos')
      .setDescription('Visos prieinamos komandos su parametrais')
      .setTimestamp();

    // Grupuojame pagal kategorijas
    const categorized = {};
    for (const [name, info] of Object.entries(commands)) {
      if (!categorized[info.category]) {
        categorized[info.category] = [];
      }
      categorized[info.category].push({ name, ...info });
    }

    // Pridedame kategorijas su minimalistiniu dizainu
    for (const [categoryName, categoryCommands] of Object.entries(categorized)) {
      let categoryText = '';
      
      for (const cmd of categoryCommands) {
        categoryText += `\`/${cmd.name}\`\n`;
        categoryText += `${cmd.description}\n`;
        
        if (cmd.note) {
          categoryText += `*${cmd.note}*\n`;
        }
        
        if (cmd.params && cmd.params.length > 0) {
          for (const param of cmd.params) {
            categoryText += `  ${param}\n`;
          }
        }
        categoryText += '\n';
      }
      
      embed.addFields({
        name: categoryName,
        value: categoryText.trim(),
        inline: false,
      });
    }

    embed.setFooter({ text: 'Vilkas' });

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

