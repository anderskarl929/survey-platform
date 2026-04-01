import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  const surveyMap = new Map<number, { surveyId: number; surveyTitle: string; mode: string; courseId: number; courseName: string; studentNumbers: number[] }>();
  for (const r of newResponses) {
    if (!surveyMap.has(r.surveyId)) {
      surveyMap.set(r.surveyId, {
        surveyId: r.surveyId,
        surveyTitle: r.survey.title,
        mode: r.survey.mode,
        courseId: r.survey.courseId,
        courseName: r.survey.course.name,
        studentNumbers: [],
      });
    }
    surveyMap.get(r.surveyId)!.studentNumbers.push(r.student.number);
  }

  console.log(
    JSON.stringify({
      newResponses: true,
      count: newResponses.length,
      surveys: Array.from(surveyMap.values()),
    }, null, 2)
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
