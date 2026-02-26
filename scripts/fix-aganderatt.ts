import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find and fix any remaining broken characters (replacement char U+FFFD or similar)
  const allOptions = await prisma.questionOption.findMany();
  for (const o of allOptions) {
    if (o.text.includes("\uFFFD") || o.text.includes("�")) {
      // Likely "Äganderätten" that got corrupted
      console.log(`Broken option ${o.id}: "${o.text}"`);
      const fixed = o.text.replace(/[\uFFFD�]/g, "Ä");
      console.log(`  → "${fixed}"`);
      await prisma.questionOption.update({ where: { id: o.id }, data: { text: fixed } });
    }
  }

  const allQuestions = await prisma.question.findMany();
  for (const q of allQuestions) {
    if (q.text.includes("\uFFFD") || q.text.includes("�")) {
      console.log(`Broken question ${q.id}: "${q.text}"`);
      const fixed = q.text.replace(/[\uFFFD�]/g, "Ä");
      console.log(`  → "${fixed}"`);
      await prisma.question.update({ where: { id: q.id }, data: { text: fixed } });
    }
  }

  console.log("Klart!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
