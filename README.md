# Calcplus – lommeregner med skjult force

En PWA, der ligner iPhonens lommeregner (iOS 18/26-udseendet) og i hemmelighed kan få resultatet ved **=** til at blive et tal, du har valgt på forhånd. Ren vanilla JS, ingen afhængigheder, ingen build-trin.

---

## 1. Opsætning

### Kør lokalt
```bash
npm run dev          # http://localhost:5173 (bruger npx serve)
npm test             # enhedstests + 20.000 tilfældige force-regnestykker
npm run selftest     # kun den randomiserede selvtest (10.000 som standard)
python3 scripts/extract-icons.py   # skær app-ikon og knap-tegn ud af ref/-billederne
```

### Udgivelse (Vercel)
Repoet er et statisk site. Vercel-projektet er koblet til GitHub, så hvert push udgives automatisk:
- push til `main` → produktion
- push til andre branches → preview-link

Vercel-projekt: **calcplus** (team *thyxo's projects*)
- Produktion (fra `main`): https://calcplus-thyxos-projects.vercel.app
- Preview af udviklingsbranchen: https://calcplus-git-claude-stoic-allen-fqrvfk-thyxos-projects.vercel.app

Ingen build-kommando og ingen output-mappe (roden udgives som den er). `vercel.json` sørger for at `sw.js` aldrig caches af CDN'et.

### Installér på iPhone
1. Åbn adressen i **Safari**.
2. Del-knappen → **Føj til hjemmeskærm** → navnet "Lommeregner".
3. Åbn fra hjemmeskærmen: fuld skærm, ingen Safari-bjælker, virker offline.

> Tip: Læg ikonet i stedet for Apples lommeregner i Dock, og læg den rigtige i en mappe.

---

## 2. Sådan sætter du målet

**Hemmelig adgang:** tryk **5 gange hurtigt** i øverste højre hjørne (på eller lige under lommeregner-knappen, inden for 2½ sekund). Indstillingspanelet åbner.

| Indstilling | Betydning |
|---|---|
| **Force aktiv** | Tænd/sluk for force. Slukket = helt almindelig lommeregner. |
| **Mål** | *Tal* (fx `2100` eller `147,95`), *I morgen* (DDMMÅÅ), *I dag* (DDMMÅÅ) eller *Klokken* (TTMM + valgfrit antal minutter frem). "Rammer nu" viser det aktuelle mål. |
| **Start** | Hvornår talstrømmen starter: *Ved tal nr. N*, *Første tal efter =* eller *Manuel* (tryk én gang i det tomme sorte felt øverst i midten). |
| **N** | Hvilket tal i regnestykket der streames (standard 3). |
| **Antal ramte før stop** | Force slår sig selv fra efter så mange ramte (standard 3). Gentagelser huskes stadig (se nedenfor). |
| **Ret sidste tal ved =** | Hvis tilskueren trykker = før talstrømmen nåede at starte, rettes sidste tal i stedet. |
| **Tillad operator-skift** | Hvis målet er mindre end summen, må `+` blive til `−` (eneste troværdige løsning). |
| **Diskret prik** | En næsten usynlig mørkegrå prik øverst i midten, når force er klar. |
| **Kør selvtest** | Kører 2.000 tilfældige regnestykker direkte på telefonen og viser resultatet. |
| **Log** | Hvad motoren har gjort (startet talstrøm, skiftet operator, afrundet osv.). |

Indstillingerne gemmes på telefonen.

### Hvordan "talstrømmen" virker
Appen følger med i alt, der tastes. Når tilskueren begynder på det tal, der skal streames, udregner motoren det tal `x`, som får hele udtrykket (med almindeligt regnehierarki: × og ÷ før + og −) til at give målet. **Hvert tryk på en ciffertast viser næste ciffer i `x`** – uanset hvilken tast der blev trykket. Regnestykket på skærmen er dermed ægte hele vejen, og = giver målet.

- Taster tilskueren **færre** cifre end nødvendigt, fuldføres tallet ved =.
- Taster de **flere**, ignoreres de ekstra tryk.
- Slet-tast og swipe virker: ét ciffer tilbage, og næste tryk viser det samme ciffer igen.
- Fortsætter tilskueren med flere tal efter det streamede tal, streames det næste tal også, hvis det kan gøres troværdigt.

### Eksempel-rutine (København)
Mål: *I morgen*, Start: *Ved tal nr. 3*.
1. "Tast din fødselsdato" → `240387`, tryk `+`
2. "Dit postnummer" → `2100`, tryk `+`
3. "Og nu et helt tilfældigt tal – bare tast løs" → streames
4. `=` → **121.026** (= 12-10-26, i morgens dato), som du har skrevet på en seddel i går.

Andre ideer: Lotto-række (7 tal lagt sammen, N = 8), beløbene fra en Netto-kvittering (N = antal varer + 1), postnummer × alder osv.

### Gentagelsessikring
- **Tryk = igen:** opfører sig som en rigtig lommeregner (gentager sidste regneart), fx `121.026 − 121.461`.
- **Samme regnestykke igen:** giver præcis det samme streamede tal og det samme resultat – også efter force er "brugt op".
- **Ret et tal og gentag:** så længe force er aktiv (antal ramte ikke opbrugt), rammer det nye regnestykke også målet.
- Regnestykker med færre tal end N er ærlige (medmindre "Ret sidste tal ved =" er slået til – se begrænsninger).

---

## 3. Panik-knappen

**Hold uret (historik-knappen øverst til venstre) inde i ca. ¾ sekund.**
Force slås øjeblikkeligt fra, hukommelsen om tidligere ramte slettes, og appen er en helt almindelig, korrekt lommeregner. Der vises ingenting (den diskrete prik forsvinder). Der er også en rød PANIK-knap i det hemmelige panel.

For at starte igen: hemmeligt panel → *Force aktiv*.

---

## 4. Kendte begrænsninger

- **Hele det sidste tal er beregnet.** Når de andre tal og målet ligger fast, er der præcis ét tal, der virker – derfor kan ikke kun "de sidste cifre" udskiftes. Brug talstrømmen på et tal, tilskueren ikke kan kontrollere (et "tilfældigt" tal), ikke på et tal de læser op fra en kvittering.
- **Mål mindre end summen:** ved `+` skal tallet være negativt, så motoren skifter `+` til `−` (synligt i det grå udtryk). Vælg et mål større end den forventede sum, så sker det ikke. Slå *Tillad operator-skift* fra for at få et ærligt resultat i stedet.
- **× og ÷** giver typisk decimaltal (fx `240.387 ÷ 114,47`). Er det ikke eksakt inden for 9 cifre, vises målet alligevel; udtrykket afviger da på 6.+ betydende ciffer. Tal under 1 (`0,00873…`) undgås, fordi de ser mistænkelige ud.
- **Ret sidste tal ved =** ændrer et tal, tilskueren selv har tastet. Det ses kun i den lille grå linje, men kan opdages. Slå det fra, hvis du hellere vil have et ærligt (forkert) resultat.
- **Datoer med foranstillet nul** (fx 05-11-26) vises som `51.126`, fordi en lommeregner ikke viser foranstillede nuller. Tusindtalspunktummer vises altid (`121.026`).
- **Umulige tilfælde** (fx division med 0, eller tallet skulle have over 9 cifre med for stor afrunding): motoren opgiver og viser det **ærlige** resultat. Det logges.
- Menuen (Videnskabelig, Matematiknoter, Konverter) er kun visuel – kun *Almindelig* virker.
- Skriften er San Francisco på iPhone. På Android/PC bruges systemets skrift, så det ligner mindre.
- Ikonerne er udsnit af dine egne screenshots: app-ikonet fra iPhone-hjemmeskærmen (samme kilde som Notes-appen), knap-tegnene fra lommeregner-billederne i `ref/`. Skiftes billederne ud, så kør `python3 scripts/extract-icons.py` igen (kræver Pillow + numpy).
- **Idé til senere:** sæt målet live fra en anden telefon via WebSocket/SSE. Det kræver en lille Node-server (fx på Railway) – ikke bygget endnu.

---

## 5. Hvad er testet

`npm test` (Node 18+, ingen afhængigheder) – **24 tests, alle grønne**:

**Lommeregner:** dansk formatering (`.`/`,`), regnehierarki, gentaget =, procent som på iPhone (`200+10%` = 220), ±, negative tal i parentes `(-5.634,)×65`, AC/C-skift, slet, lange tal op til 16 cifre (krymper og glider ud til venstre som på iPhone), eksponentvisning (`9,9999997e23`), `Fejl` ved division med 0, fortsat regning efter =.

**Force-motor:** fødselsdato + postnummer → i morgens dato, ciffer-for-ciffer-streaming, slet under streaming, ekstra tryk ignoreres, fuldførelse ved =, Netto-kvittering med decimaler, Lotto-række (7 af 36), × og ÷ med afrunding, gentaget =, gentagelse efter "brugt op", rettet tal, panik, *første tal efter =*, manuel trigger, ret-sidste-tal.

**Randomiseret (20.000 regnestykker, seed 2026)** – fødselsdatoer, postnumre, Lotto-rækker, Netto-beløb og blandede kæder med `+ − × ÷` mod mål som i morgens dato, 2100, store/små heltal, decimaltal og negative tal:

```
Ramte målet ............ 19868 (99,3 %)
  heraf helt eksakt .... 15129 (76,1 %)
  heraf afrundet ×/÷ ... 4739 (23,9 %)
  operator skiftet ..... 11134 (56,0 %)   ← tilfældige mål er ofte < summen
Ærligt resultat (opgav)  132   ← kun lange blandede kæder med umulige mål
Løgn (mål vist, men udtryk ≠ mål): 0
Gentaget "=" korrekt ... 19868/19868
Samme regnestykke igen . 19868/19868
Ærlig tilstand korrekt . 5000/5000
```
Alle fødselsdag/postnummer-, Lotto-, Netto-, ×- og ÷-scenarier ramte 100 %.

Testet i headless Chromium (iPhone-størrelse 393×852): layout, hemmelig gestus, force-forløb. **Ikke** testet på en fysisk iPhone endnu – tjek især safe-area (notch/home-indikator) og "Føj til hjemmeskærm".

---

## Filer
```
index.html            markup (taster, menu, historik, hemmeligt panel)
styles.css            udseende – mål taget fra skærmbillederne
src/format.js         dansk talformatering
src/force.js          evaluering + force-planlægger (vælger mest troværdige løsning)
src/calculator.js     lommeregner-tilstand og talstrøm (uden DOM, testbar)
src/settings.js       indstillinger og mål (i morgen/i dag/klokken)
src/selftest.js       randomiseret selvtest (Node + i appen)
src/app.js            UI, gestusser, panel, service worker
glyphs/               knap-tegn skåret ud af screenshots (bruges som CSS-masker)
ref/                  referencebilleder (udgives ikke)
scripts/extract-icons.py  laver icons/ og glyphs/ ud fra ref/
sw.js                 offline-cache, netværk først (hæv VERSION ved ændringer)
manifest.webmanifest  PWA-manifest
tests/                node:test
```
