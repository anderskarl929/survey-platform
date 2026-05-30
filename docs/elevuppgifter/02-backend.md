# Backend-arkitektur: Elevuppgifter genom ett helt moment

**Roll:** Backend-arkitekt (ren analys och design - ingen kod ändrad)
**Datum:** 2026-05-29
**Projekt:** survey-platform (Next.js 16 / React 19 / Prisma 6 / Neon Postgres / next-auth beta)

> Detta dokument analyserar OM och HUR backend behöver förändras för att låta elever göra
> ett helt moments uppgifter i appen, få feedback, och ge läraren en momentrapport.
> Inga migrationer körs, ingen applikationskod ändras här. Husstilen från
> `docs/superpowers/specs/2026-04-13-partial-submission-design.md` följs (tät spec, additiva
> ändringar, namnbyten bara när det är säkert). DevilsAdvocate-etoset hedras: minsta möjliga
> datamodell, skilj "v1" från "senare", uppfinn inte LMS-entiteter.

---

## 0. Sammanfattning av nuläget (vad som redan finns)

Datamodellen är redan förvånansvärt nära det som behövs:

- `Survey` (`prisma/schema.prisma:66-79`) är redan kopplad till `Course` (rad 73-74), har `mode`
  (SURVEY|QUIZ, rad 71), `lockMode` (rad 72) och en ordnad lista frågor via `SurveyQuestion`
  (rad 81-90, `order`-fält).
- `Question.type` (rad 49) är redan en fri sträng-kolumn (`MULTIPLE_CHOICE | FREE_TEXT`) - INTE en
  Postgres-enum. Att lägga till nya typvärden kräver alltså **ingen** schema-migration på kolumnnivå.
- `Answer.value` (rad 111) är `String` (Postgres `TEXT`, obegränsad) - rymmer redan långa skrivsvar.
  `respondSchema` (`src/lib/validators.ts:3-13`) kapar dock vid `max(5000)`.
- `Answer.feedback` (rad 112, `String?`) finns redan per svar. `AssignmentFeedback` (rad 155-166)
  finns för fritextfeedback om externa uppgifter, kopplad till elev (inte till svar/uppgift).
- Partial submission stöds redan fullt ut: `respond`-routen itererar bara över inskickade svar
  (`src/app/api/surveys/[id]/respond/route.ts:79-100`), och scoring filtrerar på `isCorrect !== null`.
- `Response` tillåter retakes (en elev kan ha flera Response på samma Survey - se migration
  `20260413084717_allow_response_retakes` och avsaknaden av unik `[surveyId, studentId]`).
- Mastery (`src/lib/mastery.ts`) räknar "behärskad" = två senaste svaren rätt på samma fråga,
  över flera Response. Den fungerar redan på tvärs av enkäter eftersom den tar emot en platt lista
  `ResponseRecord[]`.

**Slutsats:** Det som saknas är (1) ett sätt att **gruppera flera enkäter till ett moment**,
(2) **rikare uppgiftstyper** med bedömningskriterier, (3) en **rapport-aggregering på momentnivå**,
och (4) **MCP-verktyg** som kan pusha in ett helt moment och städa upp (delete/update saknas helt).

---

## (a) Datamodell

### a.1 Behövs en "Moment/Unit"-entitet? JA - men minimal.

Idag kan `/planera-moment` via `create_quiz_from_csv` skapa flera enkäter, men det finns inget som
binder ihop dem. Läraren vill ha en rapport "per moment". Utan en gruppering måste man manuellt veta
vilka enkät-ID:n som hör ihop. Det är just den sortens bokföring appen ska ta bort.

Den minsta lösningen är **en gruppering, inte en ny uppgiftshierarki**. Vi inför `Unit`
(svenska i UI: "Moment") som en tunn parent över `Survey`. En `Survey` är fortfarande den konkreta
uppgiften/enkäten; `Unit` är bara mappen.

```prisma
model Unit {
  id          Int      @id @default(autoincrement())
  title       String
  description String   @default("")
  courseId    Int
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  surveys     Survey[]

  @@index([courseId])
}
```

Tillägg på befintliga modeller (alla additiva, nullable - inga dataförluster):

```prisma
model Course {
  // ... befintligt ...
  units    Unit[]      // NYTT
}

model Survey {
  // ... befintligt ...
  unitId      Int?     // NYTT - nullable: fristående enkäter har inget moment
  unit        Unit?    @relation(fields: [unitId], references: [id], onDelete: SetNull)
  orderInUnit Int?     // NYTT - ordning på uppgifter inom momentet (L1, L2, ...)

  @@index([unitId])    // NYTT
}
```

Designval (DevilsAdvocate-linje):
- **`unitId` är nullable.** Befintliga enkäter rörs inte; en enkät utan moment fungerar exakt som idag.
  `onDelete: SetNull` betyder att man kan radera ett moment utan att förlora enkäterna.
- **Vi återanvänder `Survey` som "uppgift".** Vi inför INTE en separat `Assignment`-entitet. En skriv-
  uppgift är en `Survey` i SURVEY-läge med en `FREE_TEXT`/`LONG_TEXT`-fråga; ett quiz är en `Survey` i
  QUIZ-läge. Detta undviker att duplicera respond/results/draft/feedback-pipelinen som redan finns för
  Survey. Att uppfinna en parallell `Assignment` skulle vara klassisk scope creep.

### a.2 Rikare uppgiftstyper bortom MULTIPLE_CHOICE/FREE_TEXT

`Question.type` är en sträng-kolumn, inte en enum (`schema.prisma:49`). Nya typer kräver alltså
**ingen kolumnmigration** - bara nya tillåtna värden i validator + UI. Det enda som måste hanteras i
DB är de tillkommande **metadatafält** en rik uppgift behöver (instruktion + bedömningskriterier).

Föreslagna nya `type`-värden:
- `LONG_TEXT` - längre skrivuppgift (perspektivanalys, uppsatssvar). Skiljer sig från `FREE_TEXT`
  bara i UI (textarea-höjd, ev. ordräknare) och i att den aldrig auto-rättas (`isCorrect` förblir null,
  precis som FREE_TEXT redan gör i `respond/route.ts:80-89`).

Det innebär att vi **inte tvunget behöver fler typer för v1**. `LONG_TEXT` är i praktiken `FREE_TEXT`
med ett UI-hint + bedömningskriterier. Men eftersom skrivuppgiften i exemplet
(`output/.../bedomningskriterier.md`) har E/C/A-kriterier och en lärarinstruktion behöver `Question`
två nya valfria fält:

```prisma
model Question {
  // ... befintligt ...
  instructions String?   // NYTT - längre uppgiftsinstruktion (utöver kort "text")
  rubricId     Int?      // NYTT - valfri koppling till bedömningskriterier
  rubric       Rubric?   @relation(fields: [rubricId], references: [id], onDelete: SetNull)
}
```

### a.3 Bedömningskriterier (rubric) - egen tunn entitet

Exemplet `bedomningskriterier.md` är E/C/A-nivåer i fritext. Den enklaste trogna representationen är
en `Rubric` med rader per nivå. Vi gör den återanvändbar (en rubric kan delas av flera frågor) men
håller den platt:

```prisma
model Rubric {
  id        Int           @id @default(autoincrement())
  title     String
  courseId  Int
  course    Course        @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt DateTime      @default(now())
  criteria  RubricCriterion[]
  questions Question[]

  @@index([courseId])
}

model RubricCriterion {
  id          Int    @id @default(autoincrement())
  rubricId    Int
  rubric      Rubric @relation(fields: [rubricId], references: [id], onDelete: Cascade)
  level       String // "E" | "C" | "A" (fri sträng, ingen enum - samma stil som Question.type)
  description String // fritextbeskrivning av nivån
  order       Int    @default(0)

  @@index([rubricId])
}
```

Och `Course` får `rubrics Rubric[]`.

**SENARE-flagga:** Rubric + RubricCriterion är inte strikt nödvändiga för att eleven ska kunna SVARA.
De behövs bara om man vill (1) visa kriterierna för eleven i appen, och (2) låta läraren koppla
feedback till en specifik nivå. För absolut v1 kan man hoppa Rubric helt och lägga kriterierna som
fri text i `Question.instructions`. Se v1/senare-tabellen.

### a.4 Räcker befintliga Survey/Question/Answer? - JA för svaren, NEJ för grupperingen

- **Svar (Answer):** Räcker helt. `value` är TEXT, partial submission funkar, retakes funkar.
  Längre skrivsvar behöver bara att `respondSchema.max(5000)` höjs (se nedan, validators).
- **Frågor (Question):** Räcker, plus de två nullable-fälten ovan (`instructions`, `rubricId`).
- **Enkäter (Survey):** Räcker, plus `unitId`/`orderInUnit`.
- **Gruppering:** Saknas - därav `Unit`.

### a.5 Längre skrivsvar och validator

`src/lib/validators.ts:8` kapar svarsvärdet vid `max(5000)`. En LONG_TEXT-perspektivanalys kan vara
längre. Höj gränsen för långa svar (men behåll en gräns - DevilsAdvocate punkt 5 varnar för 10MB-svar):

```ts
// respondSchema, value:
value: z.string().min(1, "Svar krävs").max(20000, "Svaret är för långt"),
```

20 000 tecken ~ 3000-3500 ord, gott och väl för en gymnasieuppsats i appen. Detta är en applikations-
ändring, ingen DB-migration (kolumnen är redan obegränsad TEXT).

---

## (b) Feedback-lagring

### b.1 Räcker Answer.feedback + AssignmentFeedback? - JA, med en liten utökning.

Två feedbacknivåer finns redan:
- **Per svar:** `Answer.feedback` (`schema.prisma:112`). Sätts via `save_feedback` MCP-verktyg
  (`give-feedback.ts:64-90`), via `/api/surveys/[id]/questions/[questionId]/feedback` (admin batch),
  och läses av eleven via http-server `/feedback/:answerId`. Detta är rätt nivå för feedback på en
  uppgift i ett moment, eftersom en "uppgift" = en `Survey`-fråga och svaret = en `Answer`.
- **Per elev/extern uppgift:** `AssignmentFeedback` (`schema.prisma:155-166`) - fritext, har
  `readAt` (eleven kvitterar), visas i `/student/feedback` (`student/assignment-feedback/route.ts`).

**För feedback på elevuppgifter genom ett moment räcker `Answer.feedback`.** Eftersom uppgiften lever
som en Survey-fråga, ger man feedback på svaret precis som idag. Ingen ny entitet behövs för själva
texten.

### b.2 Vad som faktiskt saknas: koppling feedback -> kriterienivå + läs-kvittens

Två luckor:

1. **`Answer.feedback` saknar struktur.** Den är en naken sträng. Om läraren vill säga "detta svar
   ligger på C-nivå" finns ingen plats för det. Minsta tillägg:

   ```prisma
   model Answer {
     // ... befintligt ...
     feedbackLevel String?  // NYTT - valfri "E" | "C" | "A", speglar RubricCriterion.level
   }
   ```

   Detta är allt som behövs för att koppla feedback till bedömningskriterier. Vi behöver INGEN
   join-tabell mellan Answer och RubricCriterion för v1 - en enkel nivå-sträng räcker för en lärare
   med <100 elever. (Full kriterie-för-kriterie-bedömning = SENARE.)

2. **Eleven kan inte se/kvittera per-svar-feedback lika tydligt som AssignmentFeedback.**
   `Answer.feedback` har ingen `readAt`. För momentet vill läraren veta om eleven läst återkopplingen.
   **v1-beslut:** hoppa läs-kvittens på Answer-nivå. Den finns redan på AssignmentFeedback-nivå, och
   att lägga `readAt` på varje Answer är mer bokföring än värde för v1. Om läraren vill ge en
   sammanfattande momentåterkoppling med kvittens, använd befintlig `AssignmentFeedback`
   (title = momentets namn). SENARE: `Answer.feedbackReadAt DateTime?`.

### b.3 Slutsats feedback

- Per-uppgift-feedback genom moment: **återanvänd `Answer.feedback`** (inget nytt).
- Koppling till kriterier: **lägg till `Answer.feedbackLevel String?`** (en kolumn).
- Sammanfattande momentfeedback med kvittens: **återanvänd `AssignmentFeedback`** (inget nytt).

---

## (c) Lärarrapporten (queries / aggregeringar / API)

Rapporten ska svara: hur har varje elevs och klassens arbete gått genom HELA momentet?
Idag finns aggregering bara per enkät (`results/route.ts`, `summary/route.ts`,
`get-results.ts`, `get-student-progress.ts`). Inget på momentnivå.

### c.1 Vad som beräknas (per moment)

Per **elev** över momentets alla surveys:
- **Completion:** antal uppgifter eleven lämnat (>=1 Response), och per uppgift antal besvarade
  frågor / totalt (samma `answered`/`totalQuestions`-logik som i partial-submission-specen,
  `results/route.ts:92-108`).
- **Quiz-resultat:** andel rätt per quiz-survey (`correct/total/percentage` -
  återanvänd filtret `isCorrect !== null` precis som överallt idag).
- **Mastery per topic:** kör `calculateMastery` (`src/lib/mastery.ts:21-37`) över alla frågor i
  momentets topics och elevens samlade `ResponseRecord[]`. Mastery.ts behöver INGEN ändring -
  den tar redan en platt lista och fungerar tvärs över surveys.
- **Skrivsvarens status:** för varje LONG_TEXT/FREE_TEXT-fråga i momentet: lämnat? har feedback?
  feedbackLevel? (`Answer.feedback != null`, `Answer.feedbackLevel`).
- **Flaggade frågor:** antal `FlaggedQuestion` eleven satt på momentets frågor
  (`schema.prisma:121-131`).

Per **klass/moment** (aggregat):
- Andel elever som påbörjat / slutfört varje uppgift.
- Snitt-procent per quiz-survey och per topic.
- Topic-värmekarta: vilka topics har lägst mastery i klassen (= var nästa lektion bör fokusera,
  matchar lärarens exit-ticket-slinga i momentplan.md).
- Mest flaggade frågor (signal om otydlig fråga eller svårt stoff).

### c.2 Nya API-routes (admin, bakom `requireAdmin`)

Följ befintligt mönster: `await requireAdmin()` först (se `results/route.ts:9`), Prisma-include,
returnera JSON. Inga nya libbibliotek.

```
GET /api/courses/[courseId]/units
    -> lista moment i kursen (id, title, surveyCount, responseCount-aggregat)

POST /api/courses/[courseId]/units
    body: { title, description?, surveyIds?: number[] }
    -> skapar moment, kopplar valfria befintliga surveys (sätter unitId + orderInUnit)

GET /api/courses/[courseId]/units/[unitId]
    -> momentets surveys i ordning + ev. rubric-metadata

GET /api/courses/[courseId]/units/[unitId]/report
    -> SJÄLVA RAPPORTEN. Aggregerad shape nedan.

PATCH /api/courses/[courseId]/units/[unitId]
    body: { title?, description?, surveyIds? }  -> redigera/omkoppla
DELETE /api/courses/[courseId]/units/[unitId]
    -> raderar Unit (SetNull på surveys, enkäterna överlever)
```

Rapportens respons-shape (additiv, samma stil som partial-submission-specen):

```ts
{
  unit: { id, title, surveyCount, studentCount },
  surveys: [
    {
      id, title, mode, orderInUnit,
      totalQuestions: number,
      startedBy: number,          // antal elever med >=1 Response
      // quiz-aggregat (bara mode === "QUIZ"):
      avgPercentage?: number,
      // skrivuppgift-aggregat (om FREE_TEXT/LONG_TEXT-frågor finns):
      writtenSubmitted?: number,  // antal elever som lämnat skrivsvar
      writtenWithFeedback?: number
    }
  ],
  topics: [
    { id, name, classMasteryPct: number, weakest: boolean }
  ],
  students: [
    {
      studentNumber: number,
      completion: { surveysStarted, surveysTotal, questionsAnswered, questionsTotal },
      quizAvgPercentage: number | null,
      masteryByTopic: { topicId, masteredCount, totalCount }[],
      writtenStatus: { questionId, submitted: boolean, hasFeedback: boolean, level: string | null }[],
      flaggedCount: number
    }
  ],
  flaggedQuestions: [
    { questionId, text, flagCount }
  ]
}
```

### c.3 Implementationsnot

- En enda Prisma-query med `unit -> surveys -> { questions.question.{topic,options}, responses.{student,answers} }`
  räcker. För <100 elever och en handfull surveys per moment är detta ett fåtal hundra rader - ingen
  paginering, ingen cache behövs (DevilsAdvocate punkt 1: `unstable_cache` är prematur optimering här).
- All aggregering görs i JS i routen, exakt som `results/route.ts:48-108` gör idag. Återanvänd
  `calculateMastery` från mastery.ts. Ingen ny SQL.
- **Bygg INTE en ny mastery-funktion.** Mata bara mastery.ts en `ResponseRecord[]` byggd av
  `responses.flatMap(r => r.answers.map(a => ({ questionId: a.questionId, isCorrect: a.isCorrect, createdAt: r.createdAt })))`.

---

## (d) MCP-servern - gap-analys

### d.1 Vad som finns idag

Verktyg (`mcp-server/src/server.ts`): `import_questions`, `create_survey`, `create_quiz_from_csv`,
`get_results`, `summarize_results`, `get_student_progress`, `get_recent_responses`,
`get_answers_for_feedback`, `save_feedback`, `post_assignment_feedback`,
`bulk_post_assignment_feedback`. Resources: `courses`, `topics`, `questions-template`.

**Bekräftat gap:** Det finns **inget delete-verktyg och inget update-verktyg** för surveys/frågor i
MCP, trots att webbappen har `DELETE /api/surveys/[id]` (`surveys/[id]/route.ts:36-57`). Allt MCP kan
göra är att skapa. En `/planera-moment`-körning som råkar pusha fel måste städas manuellt i admin-UI
eller i DB.

### d.2 Nya verktyg som behövs för att pusha ett HELT moment

Mål: `/planera-moment` ska kunna skapa momentet + alla dess uppgifter i ett svep.

1. **`create_unit`** - skapar momentet och dess uppgifter atomärt.
   ```
   create_unit(
     course_id: number,
     title: string,
     description?: string,
     assignments: Array<{
       title: string,
       mode: "SURVEY" | "QUIZ",
       lock_mode?: boolean,
       csv_content: string          // samma CSV-format som create_quiz_from_csv
     }>
   ) -> { unitId, surveys: [{ id, title, shareCode, url, questionCount }] }
   ```
   Internt: en `prisma.$transaction` som skapar `Unit`, loopar assignments och återanvänder den
   befintliga create-quiz-from-csv-logiken (`create-quiz-from-csv.ts:31-102`), sätter `unitId` +
   `orderInUnit = index`. Detta är det enda verktyget `/planera-moment` strikt behöver utöver dagens.

2. **`get_unit_report`** - hämtar momentrapporten formaterad för AI/lärare (markdown likt
   `summarize_results`). Wrappar samma aggregering som `units/[unitId]/report`-routen.

3. **`delete_survey`** (fyller dokumenterat gap) - raderar en enkät (cascade på questions/answers via
   befintliga `onDelete: Cascade`). Spegla webbappens DELETE-route.
   ```
   delete_survey(survey_id: number) -> { deleted: true, title }
   ```

4. **`delete_unit`** - raderar ett moment (SetNull på surveys, eller med flagga `cascade_surveys?`
   som även raderar enkäterna).

5. **`set_answer_feedback_level`** ELLER utöka `save_feedback` med valfri `level?: "E"|"C"|"A"`.
   Föredra att **utöka `save_feedback`** (`give-feedback.ts:64`) additivt - mindre yta.

**Medvetet UTANFÖR v1 (DevilsAdvocate punkt 2, YAGNI):** generellt `update_question`,
`update_survey`, `compare_units`, `manage_students`. Skapa + radera + rapport täcker
`/planera-moment`-flödet. Update löser man genom delete+recreate tills ett konkret behov uppstår.

### d.3 Kvalitetsnot

De befintliga verktygen är robusta (try/catch + svensk feltext, `server.ts`). Nya verktyg ska följa
samma mönster och CSV-formatet `topic,type,text,option1..,correctAnswer` (`csv.ts:11-34`) så att
`type=LONG_TEXT` parsas. **OBS:** `csv.ts:28` och `create-quiz-from-csv.ts:40-43` tvingar idag varje
icke-FREE_TEXT till MULTIPLE_CHOICE. För att stödja `LONG_TEXT` måste parsern utökas till att känna
igen `LONG_TEXT` (annars blir en skrivuppgift felaktigt ett flerval utan alternativ). Detta är en liten
men nödvändig ändring i både `src/lib/csv.ts` och `mcp-server` (de duplicerar parsningen - se risk R4).

---

## (e) Migrationer och prod-DB-risk

### e.1 Risken (bekräftad)

- Lokal `.env` pekar på **PROD Neon-DB** (bekräftat i partial-submission-specen rad 212-213 och i
  agentens minne om Neon-adaptern). Det finns ingen separat dev-DB.
- `package.json`-build kör **`prisma migrate deploy`** automatiskt (`build`-scriptet), men `setup`
  använder **`prisma db push`**. Det är en blandad workflow. `db push` skapar INGA migrationsfiler och
  kan diffa bort kolumner - **får aldrig köras mot prod för dessa ändringar.**
- Det finns **ingen `migration_lock.toml`** i `prisma/migrations/` (verifierat) - migrationskatalogen
  finns men lock-filen saknas, vilket är ovanligt och bör kontrolleras innan nästa migration så inte
  providern misstolkas.

### e.2 Varför ändringarna är låg-risk i sig

Alla föreslagna schemaändringar är **additiva och bakåtkompatibla**:
- Nya tabeller: `Unit`, `Rubric`, `RubricCriterion` (rör ingen befintlig data).
- Nya **nullable** kolumner: `Survey.unitId`, `Survey.orderInUnit`, `Question.instructions`,
  `Question.rubricId`, `Answer.feedbackLevel`.
- Nya `type`-värden (`LONG_TEXT`) kräver **ingen** kolumnändring (strängkolumn).

Inga `DROP`, inga `NOT NULL` på befintliga rader, inga `UNIQUE` som kan kollidera med befintlig data.
Risken för dataförlust från själva schemat är därför ~noll. Risken ligger i **processen**.

### e.3 Säker införandeordning

1. **Skapa en separat dev/branch-DB först.** Neon stöder database branching - skapa en branch av prod
   och peka en `.env.development` dit. Detta är den enskilt viktigaste åtgärden (efterfrågades redan
   som teknisk skuld i partial-submission-specen rad 215). All migrationsutveckling sker mot branchen.
2. **Verifiera/lägg till `migration_lock.toml`** (provider = postgresql) innan ny migration genereras.
3. **Generera EN migration** mot dev-branchen med `prisma migrate dev --name unit_rubric_richtext`.
   Granska den genererade SQL:en manuellt - bekräfta att den bara innehåller `CREATE TABLE` och
   `ALTER TABLE ... ADD COLUMN` (nullable), inga `DROP`.
4. **Ordning inom migrationen** (Prisma genererar normalt rätt, men verifiera): `Unit`, `Rubric`,
   `RubricCriterion` skapas före FK-tilläggen på `Survey`/`Question`/`Answer`.
5. **Ta backup/snapshot av prod** (Neon point-in-time / branch) omedelbart före deploy.
6. **Deploya via `prisma migrate deploy`** (inte `db push`) mot prod - exakt det build redan gör.
   Eftersom migrationen är additiv är den icke-blockerande för befintlig trafik.
7. **MCP-servern delar samma DB och samma Prisma-schema men har egen `prisma generate`**
   (`mcp-server` har egen package.json/build). Efter migration: kör om `prisma generate` i BÅDE
   webbappen och `mcp-server/` så bägge klienterna känner till nya fält. Annars kraschar MCP-verktyg
   som rör `unitId` med "Unknown field".
8. **Datafix för befintliga enkäter:** ingen krävs (unitId nullable). Om läraren vill back-fila
   redan skapade enkäter till ett moment görs det via `PATCH .../units/[unitId]` efteråt, inte i
   migrationen.

### e.4 Rollback

Eftersom allt är additivt: rollback = en ny migration som droppar de nya tabellerna/kolumnerna,
ELLER restore av Neon-branch-snapshot. Ingen befintlig data är beroende av de nya strukturerna,
så en rollback förlorar bara moment-/rubric-data som skapats efter deploy.

---

## v1 vs SENARE

| Funktion | v1 (måste) | Senare |
|---|---|---|
| `Unit`-entitet + `Survey.unitId/orderInUnit` | JA - grunden för "moment" | |
| `create_unit` MCP-verktyg | JA - annars kan /planera-moment inte pusha moment | |
| `LONG_TEXT`-typ (UI + csv-parser) | JA - rikare skrivuppgift | |
| Höj `respondSchema` max till 20000 | JA - annars kapas långa svar | |
| `delete_survey` + `delete_unit` MCP | JA - städning, fyller känt gap | |
| `units/[unitId]/report` API + `get_unit_report` MCP | JA - det är hela poängen ("rapporten") | |
| Återanvänd `Answer.feedback` för momentfeedback | JA - inget nytt | |
| `Answer.feedbackLevel String?` | JA-ish - en kolumn, kopplar feedback till E/C/A | Kan vänta om tidsnöd |
| `Rubric` + `RubricCriterion` | NEJ för v1 - lägg kriterier i `Question.instructions` | JA när eleven ska se kriterier i appen |
| `Question.instructions` | JA om skrivuppgift behöver längre brief | |
| Läs-kvittens på Answer-feedback (`feedbackReadAt`) | NEJ - använd AssignmentFeedback för kvitterad sammanfattning | Senare |
| `update_question` / `update_survey` MCP | NEJ - delete+recreate räcker | Senare vid behov |
| Separat dev-DB (Neon branch) | JA - process-krav före migration | |
| Polling/live-rapport, cache | NEJ - refresh-knapp räcker (<100 elever) | |

---

## ÖPPNA FRÅGOR

1. **Ska en uppgift kunna ligga i flera moment?** Nuvarande design: en `Survey` har EN `unitId`
   (many-to-one). Om läraren återanvänder samma quiz i två moment behövs en join-tabell
   (`UnitSurvey`). Antagande för v1: nej, en enkät hör till max ett moment. Bekräfta.
2. **En Response per uppgift eller retakes inom moment?** Modellen tillåter retakes idag. Ska
   momentrapporten räkna senaste, första, eller bästa försöket? mastery.ts tittar på de två senaste -
   rapporten bör vara konsekvent. Föreslår: completion = "minst ett försök", quiz-% = senaste försöket.
3. **Hur skapas Rubric från `/planera-moment`?** CSV-formatet bär inte kriterier idag. Om Rubric
   införs i v1 behöver `create_unit` ett `rubric`-fält per assignment (E/C/A-text). Annars: lägg
   kriterierna i `instructions` som markdown (enklast, rekommenderas för v1).
4. **Ska eleven se sina bedömningskriterier i appen, eller bara läraren?** Avgör om Rubric är v1.
5. **Exit-ticket-frågorna** flödar redan in via `create_quiz_from_csv`. Ska de bli en uppgift i
   momentet (en `Survey` med `unitId`) eller fortsätta vara fristående? Påverkar om rapporten ska
   inkludera exit-tickets i completion.
6. **next-auth (beta) elevsession vs admin:** rapport-routerna är admin-only (`requireAdmin`).
   Bekräfta att inget elev-facing behov finns för momentrapporten.

---

## STÖRSTA TEKNISKA RISKER

- **R1 - Prod-DB är enda DB.** Lokal `.env` -> prod Neon. En felaktig `prisma db push` (som `setup`
  använder) kan diffa bort kolumner. Mitigering: Neon-branch-DB + endast `migrate deploy` mot prod +
  snapshot före deploy. Detta är den största risken och en process-, inte kod-fråga.
- **R2 - Dubbel Prisma-klient (app + mcp-server).** Båda har egen `prisma generate`. Glöms en bort
  efter migration kraschar MCP-verktygen på okända fält. Mitigering: kör generate i båda, dokumentera
  i `setup`-scriptet.
- **R3 - Saknad `migration_lock.toml`.** Migrationskatalogen saknar lock-fil; nästa
  `migrate dev` kan bete sig oväntat. Kontrollera/återskapa före migration.
- **R4 - Duplicerad CSV-parsning.** `src/lib/csv.ts` och `mcp-server/.../create-quiz-from-csv.ts`
  (+ `import-questions.ts`) har var sin kopia av samma parser, och båda tvingar icke-FREE_TEXT till
  MULTIPLE_CHOICE. `LONG_TEXT` måste läggas till på BÅDA ställena, annars blir en skrivuppgift ett
  trasigt flerval. Risk för drift mellan kopiorna.
- **R5 - mastery.ts semantik över moment.** Mastery kräver >=2 svar på samma fråga
  (`mastery.ts:15`). I ett moment där varje fråga ställs en gång blir mastery alltid false. Rapporten
  måste presentera "andel rätt" som primärt mått och mastery endast där frågor faktiskt repeteras
  (t.ex. retrieval-review-enkäterna). Annars vilseleder rapporten läraren.
- **R6 - Scope creep mot LMS.** Frestelsen att lägga till betygssättning, inlämningsdeadlines,
  versionshantering av svar. DevilsAdvocate-linjen: håll Unit som en tunn mapp, återanvänd
  Survey/Answer-pipelinen, skjut Rubric och update-verktyg till "senare".
