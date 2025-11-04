# Vilkas

Paprastas Discord botas, parašytas su `discord.js`, demonstruojantis pradines komandų valdymo praktikas.

## Reikalavimai

- Node.js 18 arba naujesnė versija
- Discord Application su sukurta botos paskyra

## Diegimas

1. Nukopijuokite repozitoriją ir atsidarykite katalogą:

   ```bash
   git clone <repo-url>
   cd <repo-katalogas>
   ```

2. Įdiekite priklausomybes:

   ```bash
   npm install
   ```

3. Sukurkite `.env` failą pagal pateiktą pavyzdį:

   ```bash
   cp .env.example .env
   ```

4. `.env` faile nurodykite `DISCORD_TOKEN` reikšmę (ją rasite Discord Developers portale).

5. Paleiskite botą:

   ```bash
   npm start
   ```

Vystymo metu galite naudoti karštą perkrovimą:

```bash
npm run dev
```

## Konfigūracija

- `config.json` – nustato komandų prefiksą (`prefix`). Numatytoji reikšmė: `!`.

## Pagrindinės komandos

- `!ping` – grąžina boto atsako laiką.
- `!help` – parodo komandų sąrašą.

## Naudingi patarimai

- Būtinai pridėkite botą į pasirinktą Discord serverį su reikiamais leidimais (bent jau skaityti ir rašyti žinutes).
- Jei boto prijungti nepavyksta, patikrinkite ar `DISCORD_TOKEN` reikšmė yra teisinga ir ar botos žymeklis nėra atnaujintas.
