import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const courseId = 1; // Historia 1b

  // Skapa ämnen
  const franska = await prisma.topic.create({
    data: { name: "Franska revolutionen", courseId },
  });
  const medeltiden = await prisma.topic.create({
    data: { name: "Medeltiden", courseId },
  });

  // --- Franska revolutionen (10 frågor) ---

  await prisma.question.create({
    data: {
      text: "Vilket år bröt Franska revolutionen ut?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "1776", isCorrect: false },
          { text: "1789", isCorrect: true },
          { text: "1799", isCorrect: false },
          { text: "1815", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad var Bastiljen och varför stormades den?",
      type: "FREE_TEXT",
      topicId: franska.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vilken samhällsgrupp tillhörde tredje ståndet?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "Adeln", isCorrect: false },
          { text: "Prästerskapet", isCorrect: false },
          { text: "Vanligt folk, borgare och bönder", isCorrect: true },
          { text: "Kungafamiljen", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad hette dokumentet som antogs 1789 och slog fast människors grundläggande rättigheter?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "Magna Carta", isCorrect: false },
          { text: "Förklaringen om människans och medborgarens rättigheter", isCorrect: true },
          { text: "Code Napoléon", isCorrect: false },
          { text: "Versaillesfördraget", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Förklara vad som menas med skräckväldet (la Terreur) under Franska revolutionen.",
      type: "FREE_TEXT",
      topicId: franska.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vem var Robespierre?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "Frankrikes kung under revolutionen", isCorrect: false },
          { text: "En ledande revolutionär bakom skräckväldet", isCorrect: true },
          { text: "En brittisk general som bekämpade Frankrike", isCorrect: false },
          { text: "Författaren av Code Napoléon", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vilket avrättningsredskap blev en symbol för Franska revolutionen?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "Giljotinen", isCorrect: true },
          { text: "Galgen", isCorrect: false },
          { text: "Bålet", isCorrect: false },
          { text: "Hjulet", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vilka orsaker låg bakom Franska revolutionen? Nämn minst tre.",
      type: "FREE_TEXT",
      topicId: franska.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad hände med kung Ludvig XVI?",
      type: "MULTIPLE_CHOICE",
      topicId: franska.id,
      options: {
        create: [
          { text: "Han flydde till England", isCorrect: false },
          { text: "Han abdikerade frivilligt", isCorrect: false },
          { text: "Han avrättades med giljotin 1793", isCorrect: true },
          { text: "Han styrde vidare som konstitutionell monark", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Hur påverkade Franska revolutionen resten av Europa? Ge exempel.",
      type: "FREE_TEXT",
      topicId: franska.id,
    },
  });

  // --- Medeltiden (10 frågor) ---

  await prisma.question.create({
    data: {
      text: "Vilken tidsperiod brukar man räkna som medeltiden?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "Ca 500–1500 e.Kr.", isCorrect: true },
          { text: "Ca 100–800 e.Kr.", isCorrect: false },
          { text: "Ca 1000–1800 e.Kr.", isCorrect: false },
          { text: "Ca 300–1200 e.Kr.", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad innebar feodalsamhället? Beskriv med egna ord.",
      type: "FREE_TEXT",
      topicId: medeltiden.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad kallas den epidemi som drabbade Europa på 1300-talet och dödade ungefär en tredjedel av befolkningen?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "Spanska sjukan", isCorrect: false },
          { text: "Digerdöden", isCorrect: true },
          { text: "Kolera", isCorrect: false },
          { text: "Lepra", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vilken religion dominerade i Europa under medeltiden?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "Islam", isCorrect: false },
          { text: "Kristendomen (katolska kyrkan)", isCorrect: true },
          { text: "Judendomen", isCorrect: false },
          { text: "Nordisk asatro", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Beskriv hur livet såg ut för en vanlig bonde under medeltiden.",
      type: "FREE_TEXT",
      topicId: medeltiden.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad var korstågen?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "Handelsresor till Kina", isCorrect: false },
          { text: "Militära expeditioner för att erövra det heliga landet", isCorrect: true },
          { text: "Vikingarnas plundringståg", isCorrect: false },
          { text: "Resor för att sprida vetenskap", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad var en riddare och vilken roll hade riddarna i det medeltida samhället?",
      type: "FREE_TEXT",
      topicId: medeltiden.id,
    },
  });

  await prisma.question.create({
    data: {
      text: "Vilken institution hade störst makt och inflytande i det medeltida Europa?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "Handelsgillena", isCorrect: false },
          { text: "Universiteten", isCorrect: false },
          { text: "Katolska kyrkan", isCorrect: true },
          { text: "Militären", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Vad var Hansaförbundet?",
      type: "MULTIPLE_CHOICE",
      topicId: medeltiden.id,
      options: {
        create: [
          { text: "En religiös orden", isCorrect: false },
          { text: "Ett handelsförbund mellan nordeuropeiska städer", isCorrect: true },
          { text: "En militärallians mot vikingarna", isCorrect: false },
          { text: "Ett kungligt råd i England", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Jämför medeltidens samhälle med dagens. Vilka är de största skillnaderna?",
      type: "FREE_TEXT",
      topicId: medeltiden.id,
    },
  });

  console.log("Historiefrågor skapade!");
  console.log(`  Franska revolutionen: 10 frågor (6 flerval + 4 fritext)`);
  console.log(`  Medeltiden: 10 frågor (6 flerval + 4 fritext)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
