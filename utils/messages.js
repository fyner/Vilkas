let config;
try {
  config = require('../config.json');
} catch (error) {
  config = {};
}

/**
 * Gauna žinutę iš config.json pagal raktą
 * @param {string} commandName - Komandos pavadinimas (pvz., 'rules', 'purge')
 * @param {string} key - Žinutės raktas (pvz., 'errors.roleIdNotSet' arba 'success.roleAssigned')
 * @returns {string} Žinutės tekstas arba klaidos pranešimas, jei žinutė nerasta
 */
function getMessage(commandName, key) {
  const commandMessages = config?.messages?.[commandName] || {};
  
  // Palaiikome nested key struktūrą (pvz., 'errors.roleIdNotSet')
  const keys = key.split('.');
  let value = commandMessages;
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  // Patikriname ar reikšmė egzistuoja ir yra ne tuščias string
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    const fallbackMsg = config?.system?.messages?.configMissing;
    if (fallbackMsg) {
      return fallbackMsg.replace('{key}', `messages.${commandName}.${key}`);
    }
    // Minimalus fallback, jei config nepasiekiamas
    return `❌ Trūksta konfigūracijos: messages.${commandName}.${key}`;
  }
  
  return value;
}

/**
 * Gauna sisteminę žinutę iš config.json
 * @param {string} key - Žinutės raktas (pvz., 'configMissing', 'welcomeChannelLink')
 * @returns {string} Žinutės tekstas arba klaidos pranešimas, jei žinutė nerasta
 */
function getSystemMessage(key) {
  const systemMessages = config?.system?.messages || {};
  const value = systemMessages[key];
  
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return `❌ Trūksta konfigūracijos: system.messages.${key}`;
  }
  
  return value;
}

/**
 * Gauna console žinutę iš config.json
 * @param {string} key - Žinutės raktas (pvz., 'configLoadError', 'tokenMissing')
 * @returns {string} Žinutės tekstas arba klaidos pranešimas, jei žinutė nerasta
 */
function getConsoleMessage(key) {
  const consoleMessages = config?.system?.console || {};
  const value = consoleMessages[key];
  
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    // Minimalus fallback, jei config nepasiekiamas
    return `❌ Trūksta konfigūracijos: system.console.${key}`;
  }
  
  return value;
}

module.exports = { getMessage, getSystemMessage, getConsoleMessage };

