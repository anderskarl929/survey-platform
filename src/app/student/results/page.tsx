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
    <div className="animate-fade-in">
      <div className="mb-4">
        <Link href="/student" className="text-sm text-primary font-medium hover:underline">
          &larr; Tillbaka till dashboard
        </Link>
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-4">Mina resultat</h2>

      {results.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted">Du har inte svarat på några enkäter ännu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.responseId}
              href={`/student/results/${r.responseId}`}
              className="block card card-hover p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold tracking-tight">
                    {r.surveyTitle}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {r.respondedAt.toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.mode === "QUIZ" && r.score && (
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold ${
                          r.score.percentage >= 80
                            ? "text-success"
                            : r.score.percentage >= 50
                              ? "text-warning"
                              : "text-error"
                        }`}
                      >
                        {r.score.correct}/{r.score.total}
                      </span>
                      <p className="text-xs text-muted">
                        {r.score.percentage}% rätt
                      </p>
                    </div>
                  )}
                  {r.mode === "SURVEY" && (
                    <span className="badge bg-surface-muted text-muted">
                      Enkät
                    </span>
                  )}
                  <span className="text-muted-light">&rsaquo;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
