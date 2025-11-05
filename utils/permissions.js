const { PermissionFlagsBits } = require('discord.js');

function hasBotPerm(channel, clientUserId, perm) {
  const perms = channel?.permissionsFor?.(clientUserId);
  return Boolean(perms && perms.has(perm));
}

module.exports = { hasBotPerm, PermissionFlagsBits };


