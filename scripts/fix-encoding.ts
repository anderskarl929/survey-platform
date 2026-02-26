import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Fixes double-encoded UTF-8 strings.
 * Pattern: UTF-8 bytes were interpreted as Latin-1, then stored as UTF-8.
 * E.g. "ö" (C3 B6) → "Ã¶" (C3 83 C2 B6)
 */
function fixEncoding(text: string): string {
  try {
    // Convert each char to its Latin-1 byte value, then decode as UTF-8
    const bytes = new Uint8Array(
      [...text].map((c) => c.charCodeAt(0))
    );
    const decoded = new TextDecoder("utf-8").decode(bytes);

    // If the decoded version has fewer multi-byte artifacts, it's fixed
    if (decoded.includes("Ã") || decoded === text) return text;
    return decoded;
  } catch {
    return text; // If decode fails, return original
  }
}

function isDoubleEncoded(text: string): boolean {
  // Common patterns for double-encoded Swedish UTF-8
  return /Ã¶|Ã¤|Ã¥|Ã©|Ã¼|Ã–|Ã„|Ã…/.test(text);
}

async function main() {
  console.log("Söker efter dubbelkodade texter...\n");

  // Fix questions
  const questions = await prisma.question.findMany();
  let fixedQuestions = 0;
  for (const q of questions) {
    if (isDoubleEncoded(q.text)) {
      const fixed = fixEncoding(q.text);
      console.log(`  Fråga ${q.id}: "${q.text.slice(0, 50)}..." → "${fixed.slice(0, 50)}..."`);
      await prisma.question.update({ where: { id: q.id }, data: { text: fixed } });
      fixedQuestions++;
    }
  }

  // Fix question options
  const options = await prisma.questionOption.findMany();
  let fixedOptions = 0;
  for (const o of options) {
    if (isDoubleEncoded(o.text)) {
      const fixed = fixEncoding(o.text);
      console.log(`  Alternativ ${o.id}: "${o.text.slice(0, 50)}..." → "${fixed.slice(0, 50)}..."`);
      await prisma.questionOption.update({ where: { id: o.id }, data: { text: fixed } });
      fixedOptions++;
    }
  }

  // Fix topics
  const topics = await prisma.topic.findMany();
  let fixedTopics = 0;
  for (const t of topics) {
    if (isDoubleEncoded(t.name)) {
      const fixed = fixEncoding(t.name);
      console.log(`  Ämne ${t.id}: "${t.name}" → "${fixed}"`);
      await prisma.topic.update({ where: { id: t.id }, data: { name: fixed } });
      fixedTopics++;
    }
  }

  // Fix survey titles/descriptions
  const surveys = await prisma.survey.findMany();
  let fixedSurveys = 0;
  for (const s of surveys) {
    const fixedTitle = isDoubleEncoded(s.title) ? fixEncoding(s.title) : s.title;
    const fixedDesc = isDoubleEncoded(s.description) ? fixEncoding(s.description) : s.description;
    if (fixedTitle !== s.title || fixedDesc !== s.description) {
      console.log(`  Enkät ${s.id}: "${s.title}" → "${fixedTitle}"`);
      await prisma.survey.update({ where: { id: s.id }, data: { title: fixedTitle, description: fixedDesc } });
      fixedSurveys++;
    }
  }

  console.log(`\nKlart!`);
  console.log(`  Frågor fixade: ${fixedQuestions}`);
  console.log(`  Alternativ fixade: ${fixedOptions}`);
  console.log(`  Ämnen fixade: ${fixedTopics}`);
  console.log(`  Enkäter fixade: ${fixedSurveys}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
