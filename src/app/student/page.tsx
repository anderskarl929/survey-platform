import { getStudentSession } from "@/lib/student-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateMastery, ResponseRecord } from "@/lib/mastery";
import Link from "next/link";
import FlaggedQuestionsList from "@/components/FlaggedQuestionsList";

export default async function StudentDashboard() {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  const { studentId, courseId } = session;

  const [course, surveys, flaggedQuestions, drafts] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.survey.findMany({
      where: { courseId },
      include: { questions: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.flaggedQuestion.findMany({
      where: { studentId },
      include: {
        question: {
          include: {
            topic: true,
            options: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.draftResponse.findMany({
      where: { studentId },
      select: { surveyId: true, updatedAt: true },
    }),
  ]);

  const draftBySurvey = new Map(drafts.map((d) => [d.surveyId, d.updatedAt]));

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

  const flaggedData = flaggedQuestions.map((fq) => ({
    questionId: fq.questionId,
    text: fq.question.text,
    type: fq.question.type,
    topicName: fq.question.topic.name,
    options: fq.question.options.map((o) => o.text),
    correctAnswer:
      fq.question.options.find((o) => o.isCorrect)?.text ?? null,
  }));

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

      {/* Flagged questions section */}
      {flaggedData.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            🚩 Frågor att öva på
            <span className="text-sm font-normal text-gray-500">
              ({flaggedData.length})
            </span>
          </h3>
          <FlaggedQuestionsList questions={flaggedData} />
        </div>
      )}

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
            const hasDraft = draftBySurvey.has(survey.id);
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
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/student/quiz/${survey.id}`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      {hasDraft ? "Fortsätt" : hasResponded ? "Öva igen" : "Starta"}
                    </Link>
                    {hasDraft && (
                      <span className="text-xs text-amber-600">
                        Sparat utkast
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
