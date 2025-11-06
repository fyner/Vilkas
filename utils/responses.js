const { MessageFlags } = require('discord.js');

function normalizeEphemeral(init) {
  if (!init) return init;
  const options = { ...init };
  if (options.ephemeral) {
    const current = typeof options.flags === 'number' ? options.flags : 0;
    options.flags = current | MessageFlags.Ephemeral;
    delete options.ephemeral;
  }
  return options;
}

async function safeDefer(interaction, replyInit) {
  try {
    const normalized = normalizeEphemeral(replyInit);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(normalized);
    }
  } catch (_) {}
}

async function safeReply(interaction, contentOrOptions, replyInit) {
  try {
    const base = typeof contentOrOptions === 'string' ? { content: contentOrOptions, ...(replyInit || {}) } : contentOrOptions;
    const options = normalizeEphemeral(base);
    if (interaction.replied) {
      return await interaction.followUp(options);
    }
    if (interaction.deferred) {
      return await interaction.editReply(options);
    }
    return await interaction.reply(options);
  } catch (_) {
    return undefined;
  }
}

async function deleteReplySafe(interaction) {
  try {
    await interaction.deleteReply();
  } catch (_) {}
}

module.exports = { safeDefer, safeReply, deleteReplySafe };


