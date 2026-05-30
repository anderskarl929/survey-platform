# 03 - Integrations- och bedömningsflöde: plugin -> app -> feedback -> rapport

**Lins:** Det konceptuella limmet mellan momentplanering-pluginen och survey-platform.
**Skala:** EN gymnasielärare, <100 elever, INTE ett LMS.
**Ethos:** DevilsAdvocate.md - bygg det läraren faktiskt orkar använda, inte ett analytics-monster. Skilj "måste för v1" från "senare".

Detta dokument analyserar inte UI-/datamodellsdetaljer i appen i sig (det gör syskondokumenten 01/02) utan **sömmen**: vad pluginen producerar, hur det ska in i appen, hur feedback når eleven, och hur en rapport till läraren genereras.

---

## Sammanfattning av nuläget (vad som redan finns)

**Pluginen `/planera-moment`** producerar per moment (verifierat mot riktiga exempel under `output/lessons/`):

- `momentplan.md` - översikt, lärandemål med E/C/A, lektionstabell, progressionslogik, exit-ticket-slinga
- `lektion-N.md` - lärarens lektionsplaner (sex-fas-modell, tidsplanering, lärarinstruktioner)
- `elevuppgift-lektion-N.md` - elevmaterial: källtexter, analysfrågor, EPA/jigsaw, skrivuppgifter med stödmallar, begreppslistor, differentiering (stöd/utmaning), exit ticket
- `bedomningskriterier.md` - E/C/A-kriterier per summativ ändpunkt
- `exit-ticket-mall.md` - en exit ticket per lektion (typ: Strukturerad/Öppen) kopplad till lärandemål + retrieval review
- Presentationer (reveal.js HTML), momentöversikt (HTML)
- Diverse stödfiler: `faktablad-`, `case-`, `tredjepersons-framing.md`, `facit-`

**Appens datamodell (Prisma):** `Course -> Topic -> Question (MULTIPLE_CHOICE | FREE_TEXT) -> QuestionOption`. `Survey (SURVEY | QUIZ, lockMode)` binder ihop frågor via `SurveyQuestion(order)`. `Response -> Answer(value, feedback?, isCorrect?)`. Separat: `AssignmentFeedback` (per elev, fristående feedback med titel/innehåll, `readAt`), `DraftResponse` (autospar), `FlaggedQuestion` (elev flaggar fråga).

**Befintlig MCP-yta (11 verktyg + 3 resurser):**
- Skapa: `import_questions`, `create_survey`, `create_quiz_from_csv`
- Hämta: `get_results`, `summarize_results`, `get_student_progress`, `get_recent_responses`
- Feedback: `get_answers_for_feedback` -> `save_feedback` (per fritextsvar), `post_assignment_feedback` / `bulk_post_assignment_feedback` (fristående per elev)
- Resurser: `survey://courses`, `.../topics`, `.../questions`

**Befintlig CSV (`csv.ts`):** `topic,type,text,option1..option10,correctAnswer`. Per fråga. Ingen plats för instruktion, bedömningskriterier, lektionstillhörighet eller maxlängd.

**Dagens integration:** bara exit-ticket-flerval når appen via `create_quiz_from_csv`. Resten av elevmaterialet lever som dokument.

---

## (a) Vad producerar pluginen - och vad hör hemma i appen?

Nyckelinsikt: ett `elevuppgift-lektion-N.md` är **inte en uppgift** - det är ett *arbetsblad som blandar 4-6 olika aktivitetstyper*. Att "lägga hela momentet i appen" betyder INTE att klistra in arbetsbladen. Det betyder att plocka ut de **digitalt insamlingsbara svarsmomenten** och låta resten förbli dokument/klassrumsaktivitet.

### Klassificering

**JA - hör hemma i appen (eleven producerar ett individuellt, insamlingsbart svar):**

| Plugin-element | Appens form | Motivering |
|---|---|---|
| Exit tickets (alla) | QUIZ (flerval) eller SURVEY/FREE_TEXT | Redan etablerat. Minnesregeln säger uttryckligen: exit tickets görs digitalt, trycks aldrig i arbetsblad. |
| Strukturerade analysfrågor med rätt/fel | MULTIPLE_CHOICE i QUIZ | Begreppsmatchning, "para grundfråga med SIFT-steg" - rättas automatiskt, ger mastery-data. |
| Individuella skrivuppgifter (perspektivanalys, persontext-analys, "minst 150 ord") | FREE_TEXT i SURVEY | Det här är den nya kärnan. Idag tappas dessa. Lämpar sig för lärare+AI-feedback. |
| Självpositionering / metakognitiv reflektion (L7) | FREE_TEXT | Individuellt skrivande, värdefullt att samla för uppföljning. |
| Formativ "dress rehearsal"-skrivuppgift (L5) | FREE_TEXT | Behöver formativ återkoppling - perfekt match för feedback-flödet. |

**NEJ - förblir dokument / klassrumsaktivitet (kan länkas FRÅN appen men görs inte I appen):**

| Plugin-element | Varför inte appen |
|---|---|
| Källtexter / faktablad / case-beskrivningar | Läsmaterial, inte svar. Distribueras som dokument eller länk; appen kan visa instruktionstext men ska inte bli en läsplattform. |
| EPA-diskussion, jigsaw (expert-/hemgrupp) | Muntligt, gruppbaserat, kollaborativt. Den *individuella* skriftliga delen kan samlas in; själva diskussionen kan inte och ska inte digitaliseras. |
| Muntligt seminarium / summativ muntlig examination (L8) | Bedöms av läraren i rummet mot kriterier. Resultatet (omdömet) kan postas tillbaka som `AssignmentFeedback`, men uppgiften görs inte i appen. |
| Summativ skrivuppgift på papper/prov (L6) om läraren vill ha det på papper | Lärarens val. Om den skrivs digitalt -> FREE_TEXT i lockMode-SURVEY. Omdömet kan ändå postas som `AssignmentFeedback`. |
| Differentiering, lärarinstruktioner, begreppslistor | Stödmaterial, inte svar. Visas i dokument. |

### Designprincip (anti-scope-creep)

Appen är en **svarsinsamlare och feedbackkanal**, inte ett innehållssystem. Regeln:

> Om det finns ett individuellt elevsvar som läraren vill se -> appen.
> Om det är läsning, muntligt, gruppdynamik eller stödmaterial -> dokument.

Detta respekterar lärarens sex-fas-modell och EPA-ansats: appen tar exit-ticket-slingan (fas 6 -> fas 1) plus de individuella skrivmomenten, men tränger inte undan det muntliga och kollaborativa som är pedagogikens kärna.

---

## (b) Importkontraktet: räcker CSV?

**Nej, inte för rikare uppgifter.** CSV (`topic,type,text,option1..,correctAnswer`) saknar:

1. **Instruktionstext** (en skrivuppgift har en lång prompt + stödmallar, inte bara en "fråga")
2. **Bedömningskriterier** kopplade till uppgiften (E/C/A att stödja feedback mot)
3. **Lektions-/momenttillhörighet** (vilken survey hör till vilket moment, lektion, lärandemål)
4. **Svarsformatshintar** (minlängd, "minst 150 ord", förväntad svarstyp)
5. **Gruppering** (en survey = en lektions exit ticket; ett moment = flera surveys)

CSV är fortfarande bra för det den gör (snabb flervalsbatch). Men för "ett helt moment" behövs ett rikare kontrakt.

### Förslag: ett moment-manifest i JSON

Pluginen genererar en `moment-import.json` (parallellt med de mänskliga dokumenten) som beskriver hela momentets digitala del. Ett nytt MCP-verktyg `import_moment` läser det. CSV behålls oförändrat för enkla fall.

```json
{
  "course_code": "SAM3A",
  "moment": {
    "title": "Källkritik - Konspirationsteorier och AI",
    "subject": "Samhällskunskap 3",
    "learning_goals": [
      { "id": "LM1", "text": "Tillämpa källkritiska verktyg på digitalt innehåll" },
      { "id": "LM2", "text": "Analysera varför konspirationsteorier upplevs övertygande" }
    ]
  },
  "surveys": [
    {
      "ref": "L3-exit",
      "title": "Exit ticket L3 - AI och konspirationsteorier",
      "lesson": 3,
      "mode": "SURVEY",
      "lock_mode": false,
      "questions": [
        {
          "topic": "AI och konspirationsteorier",
          "type": "FREE_TEXT",
          "text": "Varför kan AI-genererade konspirationsteorier vara svårare att granska källkritiskt än traditionella? Resonera utifrån minst en mekanism.",
          "instructions": "3-4 meningar. Använd tredjepersons-framing.",
          "learning_goal": "LM2",
          "min_length": 200,
          "criteria": {
            "E": "Enkla resonemang, enkla samband med AI:s roll.",
            "C": "Välgrundade resonemang, samband psykologi <-> AI, visst kritiskt perspektiv.",
            "A": "Nyanserade resonemang, komplexa samband ur flera perspektiv."
          }
        }
      ]
    },
    {
      "ref": "L6-skriv",
      "title": "L6 Summativ perspektivanalys",
      "lesson": 6,
      "mode": "SURVEY",
      "lock_mode": true,
      "questions": [
        {
          "topic": "Skriftlig perspektivanalys",
          "type": "FREE_TEXT",
          "text": "Granska en konspirationsteori med källkritiska verktyg. Resonera om varför den kan upplevas övertygande. Referera dina källor (Harvard).",
          "instructions": "Längre text. Kriterierna gäller per E/C/A nedan.",
          "learning_goal": "LM1",
          "min_length": 1500,
          "criteria": { "E": "...", "C": "...", "A": "..." }
        }
      ]
    }
  ]
}
```

### Mappning mot Prisma-datamodellen

| Manifest-fält | Prisma | Kommentar |
|---|---|---|
| `course_code` | `Course.code` (lookup) | Finns redan; `post_assignment_feedback` slår redan upp på kod. |
| `surveys[].title/mode/lock_mode` | `Survey` | 1:1. |
| `questions[].topic` | `Topic` (upsert per courseId+name) | Som idag. |
| `questions[].type/text` | `Question.text/type` | 1:1. |
| `questions[].options/correctAnswer` | `QuestionOption.text/isCorrect` | Som idag. |
| `questions[].instructions` | **saknar fält** | Se nedan - kräver litet schematillägg ELLER prependas i `text`. |
| `questions[].criteria` (E/C/A) | **saknar fält** | Behöver INTE lagras i appen för v1 - se nedan. |
| `questions[].min_length` | **saknar fält** | Frontend-validering; kan utelämnas i v1. |
| `learning_goal`, `lesson`, `moment` | **saknar fält** | Metadata för rapporten; se v1-avgränsning nedan. |

### Var ska kriterier och metadata leva? (kritiskt designval)

DevilsAdvocate varnar för att uppfinna fält och bygga LMS. Två vägar:

- **V1 (rekommenderas):** Lagra INTE kriterier/lärandemål/lektion i appens databas. De lever i `bedomningskriterier.md` och i manifestet. Claude läser manifestet + kriteriefilen **vid feedback- och rapporttillfället** via MCP/fil. Appen förblir tunn. `instructions` prependas i frågans `text` (eleven ser det), eller - om man vill ha det rent - läggs ETT nullbart fält till: `Question.instructions String?`. Det är det enda schematillägget jag skulle försvara för v1, och bara om instruktionen blir ful inbakad i frågetexten.
- **Senare:** Om rapporten ska genereras *inne i appen* (inte via Claude) behövs persistenta fält för `learning_goal`, `lesson`, `criteria`. Det är ett större åtagande - skjut tills behovet bevisats.

**Slutsats (b):** JSON-manifest som importkontrakt via nytt `import_moment`-verktyg. CSV behålls för enkla flervalsbatcher. Maximalt ETT nytt nullbart fält (`Question.instructions`). Kriterier och momentmetadata hålls utanför appen och konsumeras av Claude vid feedback/rapport.

---

## (c) Feedback-modellen pedagogiskt

Appen har redan tre feedback-mekanismer. De täcker behovet om de orkestreras rätt:

1. **Flerval (QUIZ):** auto-rättning vid svar (`Answer.isCorrect`). Eleven ser rätt/fel direkt. Ingen lärarinsats. Detta är gateway-check-/retrieval-data.
2. **Per-svar fritextfeedback (`Answer.feedback`):** läraren (med AI-assistans) skriver feedback på ett specifikt fritextsvar. Eleven ser den kopplad till sitt svar.
3. **Fristående uppgiftsfeedback (`AssignmentFeedback`):** helhetsomdöme per elev på en uppgift som inte nödvändigtvis gjordes i appen (uppsats, seminarium, summativ skrivuppgift). Eleven ser den i `/student/feedback`.

### Vem genererar vad?

| Uppgiftstyp | Vem genererar | Mekanism | Når eleven via |
|---|---|---|---|
| Flerval / exit-ticket-quiz | Automatiskt | `isCorrect` vid inlämning | Direkt i appen efter svar |
| Formativa fritextsvar (L3, L5, L7 exit/reflektion) | **Lärare + AI** (Claude föreslår, läraren godkänner) | `get_answers_for_feedback` -> Claude utkast -> läraren justerar -> `save_feedback` | Kopplat till svaret |
| Summativ skrivuppgift (L6) | **Lärare** (AI får assistera men läraren äger omdömet) | `post_assignment_feedback` mot `bedomningskriterier.md` | `/student/feedback` |
| Muntligt seminarium (L8) | Lärare (manuellt, i rummet) | `post_assignment_feedback` | `/student/feedback` |

### Pedagogisk gräns (viktig)

CLAUDE.md: "Bevara användarens agentskap... du dikterar inte slutsatser." Översatt till feedback: **AI får skriva utkast, läraren äger bedömningen.** Aldrig auto-postad AI-feedback på summativa moment. För formativa fritextsvar är AI-utkast + lärargodkännande acceptabelt och tidsbesparande - men det ska vara ett godkännandesteg, inte tyst auto-publicering. Detta motverkar också elevberoende och håller läraren i loopen.

### Realistiskt arbetsflöde (det läraren faktiskt orkar)

**Formativ slinga (efter en lektions exit ticket / fritextsvar):**
1. Läraren säger till Claude: "Hämta obesvarade fritextsvar för survey X."
2. Claude kör `get_answers_for_feedback` (returnerar bara svar utan feedback - smart, ingen dubbelarbete).
3. Claude läser `bedomningskriterier.md` + manifestets `criteria` och föreslår 3-4-meningars feedback per svar, mot rätt lärandemål.
4. Läraren skummar, justerar de som behövs, godkänner.
5. Claude kör `save_feedback` per svar.
6. Eleverna ser feedback nästa gång de loggar in.

**Summativ slinga (efter L6/L8):**
1. Läraren rättar (ev. med AI som bollplank mot kriterierna).
2. Claude kör `bulk_post_assignment_feedback` med ett omdöme per elev.

Detta passar exit-ticket-slingan: feedback-flödet matar fas 1 (retrieval review) i nästa lektion. Mastery-logiken (`mastery.ts`: två rätt i rad = mastered, spaced review efter 2 dagar på fel svar) ger redan ett underlag för vilka frågor som ska återkomma.

**Avgränsning:** Bygg INGA nya feedback-mekanismer. De tre befintliga räcker. Det som saknas är inte fler verktyg utan att Claude får **momentkontext** (kriterier + lärandemål) vid feedbacktillfället - vilket manifestet/kriteriefilen ger.

---

## (d) Rapporten: "hur har arbetet gått"

### Vad denna lärare behöver (inte ett analytics-monster)

Lärarens fråga är pedagogisk, inte statistisk: *"Hur har varje elev och klassen tagit sig genom momentet, och var behöver jag agera?"* Rapporten ska vara handlingsbar och knyta till `bedomningskriterier.md`. DevilsAdvocate-testet: varje rad i rapporten ska kunna leda till en lärarhandling. Annars bort.

### Rapportens innehåll (punktvis)

**Del 1 - Klassöversikt (momentnivå):**
- Completion per survey/lektion: hur många av klassen har lämnat in varje moments survey (t.ex. "L3 exit: 24/28, L5 skriv: 19/28").
- Exit-ticket-trend över lektionerna: utvecklas förståelsen? (andel rätt på flerval per lektion; för fritext: andel som nått resonemangsnivå enligt Claudes läsning).
- Mastery per topic: vilka begrepp/lärandemål sitter (mastery.ts), vilka behöver retrieval review. Direkt input till fas 1.
- Flaggade frågor (`FlaggedQuestion`): vilka frågor eleverna själva markerat som oklara - signal om otydlig fråga eller svårt begrepp.
- 2-3 klasstrender i fritextsvaren (Claude syntetiserar från `summarize_results`): vanliga missuppfattningar, starka mönster.

**Del 2 - Per elev (det läraren tittar på inför betygssamtal/uppföljning):**
- Completion: vilka surveys eleven gjort / saknar.
- Exit-ticket-utveckling: trend över momentet (förstod -> osäker -> missade-mönstret från slingan).
- Skrivsvarens status och kvalitet: inlämnat? Fått feedback? Claudes bedömning av nivå (E/C/A-indikation mot kriterierna - **som lärarstöd, inte satt betyg**).
- Summativa omdömen (L6/L8) som redan postats via `AssignmentFeedback`.
- Flagga: elever som halkar efter (låg completion, fallande exit-ticket-trend) - kopplar till equity-safeguardens "privat uppföljningsplan".

**Vad rapporten INTE ska innehålla (anti-scope-creep):**
- Inga setade betyg (läraren betygsätter, inte appen/AI).
- Ingen tidsspårning, klickdata, engagemangspoäng, gamification.
- Inga prediktiva "risk-scores" - bara observerbar completion + lärarens egen läsning.
- Ingen jämförelse mellan elever utöver det läraren själv ber om.

### Hur genereras rapporten?

**Via Claude/MCP, inte i appen (v1).** Detta är det avgörande designvalet och det DevilsAdvocate-vänliga: en rapport som binder ihop completion + mastery + fritextkvalitet + kriterier är exakt en LLM-syntesuppgift, och att bygga den som en appvy kräver persistens av lärandemål/kriterier (LMS-drift). Istället:

1. Läraren: "Skriv en momentrapport för Källkritik-momentet, SAM3A."
2. Claude samlar in via MCP: per survey i momentet -> `summarize_results` + `get_results`; per elev -> `get_student_progress`; flaggor och recent via befintliga verktyg.
3. Claude läser `bedomningskriterier.md` + manifestet (lärandemål, lektionskoppling) från fil.
4. Claude skriver en strukturerad markdown-/docx-rapport (klassöversikt + per elev) och kan leverera den som dokument i `output/`.

Det enda som saknas för att detta ska fungera smidigt är **ett verktyg som vet vilka surveys som hör till samma moment** (idag är surveys lösa) och **ett verktyg som returnerar hela momentets data i ett anrop** istället för N anrop. Se (e).

---

## (e) Sömmen plugin <-> app via MCP

### Hur systemen pratar idag

Pluginen genererar dokument lokalt. När exit-ticket-flerval ska in anropar pluginen/Claude `create_quiz_from_csv` mot MCP-servern, som skriver direkt i samma Neon-databas som appen läser. Resultathämtning och feedback går samma väg (MCP -> Prisma -> DB). Gotcha (från minnet): Neon-adaptern, TCP 5432 blockerat i vissa nät -> pooled connection string krävs.

### Vad saknas - minimal ny yta

Sorterat efter värde/kostnad. Allt återanvänder befintlig Prisma; inga nya feedback-mekanismer.

**V1 (bygg nu):**

1. **`import_moment`** (nytt verktyg) - tar JSON-manifestet (b), skapar alla surveys + frågor för ett moment i ett anrop, returnerar share-koder per survey. Löser "lägg hela momentet i appen". Bygger på `create_quiz_from_csv`-logiken (samma upsert-topic + transaktion), bara med fler surveys och `instructions`-stöd.
2. **`get_moment_report`** (nytt verktyg) - tar en lista survey-ID:n (eller ett moment-ref) + kurs, returnerar aggregerad data: per survey completion/mastery/flervalsfördelning, per elev completion + svar + score, alla fritextsvar, flaggade frågor. I praktiken `summarize_results` x N + `get_student_progress` x N + flaggor, hopslaget. Sparar Claude från 50 anrop och ger rapporten i ett svep. **Detta är det enskilt mest värdefulla nya verktyget.**

**Senare (bygg när behovet bevisats):**

3. **Moment-gruppering i datamodellen.** Idag är surveys lösa. För att `get_moment_report` ska veta vilka surveys som hör ihop kan man i v1 låta Claude skicka in survey-ID-listan (Claude kommer ihåg dem från `import_moment`-svaret eller frågar). En riktig `Moment`-tabell (Survey.momentId) är renare men är ett schematillägg -> senare.
4. **`get_assignment_feedback_status`** - vilka elever saknar feedback på en uppgift (komplement till `get_answers_for_feedback` som bara ser fritext-Answer, inte `AssignmentFeedback`). Litet, bygg vid behov.
5. **MCP-resurs `survey://courses/{id}/moments`** - om Moment-tabell införs.

### Vad man INTE ska bygga (DevilsAdvocate)

- Inga MCP prompts (nästan ingen klient använder dem).
- Ingen rapport-UI-vy i appen i v1 (Claude genererar rapporten).
- Inga nya frågetyper utöver MULTIPLE_CHOICE/FREE_TEXT (LIKERT kan diskuteras men inte för detta).
- Ingen lagring av E/C/A-kriterier i DB i v1.

---

## End-to-end-flödesdiagram (text)

```
                        [ LÄRAREN ]
                            |
        "planera ett moment om källkritik" (Claude Code)
                            |
                            v
   +==========================================================+
   |  PLUGIN /planera-moment                                  |
   |  Genererar:                                              |
   |   - momentplan.md, lektion-N.md      (LÄRARDOKUMENT)     |
   |   - elevuppgift-lektion-N.md         (ARBETSBLAD)       |
   |   - bedomningskriterier.md           (KRITERIER)        |
   |   - presentationer/HTML              (UNDERVISNING)     |
   |   - moment-import.json   <-- NYTT    (DIGITAL DEL)      |
   +==========================================================+
            |                                   |
   dokument levereras                  moment-import.json
   (Word/HTML/PDF, papper)                     |
            |                                   v
            |                    +==============================+
            |                    | MCP: import_moment  (NYTT)   |
            |                    | -> skapar surveys+frågor i DB|
            |                    | -> returnerar share-koder    |
            |                    +==============================+
            |                                   |
            v                                   v
   +-----------------+              +===========================+
   | LÄSNING, EPA,   |              |   SURVEY-PLATFORM (app)   |
   | JIGSAW, MUNTLIGT|              |   Neon DB, /s/<shareCode> |
   | (i klassrummet) |              +===========================+
   +-----------------+                          |
            |                          eleven loggar in,
   bedöms i rummet                     gör surveys:
   mot kriterier                        - flerval (auto-rättas)
            |                           - fritext (skriv)
            |                                   |
            |                          DraftResponse autospar
            |                          Response/Answer skapas
            |                                   |
            |                                   v
            |              +===================================+
            |              |  FEEDBACK-SLINGA (lärare + AI)     |
            |              |  get_answers_for_feedback          |
            |              |   -> Claude utkast (mot kriterier) |
            |              |   -> LÄRAREN godkänner/justerar    |
            |              |   -> save_feedback                 |
            |              +===================================+
            |                                   |
            +-----> post_assignment_feedback ---+  (summativa omdömen L6/L8)
                         (bulk)                 |
                                                v
                                  +===========================+
                                  | ELEVEN ser feedback:      |
                                  |  - rätt/fel direkt (quiz) |
                                  |  - Answer.feedback        |
                                  |  - /student/feedback      |
                                  |    (AssignmentFeedback)   |
                                  +===========================+
                                                |
                            (data ackumuleras genom momentet)
                                                |
                                                v
                          +=================================+
                          | MCP: get_moment_report  (NYTT)  |
                          | aggregerar completion, mastery, |
                          | fritextkvalitet, flaggor, trend |
                          +=================================+
                                                |
                          Claude + bedomningskriterier.md
                                                |
                                                v
                          +=================================+
                          |  MOMENTRAPPORT (markdown/docx)  |
                          |  -> output/, till LÄRAREN       |
                          |  klassöversikt + per elev       |
                          +=================================+
                                                |
                                                v
                          matar fas 1 (retrieval review)
                          i nästa lektion + uppföljning
```

Slingan sluter sig: exit-ticket-data (fas 6) -> rapport/mastery -> retrieval review (fas 1) nästa lektion, precis som `momentplan.md` beskriver.

---

## V1 vs senare (sammanfattat)

**V1 (måste):**
- JSON moment-manifest som importkontrakt (pluginen genererar det vid sidan av dokumenten).
- `import_moment` MCP-verktyg (skapar hela momentets surveys i ett anrop).
- `get_moment_report` MCP-verktyg (aggregerad rapportdata i ett anrop).
- Feedback via befintliga mekanismer + lärargodkännande på AI-utkast.
- Rapport genereras av Claude (markdown/docx), inte i appen.
- Max ETT schematillägg: `Question.instructions String?` (endast om instruktion blir ful i frågetexten).

**Senare (när behovet bevisats):**
- `Moment`-tabell (Survey.momentId) för riktig gruppering.
- Rapport-UI-vy i appen (om läraren vill ha den utan Claude).
- `get_assignment_feedback_status`-verktyg.
- Persistens av lärandemål/kriterier i DB (bara om appintern rapport byggs).
- LIKERT/MULTIPLE_ANSWER-frågetyper (bara om en konkret uppgift kräver det).

---

## Öppna frågor (för orkestreraren / läraren)

1. **Instruktionstext:** vill läraren ha långa skrivuppgiftsinstruktioner i appen, eller räcker en kort prompt + dokumentet bredvid? Avgör om `Question.instructions` behövs.
2. **Moment-gruppering:** accepterar vi att Claude håller reda på survey-ID-listan per moment i v1, eller vill läraren ha en `Moment`-entitet direkt?
3. **Summativt på papper eller digitalt?** Skrivs L6 i appen (lockMode) eller på papper? Påverkar om FREE_TEXT-summativt behöver byggas ut (t.ex. autospar finns redan via DraftResponse).
4. **AI-feedbackens auktoritet:** var går lärarens komfortgräns - AI-utkast på allt formativt, eller bara på enklare exit tickets?
5. **E/C/A-indikation i rapport:** vill läraren att Claude *föreslår* nivå på skrivsvar, eller bara beskriver kvalitet utan att gradera? (Agentskaps-/integritetsfråga.)
6. **GDPR/dataminimering:** rapporter med elevsvar genereras till `output/` - ska de raderas efter momentet? (DevilsAdvocate lyfte dataminimering.)

---

## Största risker

1. **Scope creep till LMS.** Frestelsen att lagra kriterier, lärandemål, moment-struktur, betyg i appen. Mottgift: håll appen som svarsinsamlare; låt Claude + dokument bära pedagogiken. Detta är den dominerande risken givet DevilsAdvocate-historiken.
2. **Att digitalisera det som inte ska digitaliseras.** Om EPA, jigsaw och muntligt seminarium pressas in i appen förlorar pedagogiken sin kärna och läraren slutar använda systemet. Klassificeringen i (a) är skyddsräcket.
3. **AI-feedback utan lärargrind.** Tyst auto-postad AI-feedback på summativa moment bryter mot agentskaps-principen och är pedagogiskt och rättssäkerhetsmässigt fel. Grindsteget är icke-förhandlingsbart.
4. **Rapport-överbyggnad.** En rapport med metrik som inte leder till handling blir det analytics-monster DevilsAdvocate varnar för. Varje rad ska motivera en lärarhandling.
5. **Manifestets bräcklighet.** Om pluginen genererar ogiltig JSON eller kriterier glider isär från det importerade, blir feedback/rapport fel. Mottgift: `import_moment` validerar (Zod, redan i mcp-server) och returnerar tydliga fel; manifestet refererar lärandemål via id.
6. **Survey-fragmentering.** Utan moment-gruppering kan surveys bli svåra att hitta för rapporten. V1-mottgift: Claude håller listan; senare en Moment-tabell.
7. **Dubbel källa till sanning för kriterier.** Kriterier i både `bedomningskriterier.md` och manifest -> divergens. Mottgift: manifestet är genererat FRÅN kriteriefilen av pluginen; kriteriefilen är master.
```
