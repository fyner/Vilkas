let config;
try {
  config = require('../config.json');
} catch (error) {
  // Negalime naudoti getConsoleMessage, nes config dar neįkrautas
  console.error('❌ Nepavyko nuskaityti config.json failo utils/settings.js. Naudojami numatytieji nustatymai.');
  config = {};
}

function getCommandSettings(commandName) {
  const perCommand = config?.commands ? config.commands[commandName] : undefined;

  // Jei nenurodyta komandos konfigūracija – saugūs numatytieji
  if (!perCommand) {
    return { ephemeral: false, timeoutMs: 0 };
  }

  const ephemeral = Boolean(perCommand.ephemeral === true);
  const timeoutMs = Math.max(0, Number(perCommand.timeoutSeconds || 0) * 1000);

  return { ephemeral, timeoutMs };
}

module.exports = { getCommandSettings };


