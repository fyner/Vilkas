const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { safeReply } = require('./utils/responses');
const { createEmbedFromMessage } = require('./utils/embeds');
const { getMessage, getSystemMessage, getConsoleMessage } = require('./utils/messages');
require('dotenv').config();

let config;
try {
  config = require('./config.json');
} catch (error) {
  // Negalime naudoti getConsoleMessage, nes config dar neįkrautas
  console.error('❌ Nepavyko nuskaityti config.json failo. Įsitikinkite, kad failas egzistuoja ir yra teisingo formato.');
  process.exit(1);
}

const token = process.env.DISCORD_TOKEN || config.token;

if (!token || token.startsWith('PAKEISKITE')) {
  console.error(getConsoleMessage('tokenMissing'));
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
    console.log(getConsoleMessage('commandLoaded').replace('{name}', command.data.name));
  } else {
    console.warn(getConsoleMessage('commandMissingExport').replace('{file}', file));
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(getConsoleMessage('botReady').replace('{tag}', readyClient.user.tag));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Button handleris: taisyklių sutikimas/atsisakymas
    if (interaction.isButton()) {
      const cfg = config?.rules || {};
      const roleId = cfg.roleId;
      const kickOnReject = Boolean(cfg.kickOnReject);
      const welcomeChannelId = cfg.welcomeChannelId;

      if (interaction.customId === 'rules_accept') {
        
        if (!roleId || roleId.startsWith('PAKEISKITE')) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.roleIdNotSet'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        const guild = interaction.guild;
        const me = guild?.members?.me;
        const member = interaction.member;

        if (!guild || !me || !member) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.internal'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        // 1) Negalime valdyti serverio savininko
        if (guild.ownerId === member.id) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.ownerRole'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        // 2) Boto leidimai
        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.botPermission'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        // 3) Tikslinė rolė
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.roleNotFound'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        // 4) Ar rolė valdoma botui (pozicija žemiau už boto aukščiausią)?
        if (!role.editable) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.roleNotEditable'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        // 5) Nario hierarchija: boto aukščiausia rolė turi būti aukščiau už nario aukščiausią
        const botTop = me.roles.highest?.position ?? 0;
        const memberTop = member.roles.highest?.position ?? 0;
        if (botTop <= memberTop) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.memberHierarchy'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        try {
          const auditLogReason = getMessage('rules', 'system.auditLogReason');
          await member.roles.add(role, auditLogReason);
          
          // NEBETRINAME žinučių rules kanale, nes:
          // 1. Taisyklių žinutė su mygtukais turi likti, kad kiti vartotojai galėtų matyti taisykles
          // 2. Vartotojas, kuris gavo rolę, automatiškai nebegalės matyti rules kanalo,
          //    jei suteiktai rolei nėra ViewChannel leidimo rules kanale
          // 3. Jei vartotojas vis tiek mato kanalą (pvz., @everyone turi ViewChannel),
          //    tai yra serverio nustatymų problema, ne boto
          
          // PIRMIAUSIA atsakome į interaction, kad Discord nebetraktų žinučių kaip interaction reply
          let successMessage = getMessage('rules', 'success.roleAssigned');
          if (welcomeChannelId && typeof welcomeChannelId === 'string' && welcomeChannelId.trim().length > 0) {
            try {
              const welcomeChannel = guild.channels.cache.get(welcomeChannelId) || await guild.channels.fetch(welcomeChannelId).catch(() => null);
              if (welcomeChannel) {
                const canView = welcomeChannel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel);
                if (canView) {
                  const linkMsg = getSystemMessage('welcomeChannelLink');
                  successMessage += linkMsg.replace('{channel}', welcomeChannel.toString());
                }
              }
            } catch (_) {
              // Ignoruojame klaidas
            }
          }
          
          const embed = createEmbedFromMessage(successMessage, 'success');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          
          // DABAR, kai interaction yra atsakyta, siunčiame žinutę į welcome kanalą
          // Tai užtikrina, kad žinutė būtų normali vieša žinutė, ne susijusi su interaction
          if (welcomeChannelId && typeof welcomeChannelId === 'string' && welcomeChannelId.trim().length > 0) {
            try {
              const welcomeChannel = guild.channels.cache.get(welcomeChannelId) || await guild.channels.fetch(welcomeChannelId).catch(() => null);
              if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
                // Gauname welcome embed nustatymus iš config
                const welcomeEmbedConfig = cfg.welcomeEmbed || {};
                // Spalva gali būti hex string (pvz., "0x2b2d31") arba skaičius
                const defaultColorValue = config?.embeds?.defaultColor;
                const defaultColor = defaultColorValue ? (typeof defaultColorValue === 'string' ? parseInt(defaultColorValue, 16) : defaultColorValue) : 0x2b2d31; // Fallback: Discord default color
                const welcomeColorValue = welcomeEmbedConfig.color;
                const embedColor = welcomeColorValue ? (typeof welcomeColorValue === 'string' ? parseInt(welcomeColorValue, 16) : welcomeColorValue) : defaultColor;
                const embedTitle = welcomeEmbedConfig.title || getSystemMessage('welcomeTitleFallback');
                
                // Gauname rolės informaciją
                const assignedRole = guild.roles.cache.get(roleId);
                const roleMention = assignedRole ? assignedRole.toString() : getSystemMessage('roleFallback');
                
                // Pakeičiame placeholder'ius description tekste
                let embedDescription = welcomeEmbedConfig.description || '';
                embedDescription = embedDescription.replace('{member}', member.toString());
                embedDescription = embedDescription.replace('{role}', roleMention);
                
                // Siunčiame embed žinutę į welcome kanalą kaip normalią viešą žinutę
                const welcomeEmbed = new EmbedBuilder()
                  .setColor(embedColor)
                  .setTitle(embedTitle)
                  .setDescription(embedDescription)
                  .setTimestamp();
                
                // Siunčiame normalią viešą žinutę į welcome kanalą
                // Naudojame tiesioginį channel.send() PO to, kai interaction yra atsakyta
                const sentMessage = await welcomeChannel.send({ 
                  content: member.toString(),
                  embeds: [welcomeEmbed],
                  allowedMentions: { parse: ['users'] }
                }).catch((err) => {
                  console.error(getConsoleMessage('welcomeSendError'), err);
                  return null;
                });
                
                // Jei žinutė sėkmingai išsiųsta, pritaikome timeout (jei nustatyta)
                if (sentMessage) {
                  const timeoutSeconds = cfg.welcomeMessageTimeoutSeconds ?? 0;
                  if (timeoutSeconds > 0) {
                    const timeoutMs = timeoutSeconds * 1000;
                    setTimeout(() => {
                      sentMessage.delete().catch((err) => {
                        // Ignoruojame klaidas trinant žinutę (pvz., jei jau ištrinta)
                        console.error(getConsoleMessage('welcomeDeleteError'), err);
                      });
                    }, timeoutMs);
                  }
                }
              }
            } catch (err) {
              console.error(getConsoleMessage('welcomeSendError'), err);
            }
          }
        } catch (e) {
          const code = e?.code || e?.rawError?.code;
          if (code === 50013) {
            const embed = createEmbedFromMessage(getMessage('rules', 'errors.permission50013'), 'error');
            await safeReply(interaction, { embeds: [embed], ephemeral: true });
          } else {
            const embed = createEmbedFromMessage(getMessage('rules', 'errors.roleAssign'), 'error');
            await safeReply(interaction, { embeds: [embed], ephemeral: true });
          }
        }
        return;
      }

      if (interaction.customId === 'rules_reject') {
        if (!kickOnReject) {
          const embed = createEmbedFromMessage(getMessage('rules', 'system.rejectDisabled'), 'info');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }
        const member = interaction.member;
        if (!member || !member.kickable) {
          const embed = createEmbedFromMessage(getMessage('rules', 'errors.kickMember'), 'error');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }
        try {
          const embed = createEmbedFromMessage(getMessage('rules', 'success.rejectMessage'), 'info');
          await safeReply(interaction, { embeds: [embed], ephemeral: true });
          
          const kickReason = getMessage('rules', 'system.kickReason');
          await member.kick(kickReason);
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
      console.warn(getConsoleMessage('commandNotFound').replace('{name}', interaction.commandName));
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    console.error(getConsoleMessage('interactionError'), error);
    try {
      const embed = createEmbedFromMessage(getMessage('rules', 'errors.generic'), 'error');
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
    } catch (_) {
      // Ignoruojame klaidas, jei nepavyko atsakyti
    }
  }
});

client.login(token);
