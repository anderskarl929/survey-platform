# Devil's Advocate - Kritik av elevuppgifter-designen (01/02/03)

**Datum:** 2026-05-29
**Roll:** Djävulens advokat. Ren analys, ingen kod ändrad. Enda fil som skapas är denna.
**Tes (ärvd från `DevilsAdvocate.md`):** Detta är en enkätplattform för EN lärare med <100 elever, INTE ett LMS. Varje rad i en rapport ska leda till en lärarhandling. YAGNI. Den enklaste lösningen som faktiskt löser problemet vinner.

> De tre dokumenten är genomgående medvetna om scope creep - de citerar till och med DevilsAdvocate själva. Problemet är att de ändå designar tre OLIKA system och kallar dem alla "minimala". Backend ritar fem nya tabeller/kolumner och sex MCP-verktyg. Frontend ritar fyra nya routes och sex nya komponenter. Integration ritar noll nya tabeller och två verktyg. De kan inte alla ha rätt. Mitt jobb är att tvinga fram ett avgörande och kapa resten.

---

## 0. Den verifierade nulägesbilden (jag tog inget på tro)

Jag läste koden de tre hänvisar till. Resultat:

| Påstående i dokumenten | Verifierat? | Anmärkning |
|---|---|---|
| `Question.type` är en strängkolumn, inte enum (`schema.prisma:49`) | **SANT** | Rad 49: `type String // MULTIPLE_CHOICE | FREE_TEXT`. Nya typvärden kräver ingen kolumnmigration. |
| `Answer.value` är obegränsad TEXT (`schema.prisma:111`) | **SANT** | Rad 111: `value String`. Långa svar ryms redan. |
| `respondSchema` kapar svar vid `max(5000)` (`validators.ts:8`) | **SANT** | Rad 8. |
| Partial submission gjordes med NOLL migrationer | **SANT** | Specen rad 219: "Inga DB-migrationer krävs", rad 204: `respondSchema` orört. Detta är prejudikatet. |
| Lokal `.env` pekar på PROD Neon-DB | **SANT** | Spec rad 212-213: även Vercel preview hittar prod-DB. |
| `migration_lock.toml` saknas i `prisma/migrations/` | **SANT** | Endast fyra migrationsmappar, ingen lock-fil. R3 är reell. |
| `build` kör `migrate deploy`, `setup` kör `db push` (`package.json`) | **SANT** | Rad 7 resp. 10. Blandad workflow, `db push` mot prod är farligt. |
| MCP har 11 verktyg, INGET delete/update (`server.ts`) | **SANT** | Verifierat: 11 `server.tool`-anrop, bara skapa/hämta/feedback. |
| `saveFeedback` vägrar icke-FREE_TEXT (`give-feedback.ts:80-82`) | **SANT** | Kastar "Feedback kan bara ges på fritextsvar". Relevant för LONG_TEXT (se §4). |
| `create-quiz-from-csv` tvingar icke-FREE_TEXT till MULTIPLE_CHOICE (`:40-43`) | **SANT** | Och `csv.ts:28` gör samma. Duplicerad parser (R4 reell). |
| `mastery.ts` returnerar false vid <2 svar (`:15`) | **SANT** | Engångsfrågor blir alltid "ej behärskad". R5 reell. |
| `QuestionRenderer` hårdkodar `rows={3}` (`:88`) | **SANT** | Frontend citerar `:85`, faktisk rad är 88. Trivial off-by. |
| `/progress`-länken finns i `CourseSidebar.tsx:19` men har ingen sida | **SANT** | Länk "Elevöversikt" finns, ingen `progress/page.tsx`. Reserverad tom plats. |
| `DELETE /api/surveys/[id]` finns i webbappen | **SANT** | `surveys/[id]/route.ts:36-57` (frontend citerade fel sökväg men routen finns). |

**Och det de MISSADE:** Det finns redan en route `GET /api/surveys/[id]/feedback/pending` (`feedback/pending/route.ts`) som returnerar exakt vilka FREE_TEXT-svar som saknar feedback, per fråga, med antal och svarstext - och filtrerar bort triviala svar (`?`, `.`, `1`). Frontend (§3.3) och integration (§e) beskriver detta som något som "vi redan vet / behöver byggas". Det är redan byggt. Ingen behöver bygga "X svar väntar på feedback"-signalen - den finns som API.

---

## 1. Tre arkitekter, tre oförenliga datamodeller - ett avgörande krävs

Detta är dokumentens centrala spricka och de döljer den artigt bakom "datamodell är databas-agentens beslut".

- **Frontend** *antar* `Module` + `ModuleItem` (en join-rad per uppgift). Två nya tabeller.
- **Backend** vill ha `Unit` (parent) + `Survey.unitId` + `Survey.orderInUnit`, PLUS `Rubric` + `RubricCriterion` + `Question.instructions` + `Question.rubricId` + `Answer.feedbackLevel`. Tre nya tabeller och fem nya kolumner.
- **Integration** säger: **noll** moment-tabeller. Claude håller survey-ID-listan; gruppering är inte ett DB-problem.

De kan inte alla vara "den minimala lösningen". Frontends `ModuleItem`-join är dessutom strikt onödig: backend visar att en enkel `Survey.unitId`-kolumn räcker eftersom en enkät hör till max ett moment (backends egen öppna fråga 1). En join-tabell är bara motiverad om en enkät ska kunna ligga i flera moment - vilket ingen har bett om. Frontend bygger alltså in en many-to-many för ett behov som inte finns. Avförs.

Återstår: `Unit`-tabell (backend) kontra ingen tabell (integration). Här vinner **integration på poäng men förlorar i praktiken**, och kompromissen är uppenbar:

- Integrationens "Claude håller ID-listan i huvudet" är skört. Listan lever i en chattsession. Nästa session, eller nästa lärare-fråga tre veckor senare, har Claude glömt vilka fyra surveys som var "Källkritik-momentet". Då måste läraren gissa survey-ID:n. Det är precis den bokföring appen ska ta bort (backend §a.1 har rätt om detta).
- Men backends fulla `Unit`+`Rubric`+`RubricCriterion`+fyra kolumner är överbygge. `Rubric` är, enligt backend själv (§a.3, v1-tabellen), INTE nödvändig för v1 - kriterier kan ligga i `instructions` eller utanför appen.

**Domen (motsägelse 1): bygg ENA tunn koppling, inte två tabeller och inte noll.** En enda nullbar kolumn `Survey.unitId` + en `Unit`-tabell (id, title, courseId, createdAt). Det är det minsta som gör grupperingen persistent så att rapporten är reproducerbar mellan sessioner. Allt annat backend ritar (`orderInUnit`, `Rubric`, `RubricCriterion`, `Question.rubricId`, `Answer.feedbackLevel`) skärs eller skjuts. `orderInUnit` kan klaras med `Survey.createdAt` eller en enkel int om det visar sig behövas - men inte i första migrationen.

Frontends `Module/ModuleItem` förkastas. Backends `Unit` (avskalad) behålls. Integrationens "noll DB" förlorar på reproducerbarhet - men dess instinkt att inte bygga rapporten som en appvy vinner i §2.

---

## 2. Rapporten: app-vy (frontend+backend) kontra Claude-genererad (integration). Integration vinner rent.

Detta är den dyraste motsägelsen och den där frontend+backend gemensamt bygger fel sak.

- **Frontend** vill ha FYRA nya routes (`student/moment/[id]`, `admin/.../moment`, `admin/.../moment/[id]`, `admin/.../moment/[id]/rapport`) plus SEX komponenter (`ModuleTaskList`, `TaskStatusBadge`, `ModuleProgressSummary`, `ModuleReportMatrix`, `ModuleStudentReport`, `ModulesManager`) plus en ny statusberäkning ("den enda nya beräkningen frontend behöver" - men den måste vara typmedveten quiz vs skriv, vilket §8.7 i deras eget dokument medger är tvetydigt).
- **Backend** vill ha sex nya API-routes (`units`, `units/[id]`, `units/[id]/report`, POST/PATCH/DELETE) med en aggregeringsshape på ~30 rader.
- **Integration** säger: rapporten är en LLM-syntesuppgift. Läraren sitter redan i en Claude-session. Ett MCP-verktyg returnerar aggregatet, Claude skriver rapporten till `output/`. Ingen app-vy.

**Integration har rätt, och argumenten är hårda:**

1. **Läraren är redan i Claude.** Hela arbetsflödet i memory ("Survey ↔ planera-moment-integration", "Exit tickets i appen") är Claude-drivet via MCP. En lärare som vill ha en momentrapport skriver "ge mig en momentrapport för Källkritik" i samma session där hon nyss skapade momentet. Att bygga en webbsida hon måste navigera till separat, logga in i admin för, och läsa en `<table>` i - när hon har en LLM som kan skriva en pedagogisk rapport mot `bedomningskriterier.md` - är att bygga en sämre produkt med mer kod.

2. **App-vyn kan inte göra det värdefulla.** Frontend+backend medger båda (frontend §3.1, integration §d) att rapporten INTE ska auto-betygsätta. Men då blir app-matrisen bara en korstabell av status/poäng - rådata. Det pedagogiskt värdefulla ("2-3 vanliga missuppfattningar i fritextsvaren", "vilka topics ska tillbaka i nästa retrieval review", "vilka elever halkar efter") är just det en `<table>` INTE kan och en LLM KAN. App-vyn levererar den minst värdefulla halvan till högst pris.

3. **Underhållskostnaden är permanent.** `ModuleReportMatrix` måste hantera horisontell scroll, frusen elevkolumn, typmedvetna celler (frontend §8.6). Det är en evig responsiv-tabell-huvudvärk för en vy som används ett par gånger per moment.

**Domen (motsägelse 2): ingen app-rapportvy i v1.** Rapporten genereras av Claude via ETT MCP-verktyg som returnerar momentets aggregat. Detta skär bort: frontends `admin/.../moment/[id]/rapport`-route, `ModuleReportMatrix`, `ModuleStudentReport`, och backends `units/[id]/report`-API. Det är den enskilt största kodbesparingen i hela kritiken.

**Viktig nyansering mot integration:** elev-momentsidan (`student/moment/[id]`) är en annan sak än lärar-rapporten och ska INTE skäras lika hårt - se §6. Eleven sitter inte i en Claude-session; eleven behöver en plats i appen som säger "här är momentets uppgifter, i ordning, med din status". Men det räcker med EN ny elevsida, inte fyra routes.

---

## 3. "Klar"-statusen och momentsidan är mindre nytt än frontend tror

Frontend gör en stor sak av en ny statusberäkning (Ej börjad / Utkast / Inlämnad / Klar / Ny feedback) och en `TaskStatusBadge` som måste vara typmedveten. Men:

- "Klar" via mastery (`calculateMastery`) är **meningslöst i ett moment** eftersom mastery kräver >=2 svar på samma fråga (verifierat `mastery.ts:15`) och momentfrågor ställs i regel en gång. Frontend förlitar sig på en funktion som per definition returnerar `false` för engångsuppgifter. Backend ser detta (R5) men frontend bygger ändå "Klar X/X"-badgen på den. Det blir en badge som aldrig tänds.
- Den ärliga statusen är binär per uppgift: **har eleven en Response eller inte** (+ "utkast finns"). Det är allt elev-momentsidan behöver, och det är redan beräkningsbart från `Response`/`DraftResponse` utan ny helper.

**Skär bort:** den typmedvetna "Klar"-logiken och mastery-baserad completion i momentkontext. Status = {Ej börjad, Utkast, Inlämnad}. Tre tillstånd, ingen ny lib-funktion.

---

## 4. Nya frågetyper och fält: LONG_TEXT, feedbackLevel, instructions - skär allt utom kanske ett

| Förslag | Vem | Behövs för v1? | Dom |
|---|---|---|---|
| `LONG_TEXT` (separat typ) | Backend, frontend | **NEJ** | Backend medger själv (§a.2) att LONG_TEXT "i praktiken är FREE_TEXT med ett UI-hint". En skrivuppgift ÄR redan en FREE_TEXT. Att införa en andra typ tvingar fram ändringar i BÅDA CSV-parsrarna (`csv.ts:28` + `create-quiz-from-csv.ts:40-43`), och - kritiskt - `saveFeedback` vägrar allt utom `type === "FREE_TEXT"` (`give-feedback.ts:80-82`). En LONG_TEXT-uppgift skulle alltså inte kunna få feedback genom det befintliga flödet utan att den vakten också ändras. Tre filer ändras för noll funktionell vinst. **Skär.** Skrivuppgift = FREE_TEXT. Större textarea löses i `QuestionRenderer` utan ny typ. |
| Större textarea för skrivuppgifter | Frontend | Ja, men trivialt | `rows={3}` (`QuestionRenderer.tsx:88`) -> CSS `min-h` / auto-grow. Ingen ny typ, ingen DB. Behåll. |
| `Answer.feedbackLevel "E"/C/A` | Backend | **NEJ - och det är LMS-drift** | Detta är betygssättning i databasen. Att lagra en E/C/A-nivå per svar är första steget mot att appen "vet" elevens nivå - exakt det alla tre säger att appen inte ska göra. Läraren bedömer mot `bedomningskriterier.md`; nivån hör hemma i lärarens omdöme (fritext i `Answer.feedback` eller `AssignmentFeedback`), inte i en strukturerad kolumn appen kan aggregera. **Skär hårt.** Detta är den tydligaste LMS-grodden i hela förslaget. |
| `Question.instructions String?` | Alla tre (integration tveksamt) | **Nej för v1** | Integration har rätt (§b): en längre instruktion kan prependas i `text`, eller ligga i dokumentet bredvid. Att lägga till en kolumn är en migration mot prod-DB (se §5) för kosmetik. **Skjut.** Om instruktionen blir ful inbakad i `text` - lägg till kolumnen DÅ, som egen liten migration. |
| `Question.rubricId` + `Rubric` + `RubricCriterion` | Backend | **NEJ** | Backend flaggar själv (v1-tabellen) att Rubric inte behövs för v1. Två tabeller och en FK för att visa kriterier i appen som ingen bett om. Kriterierna lever i `bedomningskriterier.md`. **Skär.** |
| Höj `respondSchema.max(5000)` -> `20000` | Backend | **JA** | Detta är den enda fält-/validatorändringen jag försvarar. En perspektivanalys på 1500+ ord sprängs av 5000-teckengränsen. Det är en applikationsändring, ingen migration. Behåll en gräns (20000) mot 10MB-svar. |

**Domen (motsägelse 3):** Inga nya frågetyper. Ingen `feedbackLevel` (LMS-drift). Ingen `instructions` i v1 (prepend i text). Ingen Rubric. Enda fältändringen: höj svarslängdsgränsen i `validators.ts` - noll migration.

---

## 5. MCP-verktygsexplosionen: sex föreslagna, två behövs

Förslagen tillsammans: `create_unit`, `get_unit_report`, `delete_survey`, `delete_unit`, `import_moment`, `get_moment_report`, plus "utöka `save_feedback` med level". Backend och integration döper dessutom samma sak olika (`create_unit`/`import_moment`, `get_unit_report`/`get_moment_report`).

| Verktyg | Behövs v1? | Motivering |
|---|---|---|
| `import_moment` / `create_unit` | **JA - ett av dem** | Skapa momentet + dess surveys i ett anrop. Detta är det enda nya verktyget `/planera-moment` strikt behöver. Bygg på `createQuizFromCsv`-transaktionen, sätt `unitId`. Integrationens JSON-manifest är ett rimligt kontrakt MEN kan förenklas: v1 behöver bara `title` + en array surveys (CSV per survey). Lärandemål/kriterier/min_length i manifestet lagras INTE i DB (integration §b har rätt) - de konsumeras av Claude vid feedback/rapport. |
| `get_moment_report` / `get_unit_report` | **JA - ett av dem** | Returnerar momentets aggregat i ett anrop istället för N. Detta ersätter app-rapportvyn (§2). Wrappar befintliga `summarize_results` + `get_student_progress` + `feedback/pending` per survey i momentet. |
| `delete_survey` | **JA** | Verifierat gap: webbappen har `DELETE /api/surveys/[id]` men MCP kan inte radera. En felpushad `/planera-moment`-körning kan inte städas via MCP idag. Litet, speglar befintlig route. Behåll. |
| `delete_unit` | Marginellt | Om `Unit` införs (§1) behövs ett sätt att radera den. Men kan klaras med `onDelete: SetNull` + `delete_survey` x N i v1. **Skjut** om tidsnöd; annars en trivial spegling. |
| `update_question` / `update_survey` | **NEJ** | Backend och DevilsAdvocate eniga: delete+recreate räcker tills behov bevisas. |
| Utöka `save_feedback` med `level` | **NEJ** | Följer av att `feedbackLevel` skärs (§4). |

**Domen (motsägelse 4):** Tre verktyg i v1: `import_moment` (skapa moment+surveys), `get_moment_report` (aggregat för Claude-rapporten), `delete_survey` (städning, känt gap). `delete_unit` är en stretch-spegling. Allt annat skärs. Det är hälften av vad backend föreslog.

---

## 6. Prod-DB-arbetet: kan funktionen byggas med NOLL migrationer? Nästan - och det avgör scopet.

Detta är prompten s skarpaste fråga och svaret är pedagogiskt.

**Prejudikatet:** Partial submission - en jämförbart stor funktion - levererades med NOLL migrationer (spec rad 219, verifierat). Den utnyttjade att `Answer` redan är en child-relation. Frågan är om moment-grupperingen kan göra samma.

**Vad KAN byggas med noll migrationer:**
- Skrivuppgifter i appen: redan FREE_TEXT. Noll migration.
- Större textarea: CSS. Noll migration.
- Längre svar: `validators.ts`-konstant. Noll migration.
- Feedback: `Answer.feedback` finns, `save_feedback` finns, `feedback/pending` finns. Noll migration.
- Rapporten: aggregeras av MCP-verktyg över befintliga tabeller + Claude. Noll migration.
- **Gruppering: detta är det enda som vill ha en kolumn.**

Så frågan kokar ner till: är `Survey.unitId` + `Unit`-tabell värt EN additiv migration mot prod?

**Två vägar:**

- **Väg NOLL-migration (integrationens linje, hårdast YAGNI):** Gruppering = Claude håller survey-ID-listan, ELLER ännu enklare: en namnkonvention/prefix i survey-titeln (`[Källkritik] L3 Exit ticket`) som `get_moment_report` filtrerar på. Noll schema, noll migrationsrisk mot prod. Nackdel: skört, prefix är fult, och `get_moment_report` måste gissa grupperingen.

- **Väg EN-migration (min rekommendation):** En enda additiv, nullbar `Survey.unitId` + en `Unit`-tabell. Verifierat låg-risk: additivt, inga DROP, inga NOT NULL på befintliga rader (precis som backend §e.2 visar). MEN process-riskerna är reella och verifierade: `.env` -> prod (spec 212), `setup` kör `db push` (package.json:10), `migration_lock.toml` saknas. Dessa MÅSTE åtgärdas först: skapa Neon-branch-DB, lägg till lock-fil, kör `migrate dev` mot branchen, granska SQL:en, `migrate deploy` mot prod.

**Domen (motsägelse 5):** Bygg med EN migration, inte fem - men bara EFTER att dev-branch-DB:n finns. Allt utom grupperingen byggs med noll migrationer. Den enda kolumnen som motiverar processrisken är `Survey.unitId` (+ `Unit`-tabell), eftersom den gör rapporten reproducerbar mellan Claude-sessioner. `instructions`, `feedbackLevel`, `orderInUnit`, `rubricId` och Rubric-tabellerna läggs INTE i denna migration - de är scope creep som dubblar migrationsytan för funktioner ingen bett om. Om dev-branch-DB:n inte hinner sättas upp: fall tillbaka på prefix-konventionen (noll migration) och leverera resten.

---

## Föreslaget vs enklare alternativ

| De tre föreslog | Enklare alternativ |
|---|---|
| `Module` + `ModuleItem` (frontend) | En kolumn `Survey.unitId` + tunn `Unit`-tabell. Ingen join-tabell (en enkät = max ett moment). |
| `Unit` + `Rubric` + `RubricCriterion` + 5 kolumner (backend) | `Unit` + `Survey.unitId`. Inget annat. Kriterier i `bedomningskriterier.md`, inte i DB. |
| App-rapportvy: 4 routes + 6 komponenter + 6 API-routes (frontend+backend) | ETT MCP-verktyg `get_moment_report` -> Claude skriver rapporten till `output/`. Noll rapport-routes, noll rapport-komponenter. |
| `LONG_TEXT`-typ (2 CSV-parsrar + saveFeedback-vakt) | FREE_TEXT + `rows`-fix i `QuestionRenderer.tsx:88`. Noll ny typ. |
| `Answer.feedbackLevel "E"/C/A` | Inget. Nivå hör till lärarens fritextomdöme, inte en DB-kolumn. (LMS-drift.) |
| `Question.instructions` kolumn | Prepend i `Question.text`, eller dokumentet bredvid. Kolumn senare vid bevisat behov. |
| `Question.rubricId` + 2 rubric-tabeller | `bedomningskriterier.md` läst av Claude vid feedback/rapport. |
| 6 MCP-verktyg | 3: `import_moment`, `get_moment_report`, `delete_survey`. |
| Typmedveten "Klar"-status via `mastery.ts` (false vid 1 svar) | Binär status {Ej börjad, Utkast, Inlämnad} från Response/Draft. |
| Bygg "X svar väntar på feedback"-signal (frontend §3.3) | Finns redan: `GET /api/surveys/[id]/feedback/pending`. |
| Höj `respondSchema` till 20000 (backend) | Behåll - det är den enda fält-/validatorändringen som är vettig. Noll migration. |
| 5 additiva migrationer mot prod | 1 migration (`Unit` + `Survey.unitId`), efter dev-branch-DB. Eller 0 via titelprefix om branchen dröjer. |

---

## Vad bör byggas NU (minsta vettiga v1)

Lärarens tre önskemål - (1) elever gör alla uppgifter i appen, (2) elever får feedback, (3) läraren får en rapport - levereras så här:

**Önskemål 1: uppgifter i appen (inkl. skrivuppgifter)**
1. Skrivuppgift = befintlig `FREE_TEXT`. **Inga nya frågetyper.**
2. `QuestionRenderer.tsx:88`: byt `rows={3}` mot auto-grow / `min-h`. Synlig "utkast sparat"-status vid skrivfältet (mekaniken finns redan i `StudentQuizForm`). **Ingen DB.**
3. Höj `respondSchema.value.max(5000)` -> `max(20000)` i `validators.ts`. **Ingen migration.**
4. EN ny elevsida `student/moment/[id]`: lista momentets uppgifter i ordning med binär status (Ej börjad/Utkast/Inlämnad), återanvänder survey-flödet oförändrat. `?moment=`-param för tillbaka-länk. **Inte fyra routes - en.**

**Önskemål 2: feedback**
5. Återanvänd `Answer.feedback` + `FeedbackButton` (finns). Neutralisera etiketten "AI-feedback" -> "Återkoppling" (transparens). **Ingen ny mekanik, ingen ny kolumn.** Lärargrind på AI-utkast är icke-förhandlingsbar (etisk gräns).
6. "Väntar på feedback"-signal: använd befintlig `GET /api/surveys/[id]/feedback/pending`. **Bygg ingenting.**

**Önskemål 3: rapport**
7. **Ingen app-rapportvy.** `get_moment_report` MCP-verktyg returnerar aggregat (completion + flervalsfördelning + alla fritextsvar + flaggor) över momentets surveys. Claude skriver pedagogisk rapport mot `bedomningskriterier.md` till `output/`. Varje rad ska leda till en lärarhandling.

**Gruppering (förutsättning för 4 och 7)**
8. EN additiv migration: `Unit`-tabell (id, title, courseId, createdAt) + nullbar `Survey.unitId`. **Först efter** Neon-branch-DB + `migration_lock.toml` + manuell SQL-granskning. Fallback utan migration: titelprefix.
9. MCP: `import_moment` (skapa moment + surveys i ett anrop, bygg på `createQuizFromCsv`) och `delete_survey` (känt gap).

**Entiteter:** 1 ny tabell (`Unit`) + 1 nullbar kolumn (`Survey.unitId`).
**Verktyg:** 3 (`import_moment`, `get_moment_report`, `delete_survey`).
**Migrationer:** 1 (eller 0 via prefix).
**Nya elev-routes:** 1. **Nya admin-routes:** 0. **Nya rapport-komponenter:** 0.

### Uttryckligen bortskuret (och varför)

- `Module`/`ModuleItem`-join: ingen bett om en enkät i flera moment.
- `Rubric` + `RubricCriterion` + `Question.rubricId`: kriterier lever i markdown, inte DB.
- `Answer.feedbackLevel E/C/A`: betygssättning i databasen = LMS-drift, bryter mot "appen bedömer inte".
- `Question.instructions` (v1): prepend i text räcker; kolumn vid bevisat behov.
- `LONG_TEXT`-typ: FREE_TEXT räcker; skulle tvinga ändring i 2 CSV-parsrar + `saveFeedback`-vakten för noll vinst.
- App-rapportvy (4 routes, `ModuleReportMatrix`, `ModuleStudentReport`, `units/[id]/report`-API): Claude + MCP gör det bättre och billigare; läraren är redan i sessionen.
- `update_question`/`update_survey` MCP: delete+recreate räcker.
- Mastery-baserad "Klar"-status: `mastery.ts` returnerar alltid false vid 1 svar; vilseledande badge.
- `orderInUnit` i första migrationen: `createdAt` räcker tills ordning faktiskt stör.

### Kvarstående risker

- **Prod-DB är enda DB** (`.env` -> prod, `setup` kör `db push`). Process-, inte kod-risk. Dev-branch-DB är ovillkorligt först.
- **Saknad `migration_lock.toml`** - lägg till före nästa `migrate dev`.
- **Dubbel Prisma-klient** (app + mcp-server) - kör `prisma generate` i båda efter migration, annars kraschar `import_moment` på okänt `unitId`-fält.
- **Dubbel CSV-parser** - om någon ändå inför en ny typ måste `csv.ts` OCH `create-quiz-from-csv.ts` ändras synkront. Argument till att INTE införa LONG_TEXT.
- **Skrivuppgift som förloras** - autospar finns, men gör spar-statusen mycket synlig vid skrivfältet. Förtroendekritiskt.
