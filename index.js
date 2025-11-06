const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, PermissionFlagsBits, MessageFlags } = require('discord.js');
require('dotenv').config();

const config = require('./config.json');

const token = process.env.DISCORD_TOKEN || config.token;

if (!token || token.startsWith('PAKEISKITE')) {
  console.error('❌ Nenurodytas Discord boto tokenas. Atnaujinkite .env arba config.json.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => entry.name);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Įkelta komanda: ${command.data.name}`);
  } else {
    console.warn(`⚠️ Komandos faile ${file} trūksta būtino "data" arba "execute" eksporto.`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Prisijungta kaip ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Button handleris: taisyklių sutikimas/atsisakymas
    if (interaction.isButton()) {
      const cfg = config?.rules || {};
      const roleId = cfg.roleId;
      const kickOnReject = Boolean(cfg.kickOnReject);

      if (interaction.customId === 'rules_accept') {
        if (!roleId || roleId.startsWith('PAKEISKITE')) {
          await interaction.reply({ content: '❌ Nenurodytas roles ID konfigūracijoje.', flags: MessageFlags.Ephemeral });
          return;
        }

        const guild = interaction.guild;
        const me = guild?.members?.me;
        const member = interaction.member;

        if (!guild || !me || !member) {
          await interaction.reply({ content: '❌ Vidaus klaida (guild/me/member).', flags: MessageFlags.Ephemeral });
          return;
        }

        // 1) Negalime valdyti serverio savininko
        if (guild.ownerId === member.id) {
          await interaction.reply({ content: '❌ Negaliu priskirti rolės serverio savininkui.', flags: MessageFlags.Ephemeral });
          return;
        }

        // 2) Boto leidimai
        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({ content: '❌ Botui trūksta leidimo "Manage Roles".', flags: MessageFlags.Ephemeral });
          return;
        }

        // 3) Tikslinė rolė
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await interaction.reply({ content: '❌ Nurodyta rolė nerasta serveryje.', flags: MessageFlags.Ephemeral });
          return;
        }

        // 4) Ar rolė valdoma botui (pozicija žemiau už boto aukščiausią)?
        if (!role.editable) {
          await interaction.reply({ content: '❌ Negaliu priskirti šios rolės (rolės pozicija aukščiau už boto).', flags: MessageFlags.Ephemeral });
          return;
        }

        // 5) Nario hierarchija: boto aukščiausia rolė turi būti aukščiau už nario aukščiausią
        const botTop = me.roles.highest?.position ?? 0;
        const memberTop = member.roles.highest?.position ?? 0;
        if (botTop <= memberTop) {
          await interaction.reply({ content: '❌ Negaliu priskirti rolės šiam nariui (boto rolė žemiau arba lygi nario aukščiausiai).', flags: MessageFlags.Ephemeral });
          return;
        }

        try {
          await member.roles.add(role, 'Sutiko su taisyklėmis');
          await interaction.reply({ content: '✅ Rolė priskirta. Sveiki prisijungę!', flags: MessageFlags.Ephemeral });
        } catch (e) {
          const code = e?.code || e?.rawError?.code;
          if (code === 50013) {
            await interaction.reply({ content: '❌ Trūksta leidimų priskirti šią rolę (50013).', flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: '❌ Nepavyko priskirti rolės. Patikrinkite leidimus ir hierarchiją.', flags: MessageFlags.Ephemeral });
          }
        }
        return;
      }

      if (interaction.customId === 'rules_reject') {
        if (!kickOnReject) {
          await interaction.reply({ content: '❌ „No“ mygtukas šiuo metu nieko neatlieka.', flags: MessageFlags.Ephemeral });
          return;
        }
        const member = interaction.member;
        if (!member || !member.kickable) {
          await interaction.reply({ content: '❌ Negaliu pašalinti šio nario (leidimai/hierarchija).', flags: MessageFlags.Ephemeral });
          return;
        }
        try {
          await interaction.reply({ content: '👋 Atsisakėte taisyklių – būsite pašalinti.', flags: MessageFlags.Ephemeral });
          await member.kick('Atsisakė taisyklių (rules_reject)');
        } catch (e) {
          // jei nepavyko, bent informuojame
        }
        return;
      }
      return;
    }

    // Slash komandos
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`❔ Komanda ${interaction.commandName} nerasta.`);
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    console.error(`💥 Klaida InteractionCreate metu:`, error);
    try {
      if (interaction.replied) {
        await interaction.followUp({ content: 'Įvyko klaida. Bandykite vėliau.', flags: MessageFlags.Ephemeral });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: 'Įvyko klaida. Bandykite vėliau.' });
      } else {
        await interaction.reply({ content: 'Įvyko klaida. Bandykite vėliau.', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
});

client.login(token);
