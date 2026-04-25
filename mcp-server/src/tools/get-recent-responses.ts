import { prisma } from "../prisma.js";

export async function getRecentResponses(
  days: number,
  courseId?: number
): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const responses = await prisma.response.findMany({
    where: {
      createdAt: { gte: since },
      ...(courseId !== undefined ? { survey: { courseId } } : {}),
    },
    include: {
      student: true,
      survey: { include: { course: true } },
      answers: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (responses.length === 0) {
    return JSON.stringify(
      {
        since: since.toISOString(),
        days,
        courseId: courseId ?? null,
        totalResponses: 0,
        surveys: [],
        message: `Inga svar har kommit in de senaste ${days} ${days === 1 ? "dygnet" : "dygnen"}${courseId !== undefined ? ` i kurs ${courseId}` : ""}.`,
      },
      null,
      2
    );
  }

  const bySurveyId = new Map<
    number,
    {
      surveyId: number;
      title: string;
      courseId: number;
      courseName: string;
      mode: string;
      responseCount: number;
      latestAnsweredAt: string;
      responses: Array<{
        studentNumber: number;
        answeredAt: string;
        score: { correct: number; total: number; percentage: number } | null;
      }>;
    }
  >();

  for (const r of responses) {
    const isQuiz = r.survey.mode === "QUIZ";
    const correct = r.answers.filter((a) => a.isCorrect === true).length;
    const total = r.answers.filter((a) => a.isCorrect !== null).length;
    const score = isQuiz
      ? {
          correct,
          total,
          percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
        }
      : null;

    const answeredAt = r.createdAt.toISOString();
    const entry = bySurveyId.get(r.surveyId);

    if (entry) {
      entry.responseCount += 1;
      entry.responses.push({
        studentNumber: r.student.number,
        answeredAt,
        score,
      });
      if (answeredAt > entry.latestAnsweredAt) {
        entry.latestAnsweredAt = answeredAt;
      }
    } else {
      bySurveyId.set(r.surveyId, {
        surveyId: r.surveyId,
        title: r.survey.title,
        courseId: r.survey.courseId,
        courseName: r.survey.course.name,
        mode: r.survey.mode,
        responseCount: 1,
        latestAnsweredAt: answeredAt,
        responses: [
          {
            studentNumber: r.student.number,
            answeredAt,
            score,
          },
        ],
      });
    }
  }

  const surveys = Array.from(bySurveyId.values()).sort((a, b) =>
    a.latestAnsweredAt < b.latestAnsweredAt ? 1 : -1
  );

  return JSON.stringify(
    {
      since: since.toISOString(),
      days,
      courseId: courseId ?? null,
      totalResponses: responses.length,
      surveys,
    },
    null,
    2
  );
}
