# Partiell inlämning och admin-synlighet för besvarade frågor

**Datum:** 2026-04-13
**Status:** Godkänd, klar för implementation plan

## Mål

Elever ska kunna lämna in en enkät/quiz även om de inte svarat på alla frågor. Lärare ska på resultatsidan tydligt se hur många frågor varje elev har besvarat, och hur många elever som besvarat varje enskild fråga.

## Nuvarande beteende (innan ändring)

- Frontend (`SurveyForm.tsx`) blockerar inlämning med inline-fel om någon fråga är obesvarad.
- Backend (`/api/surveys/[id]/respond`) kräver att `answers.length === survey.questions.length`, annars 400.
- Admin-resultatsidan visar `{responseCount} svar totalt` + per-elev-poänggrid (endast quiz-läge) + diagram per fråga. Ingen indikation på hur många frågor som faktiskt besvarades per elev eller per fråga.
- Draft-sparning stödjer redan partial fullt ut på backend; client-side `saveDraft` skippar endast om ingen fråga alls är besvarad.

## Beslut

Tre design-val fastställda i brainstorming:

1. **Bekräftelsedialog vid obesvarat.** Elev klickar "Skicka svar"; om någon fråga är obesvarad visas `window.confirm("Du har X obesvarade frågor. Lämna in ändå?")`. Om allt är besvarat, ingen dialog. Följer befintligt mönster i `QuestionsManager.tsx` och `SurveysManager.tsx`.
2. **Quiz-scoring räknar endast besvarade.** Elev som svarar 7 rätt av 7 besvarade (3 skippade) ser "7/7 · 100 %". Backend-scoring-logiken stödjer redan detta automatiskt via `isCorrect !== null`-filter — inga kodändringar i scoring.
3. **Admin-synlighet per elev OCH per fråga, i både quiz- och survey-läge.** Quiz-läge utökar befintligt poängkort. Survey-läge får ny "Svarade per elev"-sektion. Alla frågors diagram får en liten rad "Besvarad av X/Y elever" under frågetexten.

## Förändringar per lager

### 1. `src/app/api/surveys/[id]/respond/route.ts` (student-side submit)

Ta bort block vid rad 77–83:

```ts
// BORTTAGET
if (seen.size !== survey.questions.length) {
  return NextResponse.json({ error: "Alla frågor..." }, { status: 400 });
}
```

Resten av filen är oförändrad. `answerData.map()` itererar endast över inskickade svar; `prisma.response.create()` skapar endast motsvarande `Answer`-rader. Scoring-aggregering filtrerar redan på `isCorrect !== null` och exkluderar obesvarade naturligt.

`respondSchema` i `src/lib/validators.ts` förblir oförändrad. `.array(...).min(1)` bibehålls som naturlig lägstagräns — helt tomma inlämningar tillåts inte.

### 2. `src/app/api/courses/[courseId]/surveys/[id]/results/route.ts` (admin results)

Ny respons-shape (additiv för alla fält utom namnbytet `studentScores → studentStats`):

```ts
{
  survey: {
    id, title, mode, responseCount,
    totalQuestions: number            // NYTT
  },
  questions: [
    {
      id, text, type, /* ...existing fields... */,
      answeredBy: number              // NYTT — antal elever som besvarat denna fråga
    }
  ],
  studentStats: [                     // ERSÄTTER studentScores
    {
      studentNumber: number,
      answered: number,               // NYTT — antal frågor eleven besvarade
      // följande fält finns endast i quiz-läge
      correct?: number,
      total?: number,
      percentage?: number
    }
  ]
}
```

Notera: `totalQuestions` finns **endast** på `survey`, inte repeterat per student. Frontend refererar `data.survey.totalQuestions` när den behöver nämnaren.

**Beräkningar:**

- `survey.totalQuestions = survey.questions.length`
- `question.answeredBy = survey.responses.filter(r => r.answers.some(a => a.questionId === q.id)).length`
- `studentStats[i].answered = response.answers.length`
- Quiz-fält (`correct`, `total`, `percentage`) beräknas som idag, filtrerade på `isCorrect !== null`, men flyttas in i `studentStats` istället för separat `studentScores`.

**Namnbyte `studentScores → studentStats`:** internt breaking change. Enda konsument är `src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx`. Verifierat med grep att inga andra filer refererar fältet.

### 3. `src/components/SurveyForm.tsx` (student form)

**a. `saveDraft` (rad 85–103):** ta bort tidig return:

```ts
// BORTTAGET
const hasAnswers = Object.values(currentAnswers).some((v) => v.trim());
if (!hasAnswers) return;
```

Tillåter manuell "Spara" direkt från start, även med 0 svar. Backend accepterar tom draft.

**b. `handleSubmit` (rad 127–167):** ersätt hårda blocket och filtrera svar innan skickning:

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError("");

  const answered = survey.questions.filter((q) => answers[q.id]?.trim());
  const unansweredCount = survey.questions.length - answered.length;

  if (answered.length === 0) {
    setError("Du måste besvara minst en fråga innan du kan lämna in.");
    return;
  }

  if (unansweredCount > 0) {
    const msg = `Du har ${unansweredCount} obesvarad${unansweredCount === 1 ? " fråga" : "e frågor"}. Lämna in ändå?`;
    if (!confirm(msg)) return;
  }

  setSubmitting(true);

  const answerList = answered.map((q) => ({
    questionId: q.id,
    value: answers[q.id],
  }));

  // ... resten av funktionen oförändrad (fetch, response handling, cleanup)
}
```

Övrig state och UI i filen rörs inte.

### 4. `src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx` (admin results page)

**a. Uppdatera TypeScript-interfaces** till ny respons-shape (`studentStats`, `survey.totalQuestions`, `answeredBy` per fråga).

**b. Quiz-poängkort** — ny rad under procenten:

```tsx
<div className="text-lg font-bold">{s.correct}/{s.total}</div>
<div className="text-xs text-gray-700">{s.percentage}%</div>
<div className="text-xs text-gray-500">Svarade: {s.answered}/{data.survey.totalQuestions}</div>
```

**c. Ny "Svarade per elev"-sektion** för survey-läge (`!isQuiz && studentStats.length > 0`) — samma grid-layout som quiz-poängen men utan poängfärger:

```tsx
<div className="bg-white rounded-lg shadow p-6 mb-6">
  <h2 className="font-semibold mb-3">Svarade per elev</h2>
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
    {data.studentStats.map((s) => (
      <div
        key={s.studentNumber}
        className="rounded p-3 text-center bg-gray-50 border border-gray-200"
      >
        <div className="text-xs text-gray-700">#{s.studentNumber}</div>
        <div className="text-lg font-bold">{s.answered}/{data.survey.totalQuestions}</div>
      </div>
    ))}
  </div>
</div>
```

**d. Skicka `totalResponses` som prop** till `<ResultsCharts>` — behövs för per-fråga-räkningen i nästa steg.

### 5. `src/components/ResultsCharts.tsx`

**a. Utöka interfaces** `MCQuestion` och `FTQuestion` med `answeredBy: number`.

**b. Ny prop** `totalResponses: number` på komponenten.

**c. Lägg till en muted rad** under varje frågas `<h3>{q.text}</h3>`:

```tsx
<p className="text-xs text-muted-light mb-4">
  Besvarad av {q.answeredBy}/{totalResponses} elever
</p>
```

## Användarflöden efter ändring

### Elev lämnar in med obesvarade frågor

1. Elev klickar "Skicka svar" med 7/10 besvarade.
2. Client filtrerar `answered = 7 frågor`, `unansweredCount = 3`.
3. `confirm("Du har 3 obesvarade frågor. Lämna in ändå?")`.
4. Vid "OK": POST `/api/surveys/[id]/respond` med endast 7 svar.
5. Server accepterar (baseline-check borttagen), skapar 1 Response + 7 Answer-rader.
6. Quiz-scoring räknar andel rätt av 7, visar t.ex. `5/7 · 71%`.
7. Draft raderas som tidigare.

### Lärare öppnar resultatsidan (quiz-läge)

1. API returnerar `studentStats` med `{answered, totalQuestions, correct, total, percentage}` per elev.
2. Quiz-kort visar två rader: `{correct}/{total}` + `{percentage}%` + ny `Svarade: {answered}/{totalQuestions}`.
3. Varje fråga i `ResultsCharts` visar "Besvarad av X/Y elever" under frågetexten.

### Lärare öppnar resultatsidan (survey-läge)

1. API returnerar `studentStats` med endast completion-fält (inga poängfält).
2. Ny sektion "Svarade per elev" renderas ovanför diagrammen.
3. Diagrammen visar "Besvarad av X/Y elever" per fråga som i quiz-läget.

## Utanför scope

- **Draft-modellen oförändrad** — ingen ändring i `draftResponse` Prisma-modellen eller `/api/surveys/[id]/draft` route.
- **CSV-export oförändrad** — separat ticket om lärare vill ha en "skippad av"-kolumn i export.
- **Student-resultatvy oförändrad** — ingen ny "du skippade X frågor"-info i elevens egen resultatvy. Separat design om önskat.
- **Ingen UX för att återvända och fylla i skippade innan inlämning** — progress-baren i nuvarande UI visar redan `{answered}/{total}`, vilket räcker som signal.
- **Inga ändringar i `respondSchema`** — `.min(1)` på array bibehålls som naturlig lägstagräns (helt tomma inlämningar tillåts inte).

## Testning

Projektet saknar formell testsuite (inga `*.test.tsx`, ingen vitest/jest i `package.json`). Verifiering sker via:

1. **`npx tsc --noEmit`** — fångar typfel från interface-ändringarna i alla fem berörda filerna.
2. **`npm run build` lokalt** — fångar compile/prerender-fel som build-loggen skulle visa i Vercel.
3. **Manuell smoke-test** — lokal dev-server, skapa testenkät, verifiera partial submit, inspektera DB-data och admin-UI. Viktig varning: lokal `.env` pekar på prod-Neon-DB, så manuell testning måste ske i en isolerad testkurs och sedan städas upp.
4. **Preview deploy på Vercel** — som slutlig verifiering innan merge till `main`. Vercel preview-deploys använder samma env vars som production om inte annat konfigurerats, så även preview hittar prod-DB. Testdata städas upp efter verifiering.

Separat teknisk skuld att adressera vid senare tillfälle: sätt upp en separat dev-databas så dev-arbete inte riskerar att förorena prod-data.

## Beroenden och risker

- **Inga DB-migrationer krävs.** Befintlig datamodell (`Response` + `Answer`) stödjer redan partial responses eftersom `Answer` är en child-relation.
- **Inga andra konsumenter av `studentScores`-fältet** — verifierat med grep över `src/`. Namnbytet är säkert.
- **`/api/surveys/[id]/export/route.ts`** — inte rörd av denna ändring. Förväntat beteende efter: export inkluderar endast rader där svar finns, obesvarade frågor visas som tomma celler (existerande beteende).
