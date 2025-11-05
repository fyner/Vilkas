const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { getCommandSettings } = require('../utils/settings');
const { safeDefer, safeReply, deleteReplySafe } = require('../utils/responses');
const { hasBotPerm, PermissionFlagsBits: PermBits } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Ištrinti žinutes šiame kanale')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
      await safeReply(interaction, 'Šioje vietoje negalima trinti žinučių.', replyInit);
      return;
    }

    // Boto leidimų patikra
    const botId = interaction.client.user.id;
    if (!hasBotPerm(interaction.channel, botId, PermBits.ManageMessages)) {
      await safeReply(interaction, '❌ Trūksta leidimo „Manage Messages“.', replyInit);
      return;
    }

    if (sub === 'amount') {
      const amount = interaction.options.getInteger('kiekis', true);

      // Greita patikra ar yra bent 1 žinutė kanale
      const probe = await interaction.channel.messages.fetch({ limit: 1 }).catch(() => null);
      if (!probe || probe.size === 0) {
        await safeReply(interaction, 'ℹ️ Šiame kanale nėra žinučių trynimui.', replyInit);
        return;
      }

      // Defer tik jei ephemeral; viešam atsakymui geriau nedeferinti, kad atsakymas nebūtų ištrintas kartu su bulkDelete
      if (useEphemeral) {
        await safeDefer(interaction, replyInit);
      }

      try {
        const deleted = await interaction.channel.bulkDelete(amount, true);
        const msg = (!deleted || deleted.size === 0)
          ? 'ℹ️ Nerasta naujų žinučių trynimui.'
          : `🧹 Ištrinta žinučių: ${deleted.size}.`;
        await safeReply(interaction, msg, replyInit);

        // Jei nefemeral – taikome bendrą timeout iš config
        if (!useEphemeral && timeoutMs > 0) {
          setTimeout(() => {
            deleteReplySafe(interaction);
          }, timeoutMs);
        }
      } catch (err) {
        await safeReply(interaction, '❌ Nepavyko ištrinti žinučių. Įsitikinkite, kad turiu leidimus ir bandykite dar kartą.', replyInit);
      }
      return;
    }

    if (sub === 'all') {
      // Triname visas žinutes kanale, nekeisdami kanalo
      if (interaction.channel.type !== ChannelType.GuildText) {
        await safeReply(interaction, 'Šią operaciją galima atlikti tik gildijos tekstiniuose kanaluose.', replyInit);
        return;
      }

      // Greita patikra ar yra bent 1 žinutė kanale
      const probe = await interaction.channel.messages.fetch({ limit: 1 }).catch(() => null);
      if (!probe || probe.size === 0) {
        await safeReply(interaction, 'ℹ️ Šiame kanale nėra žinučių trynimui.', replyInit);
        return;
      }

      // Defer tik jei ephemeral; viešam atsakymui geriau nedeferinti, kad atsakymas nebūtų ištrintas kartu su bulkDelete
      if (useEphemeral) {
        await safeDefer(interaction, replyInit);
      }

      const channel = interaction.channel;
      let totalDeleted = 0;
      try {
        // 1) Kiek įmanoma per bulkDelete (tik iki 14 dienų senumo)
        // Kartojame, kol nebėra ką trinti arba grąžina 0
        while (true) {
          const deleted = await channel.bulkDelete(100, true);
          if (!deleted || deleted.size === 0) break;
          totalDeleted += deleted.size;
        }

        // 2) Senesnės žinutės: imame partijomis ir triname individualiai
        // Saugant rate limitus – nedarome agresyviai, bet pakanka testiniam naudojimui
        let lastId = undefined;
        while (true) {
          const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
          if (fetched.size === 0) break;

          for (const msg of fetched.values()) {
            try {
              await msg.delete();
              totalDeleted += 1;
            } catch (e) {
              // Ignoruojame atskiras klaidas, tęsiame
            }
          }

          lastId = fetched.lastKey();
        }

        const msg = (totalDeleted === 0)
          ? 'ℹ️ Šiame kanale nerasta žinučių trynimui.'
          : `🧹 Ištrinta žinučių: ${totalDeleted}.`;
        await safeReply(interaction, msg, replyInit);

        if (!useEphemeral && timeoutMs > 0) {
          setTimeout(() => {
            deleteReplySafe(interaction);
          }, timeoutMs);
        }
      } catch (err) {
        await safeReply(interaction, '❌ Nepavyko ištrinti visų žinučių. Patikrinkite leidimus „Manage Messages“.', replyInit);
      }
      return;
    }
  },
};


