# Vilkas

Node.js ir `discord.js` pagrindu sukurtas Discord botas su keliomis testinėmis slash komandomis, leidžiančiomis greitai patikrinti boto reakcijas.

## Būtinos sąlygos

- Node.js 18 ar naujesnė versija
- Discord programėlė su sugeneruotu botu (client ID ir tokenas)
- Testinis Discord serveris (guild ID) greitesniam komandų atnaujinimui

## Greitas startas

1. Nukopijuokite `.env.example` į `.env` ir užpildykite gautais raktais:
   ```bash
   cp .env.example .env
   ```
2. Įdiekite priklausomybes:
   ```bash
   npm install
   ```
3. Užregistruokite slash komandas testiniame serveryje:
   ```bash
   npm run deploy:commands
   ```
4. Paleiskite botą:
   ```bash
   npm run dev
   # arba
   npm start
   ```

> Jei nenorite naudoti `.env`, tuos pačius parametrus galite įrašyti į `config.json`. `.env` vertės turi prioritetą.

## Konfigūracija

`index.js` ir `deploy-commands.js` naudoja šias reikšmes:

- `DISCORD_TOKEN` – boto tokenas
- `DISCORD_CLIENT_ID` – Discord programėlės (Application) ID
- `DISCORD_GUILD_ID` – Discord serverio ID, kuriame testuojate

Jei `DISCORD_GUILD_ID` nepateiktas, komandos registruojamos globaliai. Tai gali užtrukti iki 1 valandos.

## Prieinamos testinės komandos

- `ping` – pateikia boto apdorojimo laiką ir WebSocket pingą (ephemeral atsakymas)
- `test` – paprasta patikra, kad botas reaguoja (ephemeral atsakymas)
- `echo` – pakartoja vartotojo tekstą, galima rinktis ar atsakymas bus matomas visiems
- `roll` – meta nurodytą kauliuką (numatytai d6) ir grąžina rezultatą

## Naudingi skriptai

- `npm run dev` – paleidžia botą su `nodemon`, automatiškai perkraunant jį po pakeitimų
- `npm start` – paleidžia botą vieną kartą
- `npm run deploy:commands` – užregistruoja slash komandas Discord serveryje arba globaliai

## Projekto struktūra

```
.
├── commands/          # Atskiri komandų moduliai
├── deploy-commands.js # Skriptas slash komandų registracijai
├── index.js           # Pagrindinis boto įėjimo taškas
├── config.json        # Alternatyvi konfigūracija, jei nenaudojate .env
└── .env.example       # Pavyzdinės aplinkos kintamųjų reikšmės
```

Sėkmės kuriant ir plečiant botą! Jei reikia papildomų komandų ar automatinių testų, pridėkite naujų failų į `commands/` katalogą ir paleiskite `npm run deploy:commands`.
