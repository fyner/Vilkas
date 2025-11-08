const { PermissionFlagsBits } = require('discord.js');
const { getConsoleMessage } = require('./messages');

function hasBotPerm(channel, clientUserId, perm) {
  if (!channel || !clientUserId) return false;
  
  try {
    const perms = channel.permissionsFor(clientUserId);
    if (!perms) return false;
    
    // Jei botas turi Administrator teises, automatiškai turi visus leidimus
    if (perms.has(PermissionFlagsBits.Administrator)) {
      return true;
    }
    
    // Tikriname konkretų leidimą
    return perms.has(perm);
  } catch (error) {
    console.error(getConsoleMessage('permissionsCheckError'), error);
    return false;
  }
}

module.exports = { hasBotPerm };


