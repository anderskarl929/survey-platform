import { prisma } from "../prisma.js";

export async function listTopics(courseId: number): Promise<string> {
  const topics = await prisma.topic.findMany({
    where: { courseId },
    include: { _count: { select: { questions: true } } },
    orderBy: { name: "asc" },
  });

  return JSON.stringify(
    topics.map((t) => ({
      id: t.id,
      name: t.name,
      questionCount: t._count.questions,
    })),
    null,
    2
  );
}
