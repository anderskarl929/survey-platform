# Prompt: Generera frågor till frågebanken

Kopiera prompten nedan och klistra in i valfri AI (Claude, ChatGPT etc). Anpassa de markerade fälten.

---

## Prompten

```
Du är en erfaren svensk lärare. Skapa frågor för en digital frågebank som används i en enkät-/quizplattform för elever.

**Ämne/kurs:** [SKRIV ÄMNE HÄR, t.ex. "Historia 1b", "Matematik 7", "Biologi 1"]
**Ämnesområden (topics):** [SKRIV ÄMNESOMRÅDEN HÄR, t.ex. "Franska revolutionen, Medeltiden" eller "Bråk, Procent, Geometri"]
**Antal frågor per ämnesområde:** [SKRIV ANTAL, t.ex. 10]
**Fördelning:** [SKRIV FÖRDELNING, t.ex. "60% flerval, 40% fritext" eller "hälften av varje"]
**Målgrupp:** [SKRIV ÅRSKURS/NIVÅ, t.ex. "Årskurs 8", "Gymnasiet åk 1"]
**Svårighetsgrad:** [SKRIV NIVÅ, t.ex. "Blandad", "Grundläggande", "Avancerad"]

Regler för frågorna:
- Flervalsfrågor ska ha exakt 4 svarsalternativ, varav exakt 1 är korrekt
- Distraktorer (felaktiga alternativ) ska vara trovärdiga men tydligt felaktiga
- Fritext-frågor ska kräva resonemang eller förklaring, inte bara ett enskilt ord
- Alla frågor ska vara på svenska och anpassade till angiven målgrupp
- Variera frågorna: fakta, förståelse, analys och tillämpning (Blooms taxonomi)

Leverera resultatet som CSV med exakt dessa kolumnrubriker:

topic,type,text,option1,option2,option3,option4,correctAnswer

Regler för CSV-formatet:
- type ska vara MULTIPLE_CHOICE eller FREE_TEXT
- För FREE_TEXT: lämna option1–option4 och correctAnswer tomma
- För MULTIPLE_CHOICE: fyll i option1–option4 och sätt correctAnswer till exakt samma text som det korrekta alternativet
- Om en text innehåller kommatecken, omslut hela fältet med citattecken
- Använd UTF-8-kodning

Ge mig ENBART CSV-datan, utan förklaringar eller markdown-formatering.
```

---

## Exempel på output

```csv
topic,type,text,option1,option2,option3,option4,correctAnswer
Franska revolutionen,MULTIPLE_CHOICE,Vilket år bröt Franska revolutionen ut?,1776,1789,1799,1815,1789
Franska revolutionen,FREE_TEXT,"Förklara vad som menas med skräckväldet (la Terreur) under Franska revolutionen.",,,,,
Medeltiden,MULTIPLE_CHOICE,"Vad kallas den epidemi som drabbade Europa på 1300-talet?",Spanska sjukan,Digerdöden,Kolera,Lepra,Digerdöden
Medeltiden,FREE_TEXT,Beskriv hur livet såg ut för en vanlig bonde under medeltiden.,,,,,
```

---

## Så importerar du i appen

1. Kopiera hela CSV-outputen från AI:n
2. Gå till en kurs i admin → Frågebank → Importera CSV
3. Klistra in CSV-texten och klicka Importera

Ämnesområden (topics) skapas automatiskt om de inte redan finns i kursen.
