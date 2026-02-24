# Devil's Advocate - Kritisk analys av Research.md

## Sammanfattning

Research.md är ett imponerande dokument - men det är också farligt. Det blandar kritiska säkerhetsfixar med feature-önskelistor och akademisk forskning på ett sätt som gör det svårt att skilja "måste göra nu" från "kanske någon gång". Resultatet riskerar att bli en massiv scope creep som förvandlar en enkel skolenkätplattform till ett halvfärdigt LMS.

---

## 1. Over-engineering för skalan

### Projektet är en enkätplattform för EN lärare med <100 elever. Research.md behandlar det som om det vore Mentimeter.

**Neon PostgreSQL (sektion 2):** SQLite klarar tusentals concurrent readers och ~50 writes/second. "30+ elever som svarar samtidigt" är inte ett problem för SQLite - varje svar är en snabb INSERT som tar <1ms. SQLITE_BUSY med WAL mode har en default timeout på 5 sekunder. Det påstådda problemet existerar knappt i verkligheten för denna skala.

*Dold kostnad:* PostgreSQL-migration kräver databasmigreringsverktyg, ny hosting, connection pooling-konfiguration, och en dev/prod-split som ökar komplexiteten markant. Lokal utveckling mot Postgres kräver Docker eller en molntjänst.

**SSE/Realtidsuppdateringar (sektion 4):** "Live-resultat medan elever svarar" löses med en refresh-knapp eller en `setInterval` på klienten som pollar `/api/surveys/[id]/results` var 5:e sekund. SSE med ReadableStream, connection management och abort handlers är en serverside-komplikation som inte behövs. Enkel client-side polling med `fetch` + `setInterval` ger samma UX med 5 rader kod istället för 30.

**Rate limiting med Upstash Redis (sektion 6):** En skolplattform med delningskoder som bara elever i klassen har behöver inte rate limiting. Om du vill skydda mot enkel missbruk, räcker Next.js middleware med en simpel Map - precis som Research.md sedan föreslår. Varför ens nämna Upstash?

**unstable_cache (sektion 3):** Heter fortfarande "unstable" av en anledning. För en plattform med <100 samtida användare är det prematur optimering. Server Components gör redan databasanrop direkt - det finns inget cachingproblem att lösa.

---

## 2. YAGNI-brott (You Ain't Gonna Need It)

### Research.md listar ~40 förbättringar. En realistisk skolplattform behöver kanske 8.

**MCP-server prompts (sektion 7d):** MCP prompts är en nischfunktion som nästan ingen MCP-klient använder ännu. Att lägga tid på `server.prompt("analyze_survey", ...)` när grundläggande felhantering saknas är prioritet bakåt-framåt.

**Docker + CI/CD (sektion 8):** Projektet har inga tester, ingen deployment, och ingen auth. Att skriva en Dockerfile och GitHub Actions-pipeline innan man ens kan logga in som admin är att bygga taket före grunden.

**6+ nya MCP-tools (sektion 7b):** `compare_surveys`, `manage_students`, `update_question` - var och en av dessa kräver implementation, testning och underhåll. MCP-servern har 5 fungerande tools. Det räcker. Bygg fler när det finns ett faktiskt behov.

**Adaptivt lärande nivå 2-3 (sektion 5, Pedagogik):** Branching logic, dynamisk svårighetsjustering, AI-baserad analys av svarmönster - detta är forskningsprojekt, inte features för en skolenkätplattform. Att ens nämna dem skapar falska förväntningar.

**Gamification (sektion 4, Pedagogik):** Streaks, badges, personligt bästa, klassutmaningar - allt detta kräver persistent state per elev, en helt ny UI-vy, och underhåll. Plattformen har inte ens en fungerande elevportal.

**Frågetyper (sektion 7, UX):** 8 nya frågetyper föreslås. Varje ny typ kräver: ny UI-komponent, ny valideringslogik, ny rättningslogik (för quiz), datamodellsändring, och uppdatering av CSV-import. LIKERT_SCALE och MULTIPLE_ANSWER kan motiveras. Resten (RANKING, IMAGE_CHOICE, MATCHING, FILL_IN_BLANK, NUMERIC) är önsketänkande.

---

## 3. Felaktig prioritering

### Säkerhet och validering är rätt prioriterade. Men efter det går det snett.

**Tester prioriteras som #3 men borde vara #1 eller #2.** Research.md säger "inga tester" och prioriterar ändå auth före tester. Problemet: om du bygger auth utan tester, hur vet du att auth fungerar? Skriv tester FÖRST (åtminstone för befintliga API-routes), sedan auth, sedan validering.

**CSV-export prioriteras som #4 (Medium).** Men det är den enskilt mest efterfrågade funktionen av lärare i alla enkätverktyg. Lärare MÅSTE kunna exportera data. Det borde vara #2, direkt efter auth. Det är också trivialt att implementera.

**PostgreSQL-migration (#6) borde inte ens vara på listan** för en v0.1-plattform. Det hör hemma i en "Future considerations"-sektion.

**UX-sidan: "Responsiv sidebar" (#3, Hög)** vs "Redigera/ta bort frågor och enkäter" (#8, Medium). Att en lärare inte kan radera en felaktig fråga är ett mycket allvarligare problem än att admin-sidebaren inte är mobilanpassad. Lärare sitter vid en dator när de administrerar - mobil admin är nice-to-have.

---

## 4. Tveksamma antaganden

### Research.md gör flera antaganden som inte ifrågasätts.

**"NextAuth.js (Auth.js v5)" antas vara rätt val.** Auth.js v5 (beta) har haft breaking changes i varje minor release, bristfällig dokumentation, och community-frustration. Auth.js v5 med Credentials-provider har kända begränsningar (session-hantering, CSRF). För en enkel adminpanel med 1-5 användare kan en simpel lösenordskontroll i middleware + HTTP-only cookie med `jose` (som redan finns i projektet) vara tillräckligt. Varför lägga till ett helt auth-framework för <5 admin-användare?

**"Elever svarar på mobilen"** - det förutsätts genomgående. I många svenska klassrum använder eleverna Chromebooks eller stationära datorer. Mobiloptimering är viktigt men inte "Kritisk" prioritet. Elevformuläret (`max-w-2xl mx-auto px-4`) fungerar redan på mobil.

**"Zod finns redan i mcp-server"** - men mcp-server har sin egen package.json. Att Zod finns i ett sibling-projekt motiverar inte att lägga till det i huvudprojektet. Motivera Zod på egna meriter (vilket är enkelt - det ÄR bra), inte med att det "redan finns".

**"Vercel är det självklara valet"** - men SQLite fungerar inte på Vercel utan extra setup (som nämns). Om man behåller SQLite (vilket jag argumenterar för) är Railway, Fly.io eller en enkel VPS bättre val. Research.md skapar en cirkulär argumentation: "vi behöver Postgres för Vercel, och Vercel för att det är zero-config med Next.js."

---

## 5. Vad saknas som borde vara med

### Research.md missar flera saker som är viktigare än hälften av det som föreslås.

**Backup-strategi.** SQLite-databasen har inga backup-rutiner. En enda `rm` raderar all data. Det borde finnas en enkel `cp`-baserad backup eller `sqlite3 .backup` som schemaläggs. Viktigare än PostgreSQL-migration.

**Error boundary och felhantering i UI.** Vad händer om en API-request failar? Applikationen har ingen global error boundary. En kraschad komponent tar ner hela sidan.

**Datavalidering i Prisma-schemat.** Schemat saknar `@db.VarChar(n)`-begränsningar (ja, SQLite stöder inte detta, men det borde finnas applikationsnivå-validering). En elev kan skicka 10MB fritext i ett FREE_TEXT-svar.

**Logging.** Det finns ingen strukturerad loggning. Console.log i production ger inget användbart. En enkel Winston- eller Pino-setup saknas.

**Seed data / testdata-script.** Inget sätt att snabbt populera databasen med testdata. `prisma db seed` med exempelkurser, frågor och svar skulle dramatiskt förbättra utvecklingsupplevelsen.

**CORS-konfiguration för MCP-servern.** MCP-servern och webbappen delar databas men det finns ingen dokumentation om hur de körs ihop.

---

## 6. Alternativa, enklare lösningar

### Research.md väljer nästan alltid "rätt" lösning men missar de ENKLA lösningarna.

| Research.md föreslår | Enklare alternativ |
|---|---|
| NextAuth.js med Google + Credentials | `jose` JWT (redan i projektet) + en `POST /api/admin/login` route + middleware check. 50 rader kod istället för ett helt framework. |
| Neon PostgreSQL | Behåll SQLite med WAL mode (`PRAGMA journal_mode=WAL`). Klarar projektets skala. |
| SSE med ReadableStream | Client-side `setInterval` + `fetch`. 5 rader. |
| Upstash rate limiting | Ingenting. Eller en 10-rads in-memory counter. |
| Toast-system (react-hot-toast) | En enkel `<div>` med `useState` + `setTimeout`. Behöver inte ett paket. |
| framer-motion för animationer | CSS `transition` och `@keyframes`. Noll dependencies. |
| Vitest + Playwright + Testing Library | Börja med bara Vitest för API-routes. Lägg till resten när det finns something to test. |
| Designtokens och komponentbibliotek | Tailwind-konfiguration med `@apply` för återkommande mönster. Inte ett eget Button-komponent-system. |

---

## 7. Dolda kostnader

### Varje rekommendation i Research.md har underhållskostnader som inte nämns.

**NextAuth.js:** Auth-libraries kräver konstant uppdatering. Auth.js v5 har haft 12+ beta-releases. Breaking changes vid uppgradering. Session-hantering, token rotation, CSRF-skydd - allt måste underhållas.

**PostgreSQL:** Kräver connection pooling, SSL-certifikat, backup-rutiner, och monitoring. Neon's gratis tier har cold starts på ~500ms. Varje ny utvecklare behöver en databas-instans eller Docker.

**Vitest + Playwright + Testing Library:** Tre testverktyg att konfigurera och underhålla. Playwright kräver browser-binaries (~500MB). CI-tid och flaky tests. Börja med ETT testverktyg.

**Toast-system + Animationer + Skeleton screens:** Varje UI-förbättring kräver underhåll vid framtida refaktoreringar. Ett toast-system är ett globalt state management-problem.

**6 nya frågetyper:** Varje typ multiplicerar testmatrisen. MC + Free Text = 2 kodvägar. Med 8 typer = 8 kodvägar genom formulär, validering, rättning, resultatvisning, CSV-export, och MCP-tools.

---

## 8. Pedagogik-sektionen: Akademisk överkurs

### Hela sektion "Pedagogik & Lärande" är intressant läsning men har nästan noll implementation-nytta.

Forskningen citeras korrekt men konsekvenserna för plattformen är vaga. "Prioritera pedagogisk design framför tekniska features" och "Feedback > Poäng" är bra principer, men de ger ingen vägledning för vad man ska koda idag.

**Konkret:** Den enda pedagogik-drivna ändring som bör göras nu är att lägga till ett `explanation`-fält på Question-modellen. Allt annat (formativt quiz-läge, kunskapskartor, spaced repetition, adaptivt lärande) är framtidsprojekt som inte bör påverka dagens implementation.

GDPR-analysen är dock värdefull och bör beaktas - speciellt dataminimering och informationsplikt.

---

## Slutsats: Vad borde implementeras NU

Om jag fick prioritera för en v0.1-release:

1. **Admin-auth** (men simpelt med jose, inte NextAuth)
2. **CSV-export** (direkt användarnytta, trivial implementation)
3. **Zod-validering** (förhindrar buggar, låg effort)
4. **`lang="sv"`** + kontrastfix (5 minuter, stor a11y-vinst)
5. **htmlFor/id på labels** (a11y-grundkrav)
6. **Databasindex** (4 rader i schema.prisma)
7. **MCP-server felhantering** (try/catch runt befintliga tools)
8. **Backup-script** (ett shell-script)

Allt annat hör hemma i en v0.2-backlog, inte i en första implementation.
