import { prisma } from "../prisma.js";

export async function listCourses(): Promise<string> {
  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { topics: true, surveys: true, students: true } },
    },
    orderBy: { name: "asc" },
  });

  return JSON.stringify(
    courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      topicCount: c._count.topics,
      surveyCount: c._count.surveys,
      studentCount: c._count.students,
    })),
    null,
    2
  );
}
