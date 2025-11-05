function hasBotPerm(channel, clientUserId, perm) {
  const perms = channel?.permissionsFor?.(clientUserId);
  return Boolean(perms && perms.has(perm));
}

module.exports = { hasBotPerm };


