import { prisma } from "../prisma.js";

export async function getResults(surveyId: number): Promise<string> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        include: { question: { include: { options: true } } },
        orderBy: { order: "asc" },
      },
      responses: { include: { student: true, answers: true } },
    },
  });

  if (!survey) return JSON.stringify({ error: "Enkät hittades inte" });

  const isQuiz = survey.mode === "QUIZ";

  const questions = survey.questions.map((sq) => {
    const q = sq.question;
    const correctOption = q.options.find((o) => o.isCorrect);
    const answersWithStudent = survey.responses.flatMap((r) =>
      r.answers
        .filter((a) => a.questionId === q.id)
        .map((a) => ({ value: a.value, studentNumber: r.student.number, isCorrect: a.isCorrect }))
    );

    if (q.type === "MULTIPLE_CHOICE") {
      const optionCounts: Record<string, number> = {};
      q.options.forEach((o) => (optionCounts[o.text] = 0));
      answersWithStudent.forEach((a) => {
        optionCounts[a.value] = (optionCounts[a.value] || 0) + 1;
      });
      return {
        id: q.id, text: q.text, type: q.type, optionCounts,
        correctAnswer: isQuiz ? correctOption?.text || null : null,
        studentAnswers: answersWithStudent.map((a) => ({
          studentNumber: a.studentNumber, value: a.value, isCorrect: a.isCorrect,
        })),
      };
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      textResponses: answersWithStudent.map((a) => a.value),
      studentAnswers: answersWithStudent.map((a) => ({
        studentNumber: a.studentNumber, value: a.value,
      })),
    };
  });

  return JSON.stringify({
    survey: {
      id: survey.id,
      title: survey.title,
      mode: survey.mode,
      responseCount: survey.responses.length,
    },
    questions,
  }, null, 2);
}
