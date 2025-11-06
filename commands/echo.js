const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeReply, safeDefer, deleteReplySafe } = require('../utils/responses');
const { buildEmbedFromJson } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Pakartoti pateiktą tekstą: tiesiogiai įvesti arba iš failo.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('text')
        .setDescription('Pakartoti tekstą, įvestą tiesiogiai.')
        .addStringOption((option) =>
          option
            .setName('zinute')
            .setDescription('Tekstas, kurį norite, kad botas pakartotų.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('file')
        .setDescription('Pakartoti tekstą iš failo (.txt arba .json su Discord embed formatu).')
        .addAttachmentOption((option) =>
          option
            .setName('failas')
            .setDescription('Tekstinio failo (.txt arba .json su Discord embed) prisegtukas.')
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const { ephemeral, timeoutMs } = getCommandSettings('echo');
    const subcommand = interaction.options.getSubcommand();
    let message = '';

    // Skaitome tekstą priklausomai nuo subcommand
    if (subcommand === 'text') {
      message = interaction.options.getString('zinute', true);

      // Konvertuojame literalinius \n į tikras naujas eilutes
      message = message.replace(/\\n/g, '\n');
      
      // Bandom atkurti eilutes, kurias Discord suglaudo į vieną eilutę
      message = message
        .replace(/([.!?])\s+([A-ZĄČĘĖĮŠŲŪŽ])/g, '$1\n$2')
        .replace(/([^0-9]|^)(\d+\.\s+)/g, '$1\n$2')
        .replace(/([^:])\s+([A-ZĄČĘĖĮŠŲŪŽ][^:]+:)/g, '$1\n$2')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else if (subcommand === 'file') {
      const attachment = interaction.options.getAttachment('failas', true);
      // Patikriname, ar tai tekstinis failas (.txt arba .json)
      const isTextFile = attachment.name.endsWith('.txt') || attachment.name.endsWith('.json');
      if (!isTextFile) {
        await safeReply(interaction, {
          content: '❌ Failas turi būti .txt arba .json formato.',
          ephemeral: true,
        });
        return;
      }

      // Patikriname failo dydį (max 1MB)
      if (attachment.size > 1024 * 1024) {
        await safeReply(interaction, {
          content: '❌ Failas per didelis. Maksimalus dydis: 1MB.',
          ephemeral: true,
        });
        return;
      }

      try {
        // Skaitome failo turinį
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error('Nepavyko nuskaityti failo');
        }
        const fileContent = await response.text().then(t => t.trim());
        
        // Bandome parsinti kaip JSON (Discord embed formatas)
        try {
          const jsonData = JSON.parse(fileContent);
          
          // Patikriname, ar tai Discord embed struktūra (nevertiname vien tik "description")
          if (jsonData && (jsonData.title || jsonData.fields || jsonData.color || jsonData.author || jsonData.thumbnail || jsonData.image || jsonData.footer)) {
            // Normalizuojame ir ribojame pagal Discord embed taisykles
            const embed = buildEmbedFromJson(jsonData);

            // Naudojame embed'ą
            const messageOptions = {
              embeds: [embed],
              ...(ephemeral ? { ephemeral: true } : {}),
              allowedMentions: { parse: [] },
            };

            // Siunčiame su embed'u
            if (!ephemeral) {
              await safeDefer(interaction);
              try { 
                await interaction.deleteReply(); 
              } catch (_) {}

              const sent = await interaction.channel.send(messageOptions);
              
              if (timeoutMs > 0) {
                setTimeout(() => { try { sent.delete(); } catch (_) {} }, timeoutMs);
              }
            } else {
              await safeDefer(interaction, { ephemeral: true });
              await safeReply(interaction, messageOptions);
              
              if (timeoutMs > 0) {
                setTimeout(() => {
                  deleteReplySafe(interaction);
                }, timeoutMs);
              }
            }
            return;
          }
        } catch (jsonError) {
          // Ne JSON arba ne embed formatas - naudojame kaip tekstą
        }
        
        // Jei ne embed JSON, naudojame kaip tekstą
        message = fileContent;
      } catch (error) {
        await safeReply(interaction, {
          content: '❌ Nepavyko nuskaityti failo. Patikrinkite, ar failas yra prieinamas.',
          ephemeral: true,
        });
        return;
      }
    }

    // Jei tekstas tuščias
    if (!message || message.length === 0) {
      await safeReply(interaction, {
        content: '❌ Tekstas negali būti tuščias.',
        ephemeral: true,
      });
      return;
    }

    // Jei tekstas turi daug eilučių arba yra ilgas, formatuojame kaip code block
    const lines = message.split('\n');
    if (lines.length > 3 || message.length > 200) {
      message = '```\n' + message + '\n```';
    }

    // Jei non-ephemeral: defer, ištriname, tada siunčiame į kanalą (paslėpti "+ used /echo")
    if (!ephemeral) {
      // Defer be ephemeral, tuoj pat ištriname, kad paslėpti "thinking..." žinutę
      await safeDefer(interaction);
      try { 
        await interaction.deleteReply(); 
      } catch (_) {
        // Jei nepavyko ištrinti, ignoruojame
      }

      // Siunčiame žinutę į kanalą
      const sent = await interaction.channel.send({
        content: message,
        flags: MessageFlags.SuppressEmbeds,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        embeds: [],
        components: [],
        tts: false,
      });

      // Taikome timeout iš config
      if (timeoutMs > 0) {
        setTimeout(() => { try { sent.delete(); } catch (_) {} }, timeoutMs);
      }
      return;
    }

    // Ephemeral atvejui: naudojame defer ir safeReply (kaip kitos komandos)
    await safeDefer(interaction, { ephemeral: true });
    await safeReply(interaction, {
      content: message,
      ephemeral: true,
      flags: MessageFlags.SuppressEmbeds,
      allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      embeds: [],
      components: [],
      tts: false,
    });

    // Taikome timeout iš config
    if (timeoutMs > 0) {
      setTimeout(() => {
        deleteReplySafe(interaction);
      }, timeoutMs);
    }
  },
};
