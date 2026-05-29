# Testmoment: Demokrati

Litet testmoment for att prova hela kedjan planera-moment -> survey-platform
efter omstart av Claude Code. 2 lektioner + 1 momentquiz, enligt
namnkonventionen i `frageappen.md`.

| Fil | Quiz-titel | Antal fragor |
|-----|-----------|--------------|
| `lektion-1.csv` | Demokrati - Lektion 1: Demokratins grundprinciper | 5 |
| `lektion-2.csv` | Demokrati - Lektion 2: Demokrati och diktatur | 5 |
| `momentquiz.csv` | Demokrati - Momentquiz | 4 |

## Sa testar du (efter omstart)

1. Kontrollera att MCP-verktygen finns: fraga "vilka survey-platform-verktyg har du?"
   Du ska se bl.a. `create_quiz_from_csv`.

2. Valj en testkurs. Lista dem via resursen `survey://courses` (t.ex.
   "Ratten och Samhallet"). Notera dess `course_id`.

3. Be Claude kora ett `create_quiz_from_csv`-anrop per fil, t.ex.:
   > "Las test-moment/lektion-1.csv och kor create_quiz_from_csv mot kurs <ID>
   >  med titel 'Demokrati - Lektion 1: Demokratins grundprinciper' och mode QUIZ."

   Upprepa for lektion-2.csv och momentquiz.csv (titel 'Demokrati - Momentquiz').

4. Varje anrop returnerar en `shareCode` + `url` (`/s/<kod>`). Oppna den i
   appen for att se quizzen, eller logga in som elev och svara.

## Stadning efterat

Testdatan hamnar i den valda kursen under topics som borjar med "Demokrati - ".
For att ta bort: be Claude radera de skapade quizzen och topics, eller kor ett
litet stadscript likt `mcp-server/scripts/test-roundtrip.mjs`.

> Tips: vill du prova HELA plugin-floodet i stallet for enskilda anrop -
> kor `/planera-moment` och beskriv ett kort moment; steg 5b anvander samma verktyg.
