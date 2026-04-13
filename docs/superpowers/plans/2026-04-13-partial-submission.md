# Partial Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tillåt elever att lämna in enkäter/quiz utan att ha besvarat alla frågor, och visa på admin-resultatsidan hur många frågor varje elev besvarat samt hur många elever som besvarat varje fråga.

**Architecture:** Tre fokuserade commits. (1) Relaxa backend-validering i respond-routen. (2) Uppdatera student-sidans `SurveyForm` med bekräftelsedialog och filtrering av obesvarade innan skickning. (3) Enhetlig admin-synlighet via uppdaterad results-API-shape plus nya UI-sektioner. Inga DB-migrationer — datamodellen stödjer redan partial responses eftersom `Answer` är en child-relation till `Response`.

**Tech Stack:** Next.js 16 App Router, React client components, Prisma 6, Zod, TypeScript, Tailwind. Ingen test-framework i projektet — verifiering sker via `tsc --noEmit`, `npm run build` lokalt, och manuell smoke-test via Vercel preview deploy.

**Spec reference:** `docs/superpowers/specs/2026-04-13-partial-submission-design.md`

**Existing conventions verified:**
- `window.confirm()` används redan i `QuestionsManager.tsx:167,194` och `SurveysManager.tsx:80` — okej att använda här.
- Ingen `*.test.*`-fil i `src/`, ingen vitest/jest/playwright i `package.json` — projektet förlitar sig på typcheck och manuell verifiering.
- `respondSchema` i `src/lib/validators.ts` kräver `value: z.string().min(1)` — obesvarade MÅSTE filtreras bort på klienten innan fetch.

---

## Task 1: Backend — tillåt partial submission

**Files:**
- Modify: `src/app/api/surveys/[id]/respond/route.ts:77-83`

**Context:** Routen validerar idag att `seen.size === survey.questions.length` och returnerar 400 annars. Ta bort det blocket. Resten av filen hanterar redan partial korrekt: `answerData.map()` itererar bara över inskickade svar; `prisma.response.create()` skapar bara motsvarande `Answer`-rader; score-beräkningen filtrerar på `isCorrect !== null` och exkluderar därmed obefintliga automatiskt.

- [ ] **Step 1: Ta bort "alla frågor måste besvaras"-checken**

Öppna `src/app/api/surveys/[id]/respond/route.ts`. Hitta blocket vid rad 77-83 och ta bort det:

```ts
      seen.add(a.questionId);
    }

    // Require that every question in the survey is answered
    if (seen.size !== survey.questions.length) {
      return NextResponse.json(
        { error: "Alla frågor i enkäten måste besvaras" },
        { status: 400 }
      );
    }

    // Build answer data, computing isCorrect for multiple choice questions in all modes
```

Ska bli:

```ts
      seen.add(a.questionId);
    }

    // Build answer data, computing isCorrect for multiple choice questions in all modes
```

Rör inget annat i filen.

- [ ] **Step 2: Verifiera typcheck**

```bash
cd "/home/anders/Second brain/Kod/survey-platform" && npx tsc --noEmit
```

Expected: exit 0, ingen output.

- [ ] **Step 3: Commit**

```bash
cd "/home/anders/Second brain/Kod/survey-platform"
git add src/app/api/surveys/[id]/respond/route.ts
git commit -m "$(cat <<'EOF'
Tillåt inlämning med obesvarade frågor (backend)

Ta bort hårda valideringen som kräver att varje fråga är besvarad.
Existerande scoring- och data-logik hanterar redan partial svar
korrekt: obesvarade frågor får inga Answer-rader och exkluderas
från score via isCorrect !== null-filter.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — bekräftelsedialog och filtrering i SurveyForm

**Files:**
- Modify: `src/components/SurveyForm.tsx:85-103` (saveDraft)
- Modify: `src/components/SurveyForm.tsx:127-142` (handleSubmit)

**Context:** Två oberoende ändringar i samma fil. `saveDraft` har idag en guard som hoppar över sparning om inga svar finns — den tas bort så manuell Spara kan skapa även tom draft. `handleSubmit` ersätter det hårda blocket med `confirm()`-dialog, hanterar "0 besvarade"-fallet med inline-error (backend kräver minst 1 svar via `respondSchema.min(1)`), och bygger `answerList` från filtered besvarade istället för från alla frågor.

- [ ] **Step 1: Ta bort hasAnswers-guarden i saveDraft**

I `src/components/SurveyForm.tsx`, hitta `saveDraft` (rad 85-103) och ta bort de två första raderna i callbacken:

```tsx
  const saveDraft = useCallback(
    async (currentAnswers: Record<number, string>) => {
      const hasAnswers = Object.values(currentAnswers).some((v) => v.trim());
      if (!hasAnswers) return;

      setDraftStatus("saving");
```

Ska bli:

```tsx
  const saveDraft = useCallback(
    async (currentAnswers: Record<number, string>) => {
      setDraftStatus("saving");
```

- [ ] **Step 2: Ersätt handleSubmit:s validering med confirm-dialog + filtrering**

Hitta blocket från rad 127 (början av `handleSubmit`) till rad 142 (slutet av `answerList`-deklarationen):

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const unanswered = survey.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setError(`Du har ${unanswered.length} obesvarad${unanswered.length === 1 ? " fråga" : "e frågor"}. Alla frågor måste besvaras innan du kan skicka in.`);
      return;
    }

    setSubmitting(true);

    const answerList = survey.questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id],
    }));
```

Ersätt med:

```tsx
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
```

Rör inte resten av `handleSubmit` (fetch-anropet, response-hanteringen, `finally`-blocket).

- [ ] **Step 3: Verifiera typcheck**

```bash
cd "/home/anders/Second brain/Kod/survey-platform" && npx tsc --noEmit
```

Expected: exit 0, ingen output.

- [ ] **Step 4: Commit**

```bash
cd "/home/anders/Second brain/Kod/survey-platform"
git add src/components/SurveyForm.tsx
git commit -m "$(cat <<'EOF'
Confirm-dialog vid partial inlämning + tillåt tom draft

SurveyForm:
- saveDraft: ta bort guard som hoppar över sparning när inga svar
  finns. Manuell Spara ska alltid skapa/uppdatera draften.
- handleSubmit: ersätt det hårda blocket med confirm()-dialog när
  något är obesvarat. Blockera inline om 0 svar (respondSchema
  kräver .min(1)). Filtrera bort obesvarade innan POST eftersom
  respondSchema.value.min(1) avvisar tomma strängar.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Admin-synlighet — results API + ResultsCharts + admin page

**Files:**
- Modify: `src/app/api/courses/[courseId]/surveys/[id]/results/route.ts:46-112`
- Modify: `src/components/ResultsCharts.tsx:20-51`
- Modify: `src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx:8-132`

**Context:** En kohesiv commit eftersom shape-ändringen i API:t (namnbyte `studentScores → studentStats`, nya fält) bryter TypeScript i `page.tsx` tills alla tre filerna uppdateras. Committas tillsammans för att hålla `tsc --noEmit` grön vid varje commit-SHA.

**Data shape (repeterat från spec för referens):**

```ts
{
  survey: { id, title, mode, responseCount, totalQuestions },
  questions: [{ ..., answeredBy: number }],
  studentStats: [
    {
      studentNumber: number,
      answered: number,
      correct?: number,       // quiz only
      total?: number,          // quiz only
      percentage?: number      // quiz only
    }
  ]
}
```

- [ ] **Step 1: Uppdatera results API:n — lägg till `answeredBy`, `totalQuestions`, byt till `studentStats`**

Öppna `src/app/api/courses/[courseId]/surveys/[id]/results/route.ts`. Hitta `questions`-mappingen och `studentScores`-beräkningen.

Ersätt rad 48-112 (allt från `const questions = survey.questions.map((sq) => {` till slutet av return-uttrycket innan catch):

```ts
  const questions = survey.questions.map((sq) => {
    const q = sq.question;
    const correctOption = q.options.find((o) => o.isCorrect);

    const answersWithStudent = survey.responses.flatMap((r) =>
      r.answers
        .filter((a) => a.questionId === q.id)
        .map((a) => ({
          studentNumber: r.student.number,
          value: a.value,
          isCorrect: a.isCorrect,
        }))
    );

    const answeredBy = answersWithStudent.length;

    if (q.type === "MULTIPLE_CHOICE") {
      const optionCounts: Record<string, number> = {};
      q.options.forEach((o) => (optionCounts[o.text] = 0));
      answersWithStudent.forEach((a) => {
        optionCounts[a.value] = (optionCounts[a.value] || 0) + 1;
      });
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        optionCounts,
        correctAnswer: isQuiz ? correctOption?.text || null : null,
        studentAnswers: answersWithStudent,
        answeredBy,
      };
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      textResponses: answersWithStudent.map((a) => a.value),
      studentAnswers: answersWithStudent,
      answeredBy,
    };
  });

  // Per-student stats: completion för alla lägen, score endast för quiz
  const studentStats = survey.responses
    .map((r) => {
      const base = {
        studentNumber: r.student.number,
        answered: r.answers.length,
      };
      if (!isQuiz) return base;
      const correct = r.answers.filter((a) => a.isCorrect === true).length;
      const total = r.answers.filter((a) => a.isCorrect !== null).length;
      return {
        ...base,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.studentNumber - b.studentNumber);

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      mode: survey.mode,
      responseCount: survey.responses.length,
      totalQuestions: survey.questions.length,
    },
    questions,
    studentStats,
  });
}
```

Rör inte filens toppdel (imports, auth, findUnique).

**Notera:** `answeredBy` räknar antalet `Answer`-rader för frågan — om retakes är aktiva och samma elev har flera `Response`-rader kan siffran inkludera båda. Det matchar befintlig konvention i `studentScores` som också gav en entry per response, inte per distinkt elev.

- [ ] **Step 2: Uppdatera ResultsCharts — ny prop + `answeredBy` i interfaces + rad under frågetext**

Öppna `src/components/ResultsCharts.tsx`. Gör tre ändringar:

**2a. Lägg till `answeredBy: number` i båda interfaces.** Ersätt:

```ts
interface MCQuestion {
  id: number;
  text: string;
  type: "MULTIPLE_CHOICE";
  optionCounts: Record<string, number>;
  correctAnswer?: string | null;
  studentAnswers?: StudentAnswer[];
}

interface FTQuestion {
  id: number;
  text: string;
  type: "FREE_TEXT";
  textResponses: string[];
  studentAnswers?: StudentAnswer[];
}
```

Med:

```ts
interface MCQuestion {
  id: number;
  text: string;
  type: "MULTIPLE_CHOICE";
  optionCounts: Record<string, number>;
  correctAnswer?: string | null;
  studentAnswers?: StudentAnswer[];
  answeredBy: number;
}

interface FTQuestion {
  id: number;
  text: string;
  type: "FREE_TEXT";
  textResponses: string[];
  studentAnswers?: StudentAnswer[];
  answeredBy: number;
}
```

**2b. Lägg till `totalResponses: number` som ny prop.** Ersätt:

```tsx
export default function ResultsCharts({
  questions,
  isQuiz = false,
}: {
  questions: ResultQuestion[];
  isQuiz?: boolean;
}) {
```

Med:

```tsx
export default function ResultsCharts({
  questions,
  isQuiz = false,
  totalResponses,
}: {
  questions: ResultQuestion[];
  isQuiz?: boolean;
  totalResponses: number;
}) {
```

**2c. Lägg till en rad under `<h3>{q.text}</h3>` som visar svarsfrekvens.** Ersätt:

```tsx
      {questions.map((q) => (
        <div key={q.id} className="card p-6">
          <h3 className="font-semibold mb-4 tracking-tight">{q.text}</h3>
```

Med (notera att `mb-4` flyttas från `h3` till den nya `p`):

```tsx
      {questions.map((q) => (
        <div key={q.id} className="card p-6">
          <h3 className="font-semibold tracking-tight">{q.text}</h3>
          <p className="text-xs text-muted-light mb-4">
            Besvarad av {q.answeredBy}/{totalResponses} elever
          </p>
```

Rör inte resten av komponenten (charts, text-responses-rendering).

- [ ] **Step 3: Uppdatera admin results page — interfaces, quiz-kort, ny survey-section, prop-drilling till ResultsCharts**

Öppna `src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx`. Fyra ändringar i denna fil.

**3a. Lägg till `answeredBy: number` i `MCQuestion` och `FTQuestion`.** Ersätt:

```ts
interface MCQuestion {
  id: number;
  text: string;
  type: "MULTIPLE_CHOICE";
  optionCounts: Record<string, number>;
  correctAnswer?: string | null;
  studentAnswers?: StudentAnswer[];
}

interface FTQuestion {
  id: number;
  text: string;
  type: "FREE_TEXT";
  textResponses: string[];
  studentAnswers?: StudentAnswer[];
}
```

Med:

```ts
interface MCQuestion {
  id: number;
  text: string;
  type: "MULTIPLE_CHOICE";
  optionCounts: Record<string, number>;
  correctAnswer?: string | null;
  studentAnswers?: StudentAnswer[];
  answeredBy: number;
}

interface FTQuestion {
  id: number;
  text: string;
  type: "FREE_TEXT";
  textResponses: string[];
  studentAnswers?: StudentAnswer[];
  answeredBy: number;
}
```

**3b. Byt `StudentScore` mot `StudentStat` och uppdatera `ResultsData`.** Ersätt:

```ts
interface StudentScore {
  studentNumber: number;
  correct: number;
  total: number;
  percentage: number;
}

interface ResultsData {
  survey: { id: number; title: string; mode: string; responseCount: number };
  questions: ResultQuestion[];
  studentScores?: StudentScore[] | null;
}
```

Med:

```ts
interface StudentStat {
  studentNumber: number;
  answered: number;
  correct?: number;
  total?: number;
  percentage?: number;
}

interface ResultsData {
  survey: { id: number; title: string; mode: string; responseCount: number; totalQuestions: number };
  questions: ResultQuestion[];
  studentStats: StudentStat[];
}
```

**3c. Uppdatera quiz-poängkortet och lägg till ny survey-sektion.** Ersätt hela blocket från `{isQuiz && data.studentScores...}` (rad 100) till och med `</div>`-raden som stänger det blocket (rad 127):

```tsx
      {isQuiz && data.studentScores && data.studentScores.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-3">Poäng per elev</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.studentScores.map((s) => (
              <div
                key={s.studentNumber}
                className={`rounded p-3 text-center ${
                  s.percentage >= 80
                    ? "bg-green-50 border border-green-200"
                    : s.percentage >= 50
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="text-xs text-gray-700">#{s.studentNumber}</div>
                <div className="text-lg font-bold">{s.correct}/{s.total}</div>
                <div className="text-xs text-gray-700">{s.percentage}%</div>
              </div>
            ))}
          </div>
          {data.studentScores.length > 0 && (
            <div className="mt-3 text-sm text-gray-700">
              Snitt: {Math.round(data.studentScores.reduce((s, x) => s + x.percentage, 0) / data.studentScores.length)}%
            </div>
          )}
        </div>
      )}
```

Med (båda sektionerna: uppdaterad quiz-version + ny survey-version):

```tsx
      {isQuiz && data.studentStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-3">Poäng per elev</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.studentStats.map((s) => {
              const pct = s.percentage ?? 0;
              return (
                <div
                  key={s.studentNumber}
                  className={`rounded p-3 text-center ${
                    pct >= 80
                      ? "bg-green-50 border border-green-200"
                      : pct >= 50
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="text-xs text-gray-700">#{s.studentNumber}</div>
                  <div className="text-lg font-bold">{s.correct}/{s.total}</div>
                  <div className="text-xs text-gray-700">{pct}%</div>
                  <div className="text-xs text-gray-500">Svarade: {s.answered}/{data.survey.totalQuestions}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-sm text-gray-700">
            Snitt: {Math.round(data.studentStats.reduce((sum, x) => sum + (x.percentage ?? 0), 0) / data.studentStats.length)}%
          </div>
        </div>
      )}

      {!isQuiz && data.studentStats.length > 0 && (
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
      )}
```

**3d. Skicka `totalResponses` till ResultsCharts.** Ersätt:

```tsx
      <ResultsCharts questions={data.questions} isQuiz={isQuiz} />
```

Med:

```tsx
      <ResultsCharts questions={data.questions} isQuiz={isQuiz} totalResponses={data.survey.responseCount} />
```

- [ ] **Step 4: Verifiera typcheck**

```bash
cd "/home/anders/Second brain/Kod/survey-platform" && npx tsc --noEmit
```

Expected: exit 0, ingen output. Om det klagar på `data.studentScores` någonstans — du har missat att byta ut en referens från 3b. Sök `studentScores` i filen och ersätt.

- [ ] **Step 5: Verifiera lokal build**

```bash
cd "/home/anders/Second brain/Kod/survey-platform" && npm run build
```

Expected: build passerar genom `prisma generate`, `prisma migrate deploy` (säger "No pending migrations"), och `next build` (alla sidor prerenderas utan fel).

**Varning:** `npm run build` kör `prisma migrate deploy` mot prod-DB:n (eftersom `.env` pekar på prod). Det är harmlöst idag eftersom inga migrationer är pending, men tänk på att du kör mot prod. Om du är osäker kan du istället köra `npx prisma generate && npx next build` (hoppar över migrate-steget).

- [ ] **Step 6: Commit**

```bash
cd "/home/anders/Second brain/Kod/survey-platform"
git add \
  src/app/api/courses/[courseId]/surveys/[id]/results/route.ts \
  src/components/ResultsCharts.tsx \
  "src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx"
git commit -m "$(cat <<'EOF'
Visa svarsfrekvens per elev och per fråga på admin-resultatsidan

Results-API:t returnerar nu studentStats (ersätter studentScores)
med completion-data för båda lägen och score-fält endast för quiz.
Varje fråga innehåller answeredBy = antal svar på den frågan.
survey.totalQuestions exponeras som nämnare.

UI:
- Quiz-kort: ny rad "Svarade: X/Y" under procenten.
- Survey-läge: ny sektion "Svarade per elev" (fanns inte tidigare).
- Alla frågor i diagrammen: rad "Besvarad av X/Y elever" under
  frågetexten.

Inga DB-migrationer — befintlig Response/Answer-modell stödjer
partial responses via child-relationen.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Post-implementation verification

Efter att alla tre tasks är klara och committade:

1. **`git log --oneline -4`** — verifiera att det finns tre nya commits på toppen.
2. **`npx tsc --noEmit`** — slutlig typcheck över hela repo:t.
3. **`git push`** — trigga Vercel deploy (Vercel auto-deployar main).
4. **Manuell smoke-test i Vercel preview eller prod deploy:**
   - Logga in som teststudent, öppna en testenkät, svara på bara några frågor.
   - Klicka "Skicka svar" → verifiera att confirm-dialog dyker upp med rätt antal obesvarade.
   - Klicka OK → verifiera att inlämningen går igenom och resultat visas (för quiz: score baserat på besvarade).
   - Logga in som admin, öppna resultatsidan för samma enkät.
   - Verifiera att "Svarade: X/Y" syns per elev och "Besvarad av X/Y elever" under varje fråga.
   - För survey-läge: verifiera att den nya "Svarade per elev"-sektionen dyker upp.
   - Städa upp testdata efter verifiering.
5. **Om något fallerar under smoke-test:** rulla inte tillbaka automatiskt. Öppna en debug-session med `systematic-debugging`-skill:en och hitta root cause.

## Kända begränsningar efter denna plan

- **Lokal `.env` pekar fortfarande på prod-DB.** Separat ticket för att sätta upp dev-DB.
- **Preview deploys delar env vars med production** om inte annat konfigurerats. Vercel preview = samma Neon-branch som prod. Separat ticket.
- **`answeredBy` räknar per `Answer`-rad, inte per distinkt elev.** Om retakes är vanliga kan siffran överstiga antalet distinkta elever som svarat. Matchar existerande konvention i `studentScores`. Kan åtgärdas separat med `new Set(answersWithStudent.map(a => a.studentNumber)).size` om det blir ett problem.
- **`scripts/check-migration-state.cjs`** är fortfarande untracked från föregående session. Inte relaterat till denna plan.
- **`REVIEW.md`** också untracked. Inte relaterat.
