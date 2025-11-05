# Vilkas

Minimalus Discord botas su `discord.js` v14.

## Reikalavimai
- Node.js 18+
- Discord aplikacija (Client ID) ir boto tokenas

## Diegimas
1) Įdiekite priklausomybes:
```bash
npm install
```
2) Aplinka (`.env`):
```bash
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...   # pasirenkama; jei nenurodysite, komandos bus globalios (lėčiau)
```
3) Užregistruokite komandas (greičiau su `GUILD_ID`):
```bash
npm run deploy:commands
```
4) Paleiskite botą:
```bash
npm run dev
# arba
npm start
```

## Komandos
- `ping` – grąžina boto apdorojimo laiką ir WS ping.
- `echo` – pakartoja pateiktą tekstą.
- `purge amount kiekis:1–100` – ištrina paskutines N žinučių.
- `purge all` – ištrina visas žinutes kanale (gali užtrukti dėl rate limitų).

## Elgsena ir konfigūracija
Per-komandos nustatymai valdomi `config.json` (be defaults):
```json
{
  "commands": {
    "ping":  { "ephemeral": true,  "timeoutSeconds": 3 },
    "echo":  { "ephemeral": true,  "timeoutSeconds": 3 },
    "purge": { "ephemeral": true,  "timeoutSeconds": 3 }
  }
}
```
- `ephemeral: true` – atsakymas privatus; Discord neleidžia jo automatiškai ištrinti.
- `ephemeral: false` – atsakymas viešas; botas jį ištrins po `timeoutSeconds` (0 – neištrina).

Pastaba: perregistruoti komandas reikia tik pakeitus komandų schemą (pavadinimus, aprašymus, opcijas). Konfigūracijos pakeitimams – nereikia.
