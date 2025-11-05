async function safeDefer(interaction, replyInit) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(replyInit);
    }
  } catch (_) {}
}

async function safeReply(interaction, contentOrOptions, replyInit) {
  try {
    const options = typeof contentOrOptions === 'string' ? { content: contentOrOptions, ...(replyInit || {}) } : contentOrOptions;
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


