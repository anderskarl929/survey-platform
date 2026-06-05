import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeonHttp(connectionString);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newResponses = await prisma.response.findMany({
    where: { createdAt: { gte: today } },
    include: {
      survey: { include: { course: true } },
      student: true,
    },
  });

  if (newResponses.length === 0) {
    console.log(JSON.stringify({ newResponses: false }));
    await prisma.$disconnect();
    return;
  }

  const surveyIds = [...new Set(newResponses.map((r) => r.surveyId))];

  const fullData = await Promise.all(
    surveyIds.map(async (surveyId) => {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: {
          course: true,
          questions: { orderBy: { order: "asc" } },
        },
      });

      const responses = await prisma.response.findMany({
        where: { surveyId, createdAt: { gte: today } },
        include: {
          student: true,
          answers: {
            include: { question: true },
          },
        },
      });

      return { survey, responses };
    })
  );

  console.log(JSON.stringify({ newResponses: true, data: fullData }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
