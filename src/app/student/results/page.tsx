import { getStudentSession } from "@/lib/student-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudentResultsPage() {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  const responses = await prisma.response.findMany({
    where: { studentId: session.studentId },
    include: {
      survey: { select: { id: true, title: true, mode: true } },
      answers: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const results = responses.map((r) => {
    const correctCount = r.answers.filter((a) => a.isCorrect === true).length;
    const totalGraded = r.answers.filter((a) => a.isCorrect !== null).length;
    return {
      responseId: r.id,
      surveyTitle: r.survey.title,
      mode: r.survey.mode,
      respondedAt: r.createdAt,
      score:
        r.survey.mode === "QUIZ"
          ? {
              correct: correctCount,
              total: totalGraded,
              percentage:
                totalGraded > 0
                  ? Math.round((correctCount / totalGraded) * 100)
                  : 0,
            }
          : null,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <Link href="/student" className="text-sm text-blue-600 hover:underline">
          &larr; Tillbaka till dashboard
        </Link>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Mina resultat</h2>

      {results.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Du har inte svarat på några enkäter ännu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.responseId}
              href={`/student/results/${r.responseId}`}
              className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {r.surveyTitle}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.respondedAt.toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.mode === "QUIZ" && r.score && (
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold ${
                          r.score.percentage >= 80
                            ? "text-green-600"
                            : r.score.percentage >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {r.score.correct}/{r.score.total}
                      </span>
                      <p className="text-xs text-gray-500">
                        {r.score.percentage}% rätt
                      </p>
                    </div>
                  )}
                  {r.mode === "SURVEY" && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Enkät
                    </span>
                  )}
                  <span className="text-gray-400">&rsaquo;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
