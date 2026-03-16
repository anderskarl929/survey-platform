import { getStudentSession } from "@/lib/student-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FeedbackButton from "@/components/FeedbackButton";

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId: responseIdStr } = await params;
  const responseId = Number(responseIdStr);

  const session = await getStudentSession();
  if (!session) redirect("/login");

  const response = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      survey: true,
      answers: {
        include: {
          question: { include: { options: true } },
        },
      },
    },
  });

  if (!response || response.studentId !== session.studentId) {
    redirect("/student/results");
  }

  const isQuiz = response.survey.mode === "QUIZ";
  const correctCount = response.answers.filter(
    (a) => a.isCorrect === true
  ).length;
  const totalGraded = response.answers.filter(
    (a) => a.isCorrect !== null
  ).length;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/student/results"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Tillbaka till resultat
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {response.survey.title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Besvarad {response.createdAt.toLocaleDateString("sv-SE")}
        </p>
        {isQuiz && totalGraded > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${
                Math.round((correctCount / totalGraded) * 100) >= 80
                  ? "text-green-600"
                  : Math.round((correctCount / totalGraded) * 100) >= 50
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {correctCount}/{totalGraded} rätt
            </span>
            <span className="text-sm text-gray-500">
              ({Math.round((correctCount / totalGraded) * 100)}%)
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {response.answers.map((answer, idx) => {
          const correctOption = answer.question.options.find(
            (o) => o.isCorrect
          );
          const isCorrect = answer.isCorrect === true;
          const isWrong = answer.isCorrect === false;
          const isFreeText = answer.question.type === "FREE_TEXT";

          return (
            <div
              key={answer.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                isCorrect
                  ? "border-green-500"
                  : isWrong
                    ? "border-red-500"
                    : "border-gray-200"
              }`}
            >
              <p className="font-medium text-gray-900 mb-2">
                {idx + 1}. {answer.question.text}
              </p>

              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-500">Ditt svar: </span>
                  <span
                    className={`font-medium ${
                      isCorrect
                        ? "text-green-700"
                        : isWrong
                          ? "text-red-700"
                          : "text-gray-900"
                    }`}
                  >
                    {answer.value}
                  </span>
                </p>
                {isWrong && correctOption && (
                  <p>
                    <span className="text-gray-500">Rätt svar: </span>
                    <span className="font-medium text-green-700">
                      {correctOption.text}
                    </span>
                  </p>
                )}
              </div>

              {isFreeText && (
                <FeedbackButton
                  answerId={answer.id}
                  initialFeedback={answer.feedback}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
