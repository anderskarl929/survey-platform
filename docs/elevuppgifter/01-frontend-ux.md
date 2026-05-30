# Frontend och UX-arkitektur: Elevuppgifter från /planera-moment i appen

**Datum:** 2026-05-29
**Författare:** Frontend/UX-arkitekt (analys, ingen kod ändrad)
**Status:** Designunderlag till orkestrerare. Ren analys.
**Lins:** Elevyta, lärar-/rapportyta, informationsarkitektur, komponent- och route-inventering.

---

## 0. Sammanfattning av nuläget (vad som faktiskt finns)

Innan vi designar, exakt vad appen gör idag (verifierat i koden):

- **Största enhet idag = Survey.** En `Survey` har `mode` `SURVEY | QUIZ`, en uppsättning frågor (`SurveyQuestion[]`), och hör till en `Course` (`prisma/schema.prisma:66-79`). Det finns inget "moment"-begrepp någonstans i schema, routes eller UI - bekräftat med grep över `src/`.
- **Frågetyper = exakt två.** `MULTIPLE_CHOICE` och `FREE_TEXT` (`prisma/schema.prisma:49`). `QuestionRenderer.tsx:43-92` renderar radioknappar (plus "Jag är inte säker") respektive en `<textarea rows={3}>`. Det finns alltså redan en skrivuppgifts-primitiv - den är bara liten.
- **Elevdashboard** (`src/app/student/page.tsx`) listar alla surveys i kursen som kort med en mastery-progressbar, plus två sektioner: "Frågor att öva på" (flaggade) och "Frågor att repetera" (spacing). Knapptext växlar `Starta / Fortsätt / Öva igen` beroende på draft/respons.
- **Elev-svarsflöde:** `StudentQuizForm.tsx` (quiz, en-fråga-i-taget-stepper med Föregående/Nästa/Spara/Skicka) och `SurveyForm.tsx` (i princip samma men med `ProgressBar` istället för mastery-filtrering). Båda har auto-sparande utkast (debounce 2 s, `PUT /api/surveys/[id]/draft`) och flaggning.
- **Resultat för elev:** `student/results` (lista) och `student/results/[responseId]` (per-svar; visar rätt/fel för MC, och `FeedbackButton` = AI-feedback på FREE_TEXT-svar, `results/[responseId]/page.tsx:135-137`).
- **Feedback för elev (separat spår):** `student/feedback` läser `AssignmentFeedback` (fritext-titel + innehåll som läraren postar via MCP `post_assignment_feedback`). Detta är **frikopplat** från svar - det är "återkoppling på inlämnade uppgifter, presentationer och annat utanför quizen" (`student/feedback/page.tsx:37`). Det finns alltså redan en kanal för rikare feedback, men den är inte knuten till en uppgift i appen.
- **Per-svar-AI-feedback** finns redan på FREE_TEXT via MCP (`mcp-server/src/tools/give-feedback.ts`): `get_answers_for_feedback` -> Claude skriver -> `save_feedback` skriver `Answer.feedback`. Eleven ser den i resultat-detaljvyn.
- **Lärarens resultatvy** (`admin/courses/[courseId]/surveys/[id]/results/page.tsx`) visar per-fråga-diagram (`ResultsCharts`), poäng-per-elev-grid (quiz) eller svarade-per-elev-grid (survey), CSV-export.
- **Lärarens elevvy** (`admin/courses/[courseId]/students/[number]/page.tsx`) listar en elevs alla svar per survey.
- **Sidonavigation lärare** (`CourseSidebar.tsx:14-20`) har redan en länk `Elevöversikt` (`/progress`) **som inte har någon sida än** (Glob: inga filer). Den är alltså en redan reserverad, tom plats - perfekt för momentrapport-ingången.
- **Partiell inlämning** är designad och på väg in (`docs/superpowers/specs/2026-04-13-partial-submission-design.md`): elever kan lämna in ofullständigt, läraren ser hur mycket var och en gjort.

**Slutsats av nuläget:** Allt vi behöver för att leverera elevuppgifter-i-appen finns redan i embryoform. FREE_TEXT är skrivuppgiften. AssignmentFeedback + per-answer feedback är feedbackkanalerna. `/progress` är den reserverade lärar-ingången. Det vi saknar är **gruppering**: ett "moment" som samlar flera surveys/uppgifter och en rapportvy ovanpå dem.

---

## 1. Den centrala IA-frågan: behöver "moment" bli ett förstklassigt begrepp?

### Kort svar: Ja, men som ett tunt grupperingslager - inte en ny innehållsenhet.

Lärarens tre önskemål (göra alla uppgifter i appen, få feedback, få en momentrapport) kretsar alla runt ordet "moment". Idag är ett `/planera-moment`-moment 8 lektioner med en blandning av flervalsfrågor (exit tickets, redan i appen), skrivuppgifter (perspektivanalys L5/L6), och muntliga moment (seminarium L8) - se `momentplan.md:46-55`. Appen kan rimligen äga skriv- och flervalsdelarna. De muntliga/utskrivna delarna äger appen inte.

Två designvägar:

**Väg A (förkastas): Moment = ny innehållstyp som ersätter survey.** Skulle kräva att flytta frågor från survey till moment, ny respond-pipeline, ny scoring. Detta är LMS-scope-creep (DevilsAdvocate-varning #1, #2). Det river upp partial-submission-arbetet och hela respond/results-stacken.

**Väg B (rekommenderas): Moment = en namngiven samling av befintliga surveys.** Ett moment är en etikett + ordning ovanpå N stycken surveys. Varje survey i momentet beter sig precis som idag (samma respond, samma draft, samma scoring, samma flaggning). Momentet tillför bara:
1. En **elev-landningssida** "alla uppgifter i det här momentet" med ordning och status.
2. En **lärar-rapportvy** som aggregerar de surveys momentet pekar på.

Detta är minimalt invasivt: inga ändringar i respond/scoring/draft, återanvänder allt. Datamodellen blir (databas-agentens beslut, men frontend antar denna form):

```
Module (moment)         : id, courseId, title, description, order, createdAt
ModuleItem (uppgift)    : id, moduleId, surveyId, order, label?, kind?
```

En `ModuleItem` pekar på en befintlig `Survey`. "Uppgift" i UI = en survey som ingår i ett moment. Frontend behöver aldrig veta mer än "ge mig momentets items i ordning, var och en med survey-metadata + elevens status (ej börjat / utkast / inlämnad / klar) + ev. poäng".

### Var hamnar moment i navigationen?

**Elev:** Idag är elevdashboarden en platt lista av surveys. Vi inför ett lager: dashboarden listar **moment** (om kursen har några), och under/bredvid dem de fristående surveys som inte tillhör något moment. Klick på ett moment -> momentsida med dess uppgifter. Detta gör elevens mentala modell skarpare: "vi jobbar med Källkritik-momentet" snarare än "här är 8 lösa quiz".

**Lärare:** Ny sidebar-länk `Moment` (mellan `Enkäter` och `Elever` i `CourseSidebar.tsx:14-20`). `/progress` (redan reserverad) blir momentrapportens hem - antingen som "Elevöversikt" som listar moment att rapportera på, eller så låter vi rapport bo under `/moment/[id]/rapport`. Rekommendation: behåll `Elevöversikt`-länken men låt den lista moment + ge en kurstäckande matris; lägg den djupa rapporten på momentnivå.

---

## 2. Elevytan (a)

### 2.1 Mental modell och flöde

```
Dashboard (/student)
  -> Moment-kort: "Källkritik: AI och konspirationsteorier" [3/6 uppgifter klara] [progressbar]
       -> Momentsida (/student/moment/[id])
            - Header: momenttitel, beskrivning, samlad progress
            - Lista av uppgifter i ordning, var och en med statusbricka:
                L2 Källkritiska verktyg (quiz)      [Klar 8/8]      -> Visa resultat
                L3 Exit ticket (quiz)               [Inlämnad]      -> Visa resultat
                L5 Perspektivanalys (skrivuppgift)  [Utkast sparat] -> Fortsätt
                L6 Summativ skrivuppgift            [Ej börjad]      -> Starta
            -> klick på en uppgift = befintligt survey-flöde
                 (/student/quiz/[surveyId] eller /s/[shareCode])
                 -> efter inlämning: tillbaka till MOMENTSIDAN (inte dashboard)
```

Den enda nya elev-vyn är **momentsidan**. Den är en lista-med-status, mycket lik dashboardens befintliga survey-korts-loop (`student/page.tsx:160-227`) men scopead till ett moment och med en uppgifts-status istället för mastery-procent. Vi återanvänder kort-, badge- och progress-mönstret rakt av.

### 2.2 Skrivuppgifter - hur de skiljer sig från exit-tickets

Lärarens önskemål: "även de rikare skrivuppgifterna", inte bara flervalsfrågor. Den goda nyheten är att `FREE_TEXT` redan ÄR detta. En perspektivanalys (`momentplan.md:52` L5) är en enda FREE_TEXT-fråga med en lång prompt. Det kräver **ingen ny frågetyp**. Det vi bör förbättra för skrivuppgifter:

1. **Större skrivyta.** `QuestionRenderer.tsx:85` hårdkodar `rows={3}`. Det räcker för en exit-ticket-mening men inte för en perspektivanalys. V1-fix: låt textarean växa (`rows` styrt av en valfri `question`-egenskap, eller bara auto-grow med CSS `field-sizing: content` / en min-höjd). Detta är en kosmetisk, lågriskändring i en befintlig komponent.
2. **Teckenräknare / "sparat"-indikator nära fältet.** Auto-spar finns redan (debounce 2 s). För en lång skrivuppgift vill eleven se trygghet att texten inte försvinner. Statusen finns redan (`StudentQuizForm.tsx:233-238`) men är liten och uppe i headern - för skrivuppgifter bör "Utkast sparat kl. 14:03" ligga synligt vid fältet.
3. **En-uppgift-per-sida snarare än stepper.** En skrivuppgift är ofta EN fråga. Steppern (Föregående/Nästa) blir meningslös med en fråga - då är det bara ett fält + Spara + Lämna in. Det fungerar redan så (steppern visar bara en fråga åt gången), men vi bör dölja Nästa/Föregående när `totalQuestions === 1`. Trivial.

**Viktigt avgränsande beslut (hedrar DevilsAdvocate + memory "Exit tickets i appen"):** exit-ticket-flervalsfrågor ska enligt lärarens etablerade praxis göras digitalt men aldrig tryckas i arbetsblad - de är redan i appen via `create_quiz_from_csv`. Skrivuppgifterna är det nya. Vi bygger INTE nya frågetyper (ranking, matchning, filuppladdning). En skrivuppgift = FREE_TEXT. Om en uppgift har flera delfrågor = en survey med flera FREE_TEXT-frågor. Det räcker för v1.

### 2.3 Spara framsteg, lämna in

Allt finns: auto-draft + manuell Spara (`StudentQuizForm.tsx:85-128`), partiell inlämning är på väg (spec daterad 2026-04-13). För skrivuppgifter är partiell inlämning extra viktig - eleven kanske skriver över flera lektioner. Ingen ny mekanik behövs; vi ärver draft-systemet.

En nyans: idag raderas draften vid inlämning och quiz kan göras om ("Öva igen"). För en **summativ skrivuppgift** (L6) vill läraren troligen att inlämning är slutgiltig - inte "öva igen". Detta är en survey-egenskap (t.ex. `allowResubmit`/redan finns `lockMode` som angränsar). Rekommendation: behandla som **senare** om det inte redan stör; i v1 kan en inlämnad skrivuppgift visa "Inlämnad" och en Visa-mitt-svar-länk istället för "Öva igen". (Beslut tas ihop med backend; frontend behöver bara veta status.)

### 2.4 Ta emot feedback - och var den hör hemma

Det finns idag TVÅ feedbackkanaler, och det är en UX-risk att de är åtskilda:

- **Per-svar-feedback** på FREE_TEXT (`Answer.feedback`), visas i `student/results/[responseId]` via `FeedbackButton.tsx` (märkt "AI-feedback", blå ruta).
- **Fristående AssignmentFeedback** (titel+innehåll), visas i `student/feedback` via `FeedbackList.tsx`, med oläst-räknare i `student/layout.tsx:11-15,33-37`.

För skrivuppgifter-i-momentet är **per-svar-feedback rätt kanal** (feedback hör till uppgiften och dess svar), inte den fristående AssignmentFeedback-listan. Rekommendation:

- **V1:** Återanvänd `Answer.feedback` + `FeedbackButton` precis som idag. När läraren ger feedback på en skrivuppgift via MCP (`save_feedback`), dyker den upp i elevens resultat-detalj för den uppgiften. Lägg en **feedback-notis på momentsidan** ("Ny feedback på L5 Perspektivanalys") så eleven hittar tillbaka - återanvänd oläst-badge-mönstret från layouten.
- Döp om `FeedbackButton`s etikett från strikt "AI-feedback" till neutralt "Feedback från läraren" eller "Återkoppling" om läraren själv skriver/kurerar den (idag antas AI). Liten textändring, men ärlighet mot eleven (etisk gräns: transparens).
- **Senare:** En samlad "feedback på det här momentet"-vy. Sannolikt onödig om momentsidan redan flaggar feedback per uppgift.

### 2.5 Förhållande till befintliga student/quiz och student/results

- `student/quiz/[surveyId]` och `/s/[shareCode]` **återanvänds oförändrade** som själva svars-/skrivflödet. Det enda som ändras är var man landar efteråt (momentsida om uppgiften nåddes via ett moment). Enklaste implementation: en query-param `?moment=<id>` som styr tillbaka-länken; default = dashboard som idag.
- `student/results` (lista) och `student/results/[responseId]` (detalj) **återanvänds oförändrade**. Momentsidans "Visa resultat"-länk pekar bara på rätt `responseId`.

---

## 3. Lärarytan och rapporten (b)

### 3.1 Vad rapporten ska visa - och vad den INTE ska visa

Lärarens önskemål: "en rapport om hur varje elevs / klassens arbete gått genom momentet". Två nivåer:

**Per-klass (momentöversikt):** En matris elever × uppgifter. Detta är den mest värdefulla vyn för en lärare som vill se "vem har inte börjat med L6", "var tappar klassen".

```
Moment: Källkritik AI och konspirationsteorier        Klass: SA21B (24 elever)

              L2 quiz   L3 exit   L5 skriv   L6 skriv   Momentstatus
  Elev #1     8/8 ✓     ✓         Inlämnad   Utkast     4/4 påbörjade
  Elev #2     6/8       ✓         Ej börjat  Ej börjat  2/4 påbörjade
  Elev #3     -         -         -          -          Ej börjat
  ...
  Klassnitt   84%       96% svar  18/24 inl  9/24 inl
```

Cellinnehåll beror på uppgiftstyp: quiz = poäng/procent, survey/skriv = status (Ej börjat / Utkast / Inlämnad / Bedömd). Klick på cell -> elevens svar på den uppgiften (= befintlig `students/[number]`-data eller survey-results filtrerat). Klick på radens elev -> elevens hela momentgenomgång. Klick på kolumnens uppgift -> befintlig survey-results-sida.

**Per-elev (genom hela momentet):** En vertikal genomgång: för varje uppgift i ordning, elevens svar, poäng/status och ev. given feedback. Detta är nästan exakt `students/[number]/page.tsx` men scopead till momentets surveys istället för alla. Stor återanvändning.

**Vad rapporten INTE ska vara (anti-scope-creep):** ingen betygsättningsmotor, inga aggregerade kunskapsmål-uppfyllelser mot E/C/A-matrisen (även om momentplanen har sådana kriterier - det är lärarens manuella bedömning, inte appens jobb), ingen automatisk "den här eleven ligger på C"-klassificering. Appen visar rådata och status; läraren bedömer. Detta hedrar både DevilsAdvocate ("adaptivt lärande/AI-analys = forskningsprojekt") och de etiska gränserna (bevara lärarens agentskap).

### 3.2 Hur det hänger ihop med befintlig data

- **`get_student_progress` (MCP)** returnerar redan en elevs alla svar med poäng (`mcp-server/src/tools/get-student-progress.ts`). Rapporten per elev är en webb-rendering av detta, filtrerad på momentets surveys. Backend-agenten bör överväga att lägga en motsvarande `get_module_progress`.
- **Resultat-API:t** `/api/courses/[courseId]/surveys/[id]/results` ger redan per-survey-aggregat + `studentStats` (med partial-submission-spec: `answered`, `correct`, `percentage`). Klass-matrisen kan i v1 byggas genom att hämta detta för varje survey i momentet och sy ihop i en tabell - eller (bättre) ett nytt `/api/courses/[courseId]/modules/[id]/report`-endpoint som gör join:en på servern. Frontend-mässigt är matrisen en `<table>` (samma stil som `admin/courses/[courseId]/page.tsx:64-88`).

### 3.3 Feedback-arbetsflödet för läraren

Idag ger läraren skrivuppgifts-feedback genom Claude Code + MCP (`get_answers_for_feedback` -> `save_feedback`), inte i webb-UI:t. Detta är medvetet (memory: "Survey ↔ planera-moment-integration", lärarens arbetssätt är Claude-driven). Rekommendation: **bygg INTE en feedback-redigerare i webb-admin i v1.** Momentrapporten ska däremot ha en tydlig "X skrivuppgifter väntar på feedback"-indikator per uppgift (vi vet redan vilka FREE_TEXT-svar som saknar `feedback`), så läraren vet när hon ska köra MCP-flödet. Webb-baserad feedback-inmatning = senare, om alls.

---

## 4. Komponent- och route-inventering (d)

### 4.1 Återanvänds oförändrade (eller nästan)

| Komponent / route | Roll i den nya funktionen | Ändring |
|---|---|---|
| `StudentQuizForm.tsx` | Svarsflöde för quiz-uppgifter i moment | Valfri `backHref`/`?moment`-param för tillbaka-länk. Annars ingen. |
| `SurveyForm.tsx` | Svarsflöde för survey/skriv-uppgifter | Samma som ovan. |
| `QuestionRenderer.tsx` | Renderar MC + FREE_TEXT | Liten: textarea-höjd för skrivuppgifter (rows/auto-grow). Inga nya typer. |
| `QuizResultsDisplay.tsx` | Resultat direkt efter inlämning | Ingen. |
| `student/results/[responseId]/page.tsx` + `FeedbackButton.tsx` | Elev ser sitt svar + feedback per uppgift | `FeedbackButton`: etikett "AI-feedback" -> neutral. Annars ingen. |
| `student/results/page.tsx` | Lista över alla svar | Ingen (momentsidan länkar in i den). |
| `ProgressBar.tsx` | Progress i survey-flödet | Ingen. Återanvänds även på momentsidan. |
| `ResultsCharts.tsx` | Per-fråga-diagram i lärarens survey-results | Ingen (rapporten länkar till befintlig survey-results per uppgift). |
| `FeedbackList.tsx` / `student/feedback` | Fristående lärarmeddelanden | Ingen i v1. (Behålls som separat kanal.) |
| `BaseSidebar.tsx` / `CourseSidebar.tsx` | Lärarnavigation | `CourseSidebar`: lägg till `Moment`-länk. `BaseSidebar` oförändrad. |
| `students/[number]/page.tsx` | Elevens svar (lärarvy) | Mönstret återanvänds/scopeas till moment i per-elev-rapporten. |
| Draft-systemet (`/api/surveys/[id]/draft`) | Spara framsteg i skrivuppgifter | Ingen. |

### 4.2 Nytt som måste byggas

**Routes (sidor):**

| Ny route | Typ | Innehåll |
|---|---|---|
| `src/app/student/moment/[moduleId]/page.tsx` | Elev, server | Momentlandning: titel, beskrivning, lista av uppgifter med per-uppgift-status + samlad progress. |
| `src/app/admin/courses/[courseId]/moment/page.tsx` | Lärare, server | Lista/CRUD av moment i kursen (skapa moment, koppla surveys, ordna). |
| `src/app/admin/courses/[courseId]/moment/[moduleId]/page.tsx` | Lärare | Momentets uppgifter + ingång till rapport. |
| `src/app/admin/courses/[courseId]/moment/[moduleId]/rapport/page.tsx` | Lärare, client | Klassmatris (elever × uppgifter) + per-elev-drill-in. (Alternativt under `/progress` - se IA.) |

**Komponenter:**

| Ny komponent | Roll | Bygger på |
|---|---|---|
| `ModuleTaskList.tsx` (elev) | Renderar uppgiftslistan med statusbrickor på momentsidan | Survey-korts-loopen i `student/page.tsx:160-227` |
| `TaskStatusBadge.tsx` | Liten bricka: Ej börjad / Utkast / Inlämnad / Klar / Ny feedback | Befintliga `badge`-klasser + oläst-badge i layouten |
| `ModuleProgressSummary.tsx` | Samlad progress över momentets uppgifter (X/N klara) | `ProgressBar.tsx` + mastery-progress i `student/page.tsx:195-208` |
| `ModuleReportMatrix.tsx` (lärare) | `<table>` elever × uppgifter med klickbara celler | Tabellstilen i `admin/courses/[courseId]/page.tsx:64-88` + grid i `surveys/[id]/results/page.tsx:106-127` |
| `ModuleStudentReport.tsx` (lärare) | En elevs genomgång av hela momentet | `students/[number]/page.tsx` |
| `SurveysManager`-analog `ModulesManager.tsx` | Skapa/redigera moment, koppla surveys, ordna | `components/admin/SurveysManager.tsx` (CRUD-mönstret) |

**API-routes (frontend-konsumtion, bekräftas med backend-agenten):**

- `GET /api/courses/[courseId]/modules` - lista moment
- `POST /api/courses/[courseId]/modules` - skapa
- `GET /api/courses/[courseId]/modules/[id]/report` - klassmatris-data (join över survey-results)
- `GET /api/student/modules/[id]` - momentets uppgifter + elevens status per uppgift

### 4.3 Uppgiftens "status" - den enda nya beräkningen frontend behöver

Per (elev, uppgift/survey):

- **Ej börjad:** ingen draft, ingen response.
- **Utkast:** draft finns, ingen response.
- **Inlämnad:** minst en response finns.
- **Klar:** quiz där alla frågor är mastered (återanvänd `calculateMastery`, `lib/mastery.ts`) ELLER skrivuppgift som lämnats in (+ ev. bedömd om vi inför det).
- **Ny feedback:** response finns och minst ett FREE_TEXT-svar har `feedback` som eleven inte sett (kräver ev. ett "feedback-läst"-spår; i v1 räcker att visa att feedback finns).

Denna logik bör ligga i en delad helper (server-side), inte spridas i komponenter.

---

## 5. Wireframes (text)

### 5.1 Elev: dashboard med moment

```
┌──────────────────────────────────────────────┐
│ Samhällskunskap 3            Kurskod: SA3X     │
│ Visa alla mina resultat →                      │
│                                                │
│ 🚩 Frågor att öva på (3)        [befintligt]   │
│ Frågor att repetera (5)         [befintligt]   │
│                                                │
│ MOMENT                                         │
│ ┌────────────────────────────────────────┐    │
│ │ Källkritik: AI och konspirationsteorier │    │
│ │ ████████░░░░  3/6 uppgifter klara        │    │
│ │                          [Öppna moment]  │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ FRISTÅENDE ENKÄTER                             │
│ ┌────────────────────────────────────────┐    │
│ │ Lektion 1 - Förkunskaper (enkät) [Klar] │    │  ← befintliga survey-kort
│ └────────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 5.2 Elev: momentsida

```
┌──────────────────────────────────────────────┐
│ ← Dashboard                                    │
│ Källkritik: AI och konspirationsteorier        │
│ 8 lektioner. Gör uppgifterna i ordning.        │
│ ████████░░░░  3 av 6 uppgifter klara           │
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ L2 Källkritiska verktyg (quiz)          │    │
│ │ [Klar 8/8 · 100%]            Visa svar → │    │
│ ├────────────────────────────────────────┤    │
│ │ L5 Perspektivanalys (skrivuppgift)      │    │
│ │ [Utkast sparat 14:03]        Fortsätt →  │    │
│ ├────────────────────────────────────────┤    │
│ │ L6 Summativ skrivuppgift                │    │
│ │ [Ej börjad]                  Starta →    │    │
│ │ 🔵 Ny feedback från läraren              │    │
│ └────────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 5.3 Lärare: momentrapport (klassmatris)

```
┌───────────────────────────────────────────────────────────┐
│ Källkritik AI...     ← Moment    [Exportera CSV]            │
│                                                            │
│           │ L2 quiz │ L3 exit │ L5 skriv │ L6 skriv │ Status │
│  #1       │  8/8 ✓  │   ✓     │  Inlämn. │  Utkast  │ 4/4    │
│  #2       │  6/8    │   ✓     │  Ej börj.│  Ej börj.│ 2/4    │
│  #3       │   -     │   -     │   -      │   -      │ 0/4    │
│  ─────────┼─────────┼─────────┼──────────┼──────────┤        │
│  Klass    │  84%    │ 23 svar │ 18 inl.  │ 9 inl.   │        │
│                                                            │
│  ⚠ 6 skrivuppgiftssvar väntar på feedback (kör MCP-flödet) │
└───────────────────────────────────────────────────────────┘
   celler klickbara → elevens svar på den uppgiften
```

---

## 6. V1 vs senare

### V1 (måste, för att uppfylla lärarens tre önskemål med minsta möjliga yta)

1. **Moment som grupperingslager** (Module + ModuleItem -> survey). Inga ändringar i respond/scoring/draft.
2. **Elev-momentsida** (`student/moment/[id]`) med uppgiftslista + statusbrickor + samlad progress. Återanvänder survey-flödet helt.
3. **Skrivuppgifter = FREE_TEXT** med större textarea (rows/auto-grow) och synlig spar-status. Inga nya frågetyper.
4. **Tillbaka-till-moment** efter inlämning (`?moment`-param).
5. **Feedback via befintlig per-svar-kanal** (`Answer.feedback` + `FeedbackButton`), med notis på momentsidan när feedback finns. Neutralisera etiketten "AI-feedback".
6. **Lärar-momentlista + CRUD** (`admin/.../moment`) - minst: skapa moment, koppla surveys, ordna.
7. **Lärar-momentrapport: klassmatris** (elever × uppgifter, status/poäng per cell) + **per-elev-drill-in** (återanvänder students/[number]-mönstret). Indikator för "svar väntar på feedback".
8. Partiell inlämning förutsätts redan vara på plats (separat spec).

### Senare (uttalat utanför v1)

- Webb-baserad feedback-inmatning för läraren (behåll MCP-flödet).
- "Slutgiltig inlämning" / låsning av summativa skrivuppgifter (no-resubmit) - bara om lärarna faktiskt stör sig på "Öva igen" på en summativ uppgift.
- Samlad "feedback på momentet"-vy för eleven (momentsidans per-uppgift-notiser räcker troligen).
- Nya frågetyper (matchning, ranking, filuppladdning av elevdokument). Uttryckligen YAGNI för en-lärar-skala.
- Automatisk koppling momentplan.md -> moment (idag skapar `create_quiz_from_csv` redan quiz; en framtida MCP `create_module_from_momentplan` kunde göra hela momentet). Detta är en MCP/backend-fråga, inte frontend.
- Aggregerad måluppfyllelse mot E/C/A-kriterier - medvetet INTE appens jobb.
- Realtid/live-rapport (DevilsAdvocate: polling räcker; för en momentrapport räcker en omladdning).

---

## 7. Öppna frågor (till orkestrerare / andra agenter)

1. **Var bor lärar-rapporten?** Under `/moment/[id]/rapport` eller i den redan reserverade `/progress`-ingången (`CourseSidebar.tsx:19`)? Rekommendation: `/progress` listar moment + kursöversikt; den djupa matrisen ligger på momentnivå. Behöver bekräftas mot hur läraren tänker navigera.
2. **Datamodell-form** (databas-agentens beslut): är Module/ModuleItem rätt? Ska ett moment kunna innehålla "uppgifter" som inte är surveys (t.ex. en ren instruktionstext eller en utskriftslänk)? För v1 antar frontend att varje uppgift = en survey.
3. **Status "Bedömd" vs "Inlämnad":** behöver vi en explicit bedömd-status, eller räcker "har feedback"? Påverkar TaskStatusBadge och rapportens cellinnehåll.
4. **Feedback-läst-spår för skrivuppgifter:** AssignmentFeedback har `readAt`; `Answer.feedback` har det inte. Vill vi visa "ny feedback"-notis på momentsidan behövs antingen ett läst-fält på Answer eller att vi återanvänder AssignmentFeedback-kanalen för skrivuppgiftsfeedback. Påverkar både datamodell och elevens notisflöde.
5. **Hur skapas momentet i praktiken?** Manuellt i webb-admin (ModulesManager) eller via MCP från en momentplan? V1 frontend bygger manuell CRUD; MCP-vägen är senare men bör inte blockeras av datamodellen.
6. **Summativa uppgifter och "Öva igen":** ska en inlämnad skrivuppgift kunna göras om? Påverkar momentsidans knapptext och draft-radering.

---

## 8. Största UX-risker

1. **Dubbla feedbackkanaler förvirrar eleven.** AssignmentFeedback (`/student/feedback`) och per-svar-feedback (`/student/results/[responseId]`) lever redan parallellt. Inför vi en tredje "moment-feedback"-känsla blir det tre ställen att leta. *Motåtgärd:* knyt skrivuppgiftsfeedback till uppgiftens svar (per-svar-kanalen) och flagga den på momentsidan; lägg INTE en separat momentfeedback-inkorg.
2. **Moment-lagret gör platta listan tyngre.** Idag är dashboarden en enkel lista. Inför vi moment + fristående surveys + flaggade + repetition blir det fyra sektioner. *Motåtgärd:* tydlig sektionshierarki, moment överst, kollapsa tomma sektioner.
3. **Scope-creep mot LMS.** Frestelsen att lägga betygsmatris, rubrik-bedömning, måluppfyllelse i rapporten är stor eftersom momentplanen HAR E/C/A-kriterier. *Motåtgärd:* rapporten visar status/poäng/rådata, aldrig automatisk betygsklassificering. Lärarens bedömning förblir manuell (etisk gräns + DevilsAdvocate).
4. **Skrivuppgift som förloras.** En elev som skriver en lång perspektivanalys och tappar texten är en allvarlig förtroendeskada. *Motåtgärd:* auto-draft finns redan men gör spar-statusen mycket synlig vid skrivfältet; överväg "din text sparades senast kl X" permanent synlig för FREE_TEXT.
5. **Stepper-UI passar dåligt för en lång skrivuppgift.** Föregående/Nästa/en-fråga-i-taget är designat för quiz. En enkel skrivuppgift med en fråga ska inte se ut som ett quiz. *Motåtgärd:* dölj stepper-navigation när momentuppgiften har en (eller få) frågor; visa fältet direkt.
6. **Rapportmatrisen blir oläslig på bredden.** Många uppgifter × många elever spränger en `<table>` på skärmen. *Motåtgärd:* horisontell scroll (finns redan i `card overflow-x-auto`-mönstret), frys elevkolumnen, och håll cellinnehållet kompakt (ikon/poäng, ej text).
7. **"Klar" är tvetydigt mellan quiz och skrivuppgift.** Quiz blir "klar" via mastery; en skrivuppgift har ingen mastery - "klar" = inlämnad (eller bedömd?). *Motåtgärd:* TaskStatusBadge måste vara typmedveten; använd "Inlämnad/Bedömd" för skrivuppgifter, "Klar X/X" för quiz.
```
