import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeonHttp(connectionString);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find surveys with responses submitted today
  const newResponses = await prisma.response.findMany({
    where: { createdAt: { gte: today } },
    select: { surveyId: true },
    distinct: ["surveyId"],
  });

  if (newResponses.length === 0) {
    console.log(JSON.stringify({ newResponses: false }));
    await prisma.$disconnect();
    return;
  }

  const surveyIds = newResponses.map((r) => r.surveyId);

  const surveys = await prisma.survey.findMany({
    where: { id: { in: surveyIds } },
    include: {
      course: true,
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            include: {
              options: true,
              topic: true,
            },
          },
        },
      },
      responses: {
        include: {
          student: { select: { id: true, number: true } },
          answers: {
            include: {
              question: {
                include: { options: true, topic: true },
              },
            },
          },
        },
      },
    },
  });

  console.log(JSON.stringify({ newResponses: true, surveys }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
