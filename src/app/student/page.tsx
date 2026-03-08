import { getStudentSession } from "@/lib/student-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateMastery, ResponseRecord } from "@/lib/mastery";
import Link from "next/link";

export default async function StudentDashboard() {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  const { studentId, courseId } = session;

  const [course, surveys] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.survey.findMany({
      where: { courseId, mode: "QUIZ" },
      include: { questions: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!course) redirect("/login");

  const surveyIds = surveys.map((s) => s.id);

  const responses = await prisma.response.findMany({
    where: { studentId, surveyId: { in: surveyIds } },
    include: { answers: true },
    orderBy: { createdAt: "asc" },
  });

  const allRecords: ResponseRecord[] = responses.flatMap((r) =>
    r.answers.map((a) => ({
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      createdAt: r.createdAt,
    }))
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{course.name}</h2>
        <p className="text-sm text-gray-500">Kurskod: {course.code}</p>
      </div>

      <div className="mb-4">
        <Link
          href="/student/results"
          className="text-sm text-blue-600 hover:underline"
        >
          Visa alla mina resultat &rarr;
        </Link>
      </div>

      {surveys.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Inga quiz tillgängliga ännu.
        </p>
      ) : (
        <div className="space-y-4">
          {surveys.map((survey) => {
            const questionIds = survey.questions.map((sq) => sq.questionId);
            const { masteredIds, remainingIds } = calculateMastery(
              questionIds,
              allRecords
            );
            const hasResponded = responses.some((r) => r.surveyId === survey.id);
            const allMastered =
              remainingIds.length === 0 && questionIds.length > 0;
            const masteryPercent =
              questionIds.length > 0
                ? Math.round((masteredIds.length / questionIds.length) * 100)
                : 0;

            return (
              <div key={survey.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {survey.title}
                    </h3>
                    {survey.description && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {survey.description}
                      </p>
                    )}
                  </div>
                  {allMastered && (
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                      Klar ✓
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>
                      {masteredIds.length} / {questionIds.length} frågor klarade
                    </span>
                    <span>{masteryPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${masteryPercent}%` }}
                    />
                  </div>
                </div>

                {!allMastered && (
                  <Link
                    href={`/student/quiz/${survey.id}`}
                    className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    {hasResponded ? "Öva igen" : "Starta"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
