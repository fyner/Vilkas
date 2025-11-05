const config = require('../config.json');

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


