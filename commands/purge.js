const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeDefer, safeReply, deleteReplySafe } = require('../utils/responses');
const { hasBotPerm } = require('../utils/permissions');
const { createEmbedFromMessage } = require('../utils/embeds');
const { getMessage } = require('../utils/messages');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Ištrinti žinutes šiame kanale')
    // Leidimai valdomi per Discord Application Commands permissions, ne per setDefaultMemberPermissions
    .addSubcommand((sub) =>
      sub
        .setName('amount')
        .setDescription('Ištrinti paskutines N žinučių (1–100)')
        .addIntegerOption((opt) =>
          opt
            .setName('kiekis')
            .setDescription('Kiek žinučių ištrinti (1–100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('all')
        .setDescription('Ištrinti visas žinutes šiame kanale (gali užtrukti)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { ephemeral: useEphemeral, timeoutMs } = getCommandSettings('purge');

    const replyInit = useEphemeral ? { flags: MessageFlags.Ephemeral } : undefined;

    if (!interaction.channel || !interaction.channel.isTextBased()) {
      const embed = createEmbedFromMessage(getMessage('purge', 'errors.notTextChannel'), 'error');
      await safeReply(interaction, { embeds: [embed], ...replyInit });
      return;
    }

    // Boto leidimų patikra - botas turi turėti ManageMessages leidimą, kad galėtų trinti žinutes
    const botId = interaction.client.user.id;
    if (!hasBotPerm(interaction.channel, botId, PermissionFlagsBits.ManageMessages)) {
      const embed = createEmbedFromMessage(getMessage('purge', 'errors.noPermission'), 'error');
      await safeReply(interaction, { embeds: [embed], ...replyInit });
      return;
    }
    
    // Vartotojo leidimų patikra - vartotojas turi turėti ManageMessages leidimą arba Administrator teises
    const member = interaction.member;
    if (member) {
      const memberPerms = interaction.channel.permissionsFor(member);
      if (memberPerms) {
        const hasManageMessages = memberPerms.has(PermissionFlagsBits.ManageMessages);
        const hasAdministrator = memberPerms.has(PermissionFlagsBits.Administrator);
        if (!hasManageMessages && !hasAdministrator) {
          const embed = createEmbedFromMessage(getMessage('purge', 'errors.noPermission'), 'error');
          await safeReply(interaction, { embeds: [embed], ...replyInit });
          return;
        }
      }
    }

    if (sub === 'amount') {
      const amount = interaction.options.getInteger('kiekis', true);

      // Defer tik jei ephemeral; viešam atsakymui geriau nedeferinti, kad atsakymas nebūtų ištrintas kartu su bulkDelete
      if (useEphemeral) {
        await safeDefer(interaction, replyInit);
      }

      try {
        // Prieš trinimą patikriname, kiek žinučių iš tikrųjų yra kanale (iki amount)
        const messagesBefore = await interaction.channel.messages.fetch({ limit: amount });
        const actualMessageCount = messagesBefore.size;
        
        // Triname žinutes
        const deleted = await interaction.channel.bulkDelete(amount, true);
        const deletedCount = deleted?.size || 0;
        
        // Skaičiuojame neistrintas žinutes:
        // - Jei kanale buvo mažiau žinučių nei prašėme, notDeleted = 0 (nes iš viso nebuvo tiek žinučių)
        // - Jei kanale buvo tiek žinučių kiek prašėme, bet ištrinta mažiau, notDeleted = actualMessageCount - deletedCount
        const notDeleted = actualMessageCount < amount 
          ? 0 
          : Math.max(0, actualMessageCount - deletedCount);
        
        let msg;
        let embedType = 'info';
        if (deletedCount === 0) {
          msg = getMessage('purge', 'results.none');
        } else {
          msg = getMessage('purge', 'results.amount')
            .replace('{deleted}', deletedCount)
            .replace('{notDeleted}', notDeleted);
          embedType = 'success';
        }
        
        const embed = createEmbedFromMessage(msg, embedType);
        await safeReply(interaction, { embeds: [embed], ...replyInit });

        // Taikome timeout iš config (veikia ir ephemeral, ir non-ephemeral)
        if (timeoutMs > 0) {
          setTimeout(() => {
            deleteReplySafe(interaction);
          }, timeoutMs);
        }
      } catch (err) {
        const embed = createEmbedFromMessage(getMessage('purge', 'errors.deleteFailed'), 'error');
        await safeReply(interaction, { embeds: [embed], ...replyInit });
      }
      return;
    }

    if (sub === 'all') {
      // Triname visas žinutes kanale, nekeisdami kanalo
      if (interaction.channel.type !== ChannelType.GuildText) {
        const embed = createEmbedFromMessage(getMessage('purge', 'errors.notGuildText'), 'error');
        await safeReply(interaction, { embeds: [embed], ...replyInit });
        return;
      }

      // Defer tik jei ephemeral; viešam atsakymui geriau nedeferinti, kad atsakymas nebūtų ištrintas kartu su bulkDelete
      if (useEphemeral) {
        await safeDefer(interaction, replyInit);
      }

      const channel = interaction.channel;
      let totalDeleted = 0;
      try {
        // 1) Kiek įmanoma per bulkDelete (tik iki N dienų senumo, iš config.json)
        // Kartojame, kol nebėra ką trinti arba grąžina 0
        const bulkDeleteLimit = config?.limits?.bulkDeleteMaxMessages ?? 100;
        let bulkIterations = 0;
        const maxBulkIterations = 100; // Saugiklis nuo begalinio ciklo (maksimalus 10,000 žinučių per bulkDelete)
        while (bulkIterations < maxBulkIterations) {
          const deleted = await channel.bulkDelete(bulkDeleteLimit, true);
          if (!deleted || deleted.size === 0) break;
          totalDeleted += deleted.size;
          bulkIterations++;
        }

        // 2) Senesnės žinutės: imame partijomis ir triname individualiai
        // Saugant rate limitus – nedarome agresyviai, bet pakanka testiniam naudojimui
        const fetchLimit = config?.limits?.messageFetchLimit ?? 100;
        let lastId = undefined;
        let iterations = 0;
        const maxIterations = 1000; // Saugiklis nuo begalinio ciklo (maksimalus 100,000 žinučių)
        while (iterations < maxIterations) {
          const fetched = await channel.messages.fetch({ limit: fetchLimit, before: lastId });
          if (fetched.size === 0) break;

          for (const msg of fetched.values()) {
            try {
              await msg.delete();
              totalDeleted += 1;
            } catch (e) {
              // Ignoruojame atskiras klaidas, tęsiame
            }
          }

          const newLastId = fetched.lastKey();
          // Saugiklis: jei lastId nepasikeitė, nutraukiame ciklą
          if (!newLastId || newLastId === lastId) break;
          lastId = newLastId;
          iterations++;
        }

        const msg = (totalDeleted === 0)
          ? getMessage('purge', 'results.none')
          : getMessage('purge', 'results.all').replace('{deleted}', totalDeleted);
        const embedType = totalDeleted === 0 ? 'info' : 'success';
        const embed = createEmbedFromMessage(msg, embedType);
        await safeReply(interaction, { embeds: [embed], ...replyInit });

        // Taikome timeout iš config (veikia ir ephemeral, ir non-ephemeral)
        if (timeoutMs > 0) {
          setTimeout(() => {
            deleteReplySafe(interaction);
          }, timeoutMs);
        }
      } catch (err) {
        const embed = createEmbedFromMessage(getMessage('purge', 'errors.deleteFailed'), 'error');
        await safeReply(interaction, { embeds: [embed], ...replyInit });
      }
      return;
    }
  },
};


