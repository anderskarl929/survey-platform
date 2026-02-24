import { prisma } from "../prisma.js";
import { nanoid } from "nanoid";

export async function createSurvey(
  courseId: number,
  title: string,
  questionIds: number[],
  description?: string
): Promise<string> {
  const shareCode = nanoid(8);

  const survey = await prisma.survey.create({
    data: {
      title,
      description: description || "",
      shareCode,
      courseId,
      questions: {
        create: questionIds.map((qId, index) => ({
          questionId: qId,
          order: index,
        })),
      },
    },
  });

  return JSON.stringify({
    id: survey.id,
    title: survey.title,
    shareCode,
    questionCount: questionIds.length,
    url: `/s/${shareCode}`,
  }, null, 2);
}
