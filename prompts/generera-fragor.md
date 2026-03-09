# Prompt: Generera frågor till frågebanken

Kopiera prompten nedan och klistra in i valfri AI (Claude, ChatGPT etc). Anpassa de markerade fälten.

---

## Prompten

```
Du är en erfaren svensk lärare och pedagog med djup kunskap om Blooms taxonomi och konstruktiv länkning. Din uppgift är att skapa högkvalitativa frågor för en digital frågebank som används i en enkät-/quizplattform för elever.

**Ämne/kurs:** [SKRIV ÄMNE HÄR, t.ex. "Historia 1b", "Matematik 7", "Biologi 1"]
**Ämnesområden (topics):** [SKRIV ÄMNESOMRÅDEN HÄR, t.ex. "Franska revolutionen, Medeltiden" eller "Bråk, Procent, Geometri"]
**Antal frågor per ämnesområde:** [SKRIV ANTAL, t.ex. 10]
**Fördelning:** [SKRIV FÖRDELNING, t.ex. "60% flerval, 40% fritext" eller "hälften av varje"]
**Målgrupp:** [SKRIV ÅRSKURS/NIVÅ, t.ex. "Årskurs 8", "Gymnasiet åk 1"]
**Svårighetsgrad:** [SKRIV NIVÅ, t.ex. "Blandad", "Grundläggande", "Avancerad"]
**Syfte:** [SKRIV SYFTE, t.ex. "Diagnostiskt test", "Formativ bedömning", "Summativ examination", "Kursutvärdering"]

### Regler för flervalsfrågor (MULTIPLE_CHOICE)
- Exakt 4 svarsalternativ, varav exakt 1 är korrekt
- Distraktorer (felaktiga alternativ) ska vara trovärdiga men tydligt felaktiga — de ska baseras på vanliga missuppfattningar eller typiska elevfel
- Undvik "alla ovanstående" eller "inget av ovanstående" som svarsalternativ
- Undvik negationer i frågeformuleringen (t.ex. "Vilket av följande är INTE...")
- Svarsalternativen ska vara ungefär lika långa — det korrekta svaret ska inte sticka ut
- Om svarsalternativen är numeriska, ordna dem i stigande eller fallande ordning
- Placera det korrekta svaret slumpmässigt bland alternativen (inte alltid samma position)

### Regler för fritextfrågor (FREE_TEXT)
- Frågan ska kräva resonemang, förklaring eller analys — inte bara ett enstaka ord eller en siffra
- Formulera frågan så att det är tydligt vad eleven förväntas svara (t.ex. "Förklara...", "Jämför...", "Ge två exempel på...")
- Anpassa komplexiteten till målgruppens nivå

### Allmänna riktlinjer
- Alla frågor ska vara på korrekt svenska och anpassade till angiven målgrupp
- Variera frågorna enligt Blooms taxonomi:
  - Kunskap/Minnas: fakta och definitioner
  - Förståelse: förklara med egna ord, ge exempel
  - Tillämpning: använda kunskap i nya situationer
  - Analys: jämföra, identifiera orsaker och samband
  - Syntes/Värdering: argumentera, ta ställning, bedöma
- Undvik tvetydiga formuleringar och dubbla negationer
- Frågor ska kunna besvaras utan tillgång till lärobok (ingen "leta i boken"-fråga)
- Variera frågeformuleringarna — undvik att alla frågor börjar med "Vad är..."

### CSV-format

Leverera resultatet som CSV med exakt dessa kolumnrubriker:

topic,type,text,option1,option2,option3,option4,correctAnswer

Formatregler:
- type ska vara MULTIPLE_CHOICE eller FREE_TEXT
- För FREE_TEXT: lämna option1–option4 och correctAnswer tomma
- För MULTIPLE_CHOICE: fyll i option1–option4 och sätt correctAnswer till exakt samma text som det korrekta alternativet
- Om en text innehåller kommatecken, omslut hela fältet med citattecken (")
- Om en text innehåller citattecken, dubbla dem ("")
- Använd UTF-8-kodning
- Ingen tom rad mellan raderna

Ge mig ENBART CSV-datan, utan förklaringar eller markdown-formatering.
```

---

## Färdiga promptexempel

### Exempel 1: Historia (gymnasiet)

```
Du är en erfaren svensk lärare och pedagog med djup kunskap om Blooms taxonomi och konstruktiv länkning. Din uppgift är att skapa högkvalitativa frågor för en digital frågebank som används i en enkät-/quizplattform för elever.

Ämne/kurs: Historia 1b
Ämnesområden (topics): Franska revolutionen, Industriella revolutionen
Antal frågor per ämnesområde: 8
Fördelning: 60% flerval, 40% fritext
Målgrupp: Gymnasiet åk 1
Svårighetsgrad: Blandad
Syfte: Formativ bedömning

[Resten av prompten ovan...]
```

### Exempel 2: Matematik (högstadiet)

```
Du är en erfaren svensk lärare och pedagog med djup kunskap om Blooms taxonomi och konstruktiv länkning. Din uppgift är att skapa högkvalitativa frågor för en digital frågebank som används i en enkät-/quizplattform för elever.

Ämne/kurs: Matematik 8
Ämnesområden (topics): Bråk och procent, Geometri, Algebra
Antal frågor per ämnesområde: 10
Fördelning: 70% flerval, 30% fritext
Målgrupp: Årskurs 8
Svårighetsgrad: Grundläggande till medel
Syfte: Diagnostiskt test

[Resten av prompten ovan...]
```

### Exempel 3: Kursutvärdering

```
Du är en erfaren svensk lärare och pedagog. Din uppgift är att skapa frågor för en kursutvärdering i en digital enkätplattform.

Ämne/kurs: Valfri kurs
Ämnesområden (topics): Undervisning, Kursinnehåll, Arbetsmiljö
Antal frågor per ämnesområde: 5
Fördelning: 40% flerval, 60% fritext
Målgrupp: Gymnasiet
Svårighetsgrad: Ej tillämpbart
Syfte: Kursutvärdering

[Resten av prompten ovan...]
```

---

## Exempel på förväntad CSV-output

```csv
topic,type,text,option1,option2,option3,option4,correctAnswer
Franska revolutionen,MULTIPLE_CHOICE,Vilket år bröt Franska revolutionen ut?,1776,1789,1799,1815,1789
Franska revolutionen,MULTIPLE_CHOICE,"Vad hette den förklaring om mänskliga rättigheter som antogs 1789?","Bill of Rights","Magna Carta","Deklarationen om människans och medborgarens rättigheter","FN:s deklaration om de mänskliga rättigheterna","Deklarationen om människans och medborgarens rättigheter"
Franska revolutionen,FREE_TEXT,"Förklara vad som menas med skräckväldet (la Terreur) och vilka konsekvenser det fick.",,,,,
Franska revolutionen,FREE_TEXT,"Jämför orsakerna till den amerikanska och den franska revolutionen. Vilka likheter och skillnader kan du identifiera?",,,,,
Medeltiden,MULTIPLE_CHOICE,"Vad kallas den epidemi som drabbade Europa på 1300-talet?",Spanska sjukan,Digerdöden,Kolera,Lepra,Digerdöden
Medeltiden,FREE_TEXT,"Beskriv hur det feodala samhället var uppbyggt och förklara vilken roll de olika stånden hade.",,,,,
```

---

## Så importerar du i appen

1. Kopiera hela CSV-outputen från AI:n
2. Gå till en kurs i admin → Frågebank → Importera CSV
3. Klistra in CSV-texten och klicka Importera

Ämnesområden (topics) skapas automatiskt om de inte redan finns i kursen.

## Tips för bästa resultat

- **Var specifik med ämnesområden** — "Franska revolutionen" ger bättre frågor än bara "Historia"
- **Generera i omgångar** — det är bättre att köra prompten flera gånger med 5–10 frågor per ämnesområde än att begära 50 frågor på en gång
- **Granska alltid frågorna** — AI kan ibland generera felaktiga fakta, dubbletter eller olämpliga frågor
- **Anpassa svårighetsgraden** — ange t.ex. "60% grundläggande, 30% medel, 10% avancerad" för blandad nivå
- **Testa CSV-importen** — kör en liten batch först för att verifiera att formatet stämmer
