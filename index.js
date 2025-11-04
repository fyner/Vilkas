require('dotenv').config();
const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');

const { prefix: nustatytasPrefiksas = '!' } = require('./config.json');
const prefix = typeof nustatytasPrefiksas === 'string' && nustatytasPrefiksas.trim().length > 0
  ? nustatytasPrefiksas.trim()
  : '!';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN aplinkos kintamasis nerastas. Įrašykite jį į .env failą.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const commands = {
  ping: {
    aprašymas: 'Patikrina boto reakcijos laiką.',
    async vykdyti(message) {
      const atsakymas = await message.reply('⏳ Tikrinu...');
      const delta = atsakymas.createdTimestamp - message.createdTimestamp;
      await atsakymas.edit(`🏓 Pong! Vėlavimas: ${delta} ms`);
    }
  },
  help: {
    aprašymas: 'Parodo galimų komandų sąrašą.',
    async vykdyti(message) {
      const eilutes = Object.entries(commands)
        .map(([pavadinimas, komanda]) => `- ${prefix}${pavadinimas} - ${komanda.aprašymas}`)
        .join('\n');

      await message.reply(`Galimos komandos:\n${eilutes}`);
    }
  }
};

client.once(Events.ClientReady, readyClient => {
  console.log(`Prisijungta kaip ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const komandosPavadinimas = args.shift()?.toLowerCase();

  if (!komandosPavadinimas) return;

  const komanda = commands[komandosPavadinimas];

  if (!komanda) {
    await message.reply(`Nežinoma komanda. Naudokite ${prefix}help, kad pamatytumėte galimas komandas.`);
    return;
  }

  try {
    await komanda.vykdyti(message, args, client);
  } catch (error) {
    console.error('Klaida vykdant komandą:', error);
    await message.reply('Įvyko klaida vykdant komandą.');
  }
});

client.login(token);
