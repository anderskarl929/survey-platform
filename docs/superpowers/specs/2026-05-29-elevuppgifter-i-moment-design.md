# Elevuppgifter i moment: gruppering, feedback och lärarrapport

**Datum:** 2026-05-29
**Status:** Godkänd för implementation plan (v1-scope fastställt efter 4-agentsanalys + djävulens advokat)
**Underlag:** `docs/elevuppgifter/01-frontend-ux.md`, `02-backend.md`, `03-integration-flode.md`, `04-devils-advocate.md`

## Mål

Läraren ska kunna ta ett helt undervisningsmoment som genererats med `/planera-moment` och låta eleverna göra momentets elevuppgifter i appen, samlade som ett moment. Eleverna får feedback i appen. Läraren får en rapport om hur arbetet gått - genererad av Claude via MCP, inte som en app-vy i v1.

Tre konkreta önskemål från läraren:
1. Elever ska kunna göra ALLA elevuppgifter från ett moment i appen (inte bara exit-ticket-flerval, även skrivuppgifter).
2. Elever ska få feedback på uppgifterna i appen.
3. Läraren ska få en rapport om hur varje elevs och klassens arbete gått.

## Designprincip (rättesnöre genom hela arbetet)

Detta är en enkätplattform för EN lärare med <100 elever, inte ett LMS. Funktionen byggs med minsta möjliga nya yta. Regeln för vad som hör hemma i appen: **ett individuellt insamlingsbart elevsvar går in i appen; läsning, muntligt, EPA och grupparbete förblir dokument/klassrum.** Appen är en svarsinsamlare och feedbackkanal - den pedagogiska tolkningen görs av läraren med Claude som stöd.

## Nuvarande beteende (innan ändring)

- En `Survey` (mode SURVEY eller QUIZ) är den största innehållsenheten. Det finns inget begrepp "moment" som grupperar flera surveys.
- `/planera-moment`-uppgifter når appen idag bara som exit-ticket-flerval via MCP-verktyget `create_quiz_from_csv` (en survey i taget).
- Skrivuppgifter stöds redan av frågetypen `FREE_TEXT`, men svarsrutan är hårdkodad till `rows={3}` (`src/components/QuestionRenderer.tsx:88`) och `respondSchema` kapar svar vid 5000 tecken (`src/lib/validators.ts:8`).
- Feedback finns på två nivåer: per svar (`Answer.feedback`, satt via MCP `save_feedback`) och per elev om uppgift utanför plattformen (`AssignmentFeedback`, satt via `post_assignment_feedback`). `GET /api/surveys/[id]/feedback/pending` returnerar redan vilka fritextsvar som saknar feedback.
- MCP-servern har 11 verktyg men **inget** `delete`- eller `update`-verktyg. Webbappen har `DELETE /api/surveys/[id]` men det går inte att nå från en Claude-session. (Detta blev konkret denna morgon: tre felaktiga quizzar gick inte att radera via MCP.)
- Elevens dashboard (`src/app/student/page.tsx`) är en server-komponent som listar alla kursens surveys platt, med en mastery-baserad "Klar"-badge.
- `mastery.ts:15` returnerar `false` om en fråga har färre än 2 svar. I ett engångsmoment blir mastery därför alltid `false` - en rapport eller statusbadge får aldrig bygga "klar" enbart på mastery.

## Beslut

Fem designval, fastställda efter analys och djävulens advokat:

1. **Moment = en tunn `Unit`-tabell, inte en ny innehållsenhet.** En `Unit` grupperar befintliga `Survey`-rader under en kurs via en nullbar `Survey.unitId`. Vi återanvänder `Survey` som "uppgift" - ingen parallell `Assignment`-entitet, ingen `Module`+`ModuleItem`-join (ingen har bett om enkät-i-flera-moment). Att hålla grupperingen helt utanför DB:n (Claude håller en survey-ID-lista) förkastas: det blir skört mellan sessioner och gör rapportaggregeringen svår.

   Momentet bär dessutom en **lektionsöversikt** (`Unit.lessons`, JSON: alla momentets lektioner med titel, även de utan digital uppgift) och varje uppgift knyts till en lektion (`Survey.lesson`). Det låter eleven följa hela lektionsbågen och gå tillbaka till missade eller redan gjorda uppgifter. En separat `Lesson`-tabell övervägdes men valdes bort: lektionsöversikten är display-metadata som inte joinas mot, så ett JSON-fält är lättare och håller migrationen liten. Kan normaliseras till en tabell senare om behov uppstår.

2. **Skrivuppgift = befintlig `FREE_TEXT`.** Ingen ny frågetyp (`LONG_TEXT` förkastas - skulle tvinga ändringar i två separata CSV-parsrar och feedback-vakten). Enda anpassningar: större svarsruta och höjd teckengräns. Båda är app-ändringar utan migration.

3. **Lärarrapporten genereras av Claude via MCP, inte som app-vy (v1).** Ett MCP-verktyg `get_moment_report` aggregerar momentets rådata; Claude tolkar mot `bedomningskriterier.md` och skriver rapporten till `output/`. En klickbar admin-rapportsida byggs först i v2 om läraren saknar en alltid-tillgänglig statusvy. Motiv: en `<table>` kan visa rådata, men det pedagogiskt värdefulla (missuppfattningar, vilka teman tillbaka i retrieval) kan bara en LLM syntetisera - och läraren sitter ändå redan i en Claude-session.

4. **Feedback återanvänder befintliga kanaler.** Flerval rättas automatiskt (`isCorrect`). Formativa fritextsvar: läraren använder `get_answers_for_feedback` -> Claude skriver utkast mot kriterierna -> läraren godkänner -> `save_feedback`. Summativa moment: `bulk_post_assignment_feedback`. Inga nya feedback-mekanismer. AI får skriva utkast; läraren äger alltid bedömningen (grindsteg, aldrig tyst auto-post). Ingen `feedbackLevel` (E/C/A) i databasen - det vore betygssättning i appen och bryter mot designprincipen.

5. **Tre nya MCP-verktyg, inte sex.** `import_moment` (skapar moment + alla uppgifter atomärt), `get_moment_report` (aggregat för rapport), `delete_survey` (fyller delete-gapet). `delete_unit`, `update_*` och kriterie-persistens skjuts till senare.

## Förändringar per lager

### 1. Datamodell (`prisma/schema.prisma`) - en additiv migration

Ny modell:

```prisma
model Unit {
  id          Int      @id @default(autoincrement())
  title       String
  description String   @default("")
  lessons     Json?    // lektionsöversikt: [{ "n": 1, "title": "...", "note": "läsning + diskussion" }]
  courseId    Int
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  surveys     Survey[]

  @@unique([courseId, title])
}
```

`Course` får `units Unit[]`. `Survey` får:

```prisma
  unitId Int?
  unit   Unit? @relation(fields: [unitId], references: [id], onDelete: SetNull)
  lesson Int?  // lektionsnummer som matchar Unit.lessons[].n; null = ej kopplad till lektion
  // ... och längst ner:
  @@index([unitId])
```

`Unit.lessons` är hela lektionslistan (även lektioner utan digital uppgift, som visas som kontext). `Survey.lesson` pekar på en lektions `n`. Ordning: lektioner sorteras på `lessons[].n`, uppgifter inom en lektion på `Survey.createdAt asc`. Ingen `orderInUnit`-kolumn. Migrationen är rent additiv (CREATE TABLE + ADD COLUMN nullable + index + FK) - noll dataförlust; befintliga surveys får `unitId = NULL` och `lesson = NULL`.

### 2. App-finputs utan migration

- `src/lib/validators.ts:8`: `.max(5000, ...)` -> `.max(20000, "Svaret är för långt")`. Ger skrivsvar plats.
- `src/components/QuestionRenderer.tsx:88`: `rows={3}` -> `rows={8}`. Skrivuppgift får en rimlig svarsyta. (Autospar finns redan via draft-systemet; gör spar-status synlig - se UX nedan.)

### 3. Elevens momentsida (server-komponent, ingen ny API-route)

Ny route `src/app/student/moment/[unitId]/page.tsx`, server-komponent byggd som `student/page.tsx`. Den renderar **hela momentets lektionsbåge** så eleven kan följa momentet och gå tillbaka till missade eller redan gjorda uppgifter:
- `getStudentSession()` -> verifiera att `unit.courseId === session.courseId` (annars redirect).
- Läs `unit.lessons` (lektionsöversikten) och momentets surveys (`where: { unitId }`).
- Rendera lektionerna i ordning (`lessons[].n`). Under varje lektion: de uppgifter vars `Survey.lesson` matchar lektionsnumret, sorterade på `createdAt`.
- **Lektioner utan matchande uppgift visas som kontext** med lektionens `note` (t.ex. "läsning + diskussion - ingen digital uppgift, se lektionsmaterialet").
- Per uppgift: status **Inlämnad** / **Utkast sparat** / **Ej påbörjad** (bygger på inlämning/utkast, INTE mastery) + knapp till `/student/quiz/[surveyId]`: "Starta" / "Fortsätt" / "Visa - öva igen". "Öva igen" fungerar redan eftersom omtag är tillåtna (migrationen `allow_response_retakes`).
- Per lektion: en aggregerad status (klar / pågår / ej påbörjad) av lektionens uppgifter.
- Surveys i momentet utan lektionskoppling (`lesson = null`) hamnar i en "Övriga uppgifter"-sektion sist.
- Toppsummering: "X/Y uppgifter inlämnade".

Upptäckbarhet på dashboarden (`src/app/student/page.tsx`): en "Moment"-sektion överst listar kursens units (titel + "X/Y inlämnade") som länkar till respektive momentsida. Surveys som tillhör ett moment filtreras bort ur den befintliga platta listan så de inte dubbelvisas; fristående surveys (utan `unitId`) listas som idag.

### 4. MCP-verktyg (`mcp-server/`)

Tre nya verktyg, registrerade i `mcp-server/src/server.ts` enligt befintligt `server.tool(...)`-mönster med try/catch:

- **`import_moment`** (`tools/import-moment.ts`): skapar en `Unit` (inkl. lektionsöversikt) + N surveys atomärt i en `prisma.$transaction`. Återanvänder fråge-/topic-skapandelogiken från `create-quiz-from-csv.ts`. Signatur: `course_id`, `title`, `description?`, `lessons: { n, title, note? }[]` (hela lektionsbågen, fylls från momentplanen), `assignments: { title, lesson?, mode?, lock_mode?, csv_content }[]`. Sätter `Survey.lesson` per uppgift. Returnerar `{ unitId, title, assignments: [{ title, lesson, shareCode, url, questionCount }] }`.
- **`get_moment_report`** (`tools/get-moment-report.ts`): aggregerar momentets rådata till markdown (mönster från `summarize-results.ts`, men itererar över unitens surveys). Innehåll: completion per survey och per elev, flervals-% per fråga, alla fritextsvar, flaggade frågor. Avslutas med en instruktion till Claude att korsläsa `bedomningskriterier.md` och syntetisera rapporten. Signatur: `unit_id`.
- **`delete_survey`** (`tools/delete-survey.ts`): `prisma.survey.delete({ where: { id } })`, returnerar bekräftelse med titel. Fyller delete-gapet.

Efter schemaändring måste `prisma generate` köras i BÅDE webbappen och `mcp-server/` (separata klienter) - annars kraschar `import_moment`/`get_moment_report` på okänt `unitId`.

## Lärarrapportens innehåll (genereras av Claude, inte byggd i appen)

`get_moment_report` levererar underlaget; Claude skriver rapporten mot `bedomningskriterier.md`.

- **Klassnivå:** completion per uppgift/lektion; exit-ticket-trend över momentets lektioner; andel rätt per topic (matar retrieval review - led med detta, inte mastery); flaggade frågor; 2-3 fritext-klasstrender (Claude-syntes).
- **Per elev:** completion; exit-ticket-utveckling (förstod/osäker/missade); skrivsvarens status och kvalitet med E/C/A som **lärarstöd-indikation, aldrig satt betyg**; postade summativa omdömen; flagga elever som halkar efter.
- **Exkluderat:** satta betyg, tidsspårning/klickdata, gamification, prediktiva risk-scores. Varje rad i rapporten ska leda till en lärarhandling.

## Användarflöden efter ändring

### Läraren publicerar ett moment
1. `/planera-moment` har genererat momentet (momentplan, bedömningskriterier, elevuppgifter) i `output/lessons/...`.
2. Läraren ber Claude: "importera det här momentets uppgifter till kurs X." Claude anropar `import_moment` med en assignment per digital uppgift (exit tickets + skrivuppgifter).
3. Verktyget skapar en `Unit` + surveys, returnerar delningslänkar. Eleverna ser momentet på sin dashboard.

### Eleven gör momentet
1. Eleven loggar in, ser "Moment: [titel] - 0/4 inlämnade" på dashboarden, klickar in.
2. Momentsidan listar de fyra uppgifterna med status. Eleven gör en flervalsfråga (rättas direkt) och en skrivuppgift (FREE_TEXT, stor svarsruta, autospar).
3. Partiell inlämning tillåts (separat spec 2026-04-13). Status uppdateras till Inlämnad.

### Eleven får feedback
1. Flerval: ser rätt/fel direkt.
2. Skrivsvar: läraren kör `get_answers_for_feedback`, Claude föreslår feedback mot kriterierna, läraren godkänner, `save_feedback`. Eleven ser feedbacken kopplad till sitt svar.

### Läraren får rapporten
1. Läraren ber Claude om en momentrapport. Claude anropar `get_moment_report(unit_id)`, läser `bedomningskriterier.md`, skriver rapporten till `output/`.

## Utanför scope (v1)

- **Ingen app-rapportvy.** Inga admin-routes för moment, ingen `ModuleReportMatrix`, ingen `units/[id]/report`-API. (v2 om behovet bevisas.)
- **Ingen `Rubric`/`RubricCriterion`-tabell, ingen `Question.instructions` i DB.** Uppgiftsinstruktioner prependas i frågetexten vid import. Kriterier bor kvar i `bedomningskriterier.md` (master), läses av Claude.
- **Ingen `LONG_TEXT`-typ, ingen `Answer.feedbackLevel`.**
- **Ingen `orderInUnit`-kolumn och ingen `Lesson`-tabell.** Lektionsstrukturen bärs av `Unit.lessons` (JSON) + `Survey.lesson`; ordning inom en lektion = `createdAt`.
- **Inget deadline-begrepp.** "Missat" = ej inlämnad/ej påbörjad. Riktiga deadlines är en egen funktion om det önskas.
- **Inga `delete_unit`/`update_*`-MCP-verktyg.** (Caveat: tomma units kan inte städas via MCP i v1 - acceptabelt tills behov uppstår.)
- **Ingen ändring i respond/scoring/draft-logiken.** Partiell inlämning hanteras av separat spec.

## Testning

Projektet saknar testsvit. Verifiering:
1. `npx tsc --noEmit` i både repo-roten och `mcp-server/` - fångar typfel från `Unit`/`unitId` och de nya verktygen.
2. `npm run build` (kör `prisma generate` + `prisma migrate deploy` + `next build`). Varning: `build` kör `migrate deploy` mot DB:n som `.env` pekar på.
3. Manuell smoke-test mot **dev-branch-DB** (inte prod): `import_moment` -> verifiera Unit + surveys -> elev gör uppgifter -> `get_moment_report` -> `delete_survey`.

## Beroenden och risker

- **R1 - Prod är enda databasen.** Lokal `.env` pekar på prod-Neon, och `setup`-scriptet kör `prisma db push`. En felaktig push kan diffa bort kolumner. **Åtgärd: skapa en Neon dev-branch och peka dev-`.env` dit INNAN någon migration. Deploya till prod endast med `prisma migrate deploy`, aldrig `db push`.** Ta en branch-snapshot av prod som backup först.
- **R2 - `migration_lock.toml` syns inte i `prisma/migrations/`.** Verifiera/återskapa den (provider `postgresql`) före `prisma migrate dev`, annars vägrar/varnar Prisma.
- **R3 - Dubbel Prisma-klient** (webbapp + `mcp-server/`). `prisma generate` måste köras i båda efter migrationen.
- **R4 - Dubbel CSV-parser** (`src/lib/csv.ts` + logiken i `create-quiz-from-csv.ts`). Eftersom v1 inte inför nya frågetyper biter detta inte nu, men det är ett argument mot att lägga till typer framöver.
- **R5 - mastery alltid false i engångsmoment.** Momentsidans status och rapporten måste bygga på inlämning/andel-rätt, inte mastery.
- **R6 - Scope creep mot LMS.** Håll `Unit` tunn. Varje föreslagen utökning vägs mot designprincipen.

## Fallback om dev-branch dröjer

Om en dev-DB inte kan sättas upp i tid kan v1 levereras med **noll migrationer**: hoppa över `Unit`-tabellen och koda momenttillhörighet via ett titelprefix på surveys (t.ex. `[Källkritik] Lektion 1`). `import_moment` sätter prefixet, momentsidan/rapporten grupperar på prefix. Fulare och svagare, men byggbart utan att röra prod-schemat - precis som partial-submission levererades utan migration. Rekommenderas endast som nödlösning.
