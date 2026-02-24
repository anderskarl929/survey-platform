import { prisma } from "../prisma.js";

export async function getQuestionsByTopic(topicId: number): Promise<string> {
  const questions = await prisma.question.findMany({
    where: { topicId },
    include: { options: true, topic: true },
    orderBy: { id: "asc" },
  });

  return JSON.stringify(
    questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      topic: q.topic.name,
      options: q.options.map((o) => o.text),
    })),
    null,
    2
  );
}
