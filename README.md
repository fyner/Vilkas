# Vilkas

Minimalus Discord botas su `discord.js` v14.

## Reikalavimai
- Node.js 18+
- Discord aplikacija (Client ID) ir boto tokenas
- Discord Developer Portale įjungti **Server Members Intent** (reikalingas `userinfo` ir `roleinfo` komandoms)

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
- `purge amount kiekis:1–100` – ištrina paskutines N žinučių (reikia teisės Manage Messages).
- `purge all` – ištrina visas žinutes kanale (gali užtrukti dėl rate limitų).
- `serverinfo` – rodo serverio informaciją.
- `userinfo [vartotojas]` – rodo vartotojo informaciją.
- `roleinfo role [rodymas] [kanalas]` – rodo rolės leidimus.

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

## Boto teisės ir saugumas

### Minimalios teisės (OAuth2 scopes)
Kviesdami botą į serverį, reikia šių scope'ų:
- `applications.commands` – komandų registracija
- `bot` – bot funkcionalumas

### Minimalios bot leidimai (permission bits)
**Būtinos visoms komandoms:**
- `ViewChannel` – matyti kanalus
- `SendMessages` – siųsti žinutes
- `ReadMessageHistory` – skaityti žinučių istoriją
- `EmbedLinks` – rodyti embed'us (`serverinfo`, `userinfo`, `roleinfo`)
- `AttachFiles` – prisegti failus (`roleinfo` gali kurti .txt ataskaitas)

**Papildomos teisės:**
- `ManageMessages` – tik `purge` komandai (ištrinti žinutes)

### Rekomendacijos saugumui
1. **Nenaudokite `Administrator` teisės** – ji suteikia visas teises. Naudokite tik tai, kas reikalinga.
2. **Komandų ribojimas** – Discord automatiškai riboja `purge` komandą tik vartotojams su `ManageMessages` teise (nustatyta kode). Kitas komandas galite apriboti per serverio nustatymus: **Server Settings → Integrations → Bot → Permissions**.
3. **Role-based prieiga** – Discord leidžia apriboti komandas tam tikroms rolėms per serverio Integrations nustatymus. Tai saugiau nei hardcode'inti role ID kode.
4. **Gildijos komandos** – kai nurodytas `GUILD_ID`, komandos registruojamos tik tame serveryje (ne globaliai), kas sumažina riziką ir pagreitina testavimą.

### Intents
Discord Developer Portale įjunkite:
- **Server Members Intent** – reikalingas `userinfo` ir `roleinfo` komandoms gauti narių informaciją.

### Kvietimo nuoroda
Minimalių teisių kvietimo nuoroda:
```
https://discord.com/api/oauth2/authorize?client_id=JŪSŲ_CLIENT_ID&permissions=125952&scope=bot%20applications.commands
```
(permissions=125952 = ViewChannel + SendMessages + ReadMessageHistory + EmbedLinks + AttachFiles + ManageMessages)

Jei norite be `ManageMessages` (tik informacinės komandos):
```
https://discord.com/api/oauth2/authorize?client_id=JŪSŲ_CLIENT_ID&permissions=117760&scope=bot%20applications.commands
```
(permissions=117760 = ViewChannel + SendMessages + ReadMessageHistory + EmbedLinks + AttachFiles)
