import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; number: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { courseId, number } = await params;
  const cId = Number(courseId);
  const studentNumber = Number(number);
  if (isNaN(cId) || isNaN(studentNumber)) {
    return NextResponse.json({ error: "Ogiltigt ID" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { courseId_number: { courseId: cId, number: studentNumber } },
  });

  if (!student) {
    return NextResponse.json({ error: "Eleven hittades inte" }, { status: 404 });
  }

  const responses = await prisma.response.findMany({
    where: { studentId: student.id },
    include: {
      survey: { select: { id: true, title: true, mode: true } },
      answers: {
        include: {
          question: { select: { id: true, text: true, type: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const surveys = responses.map((r) => {
    const correctCount = r.answers.filter((a) => a.isCorrect === true).length;
    const totalQuestions = r.answers.length;
    return {
      surveyId: r.survey.id,
      surveyTitle: r.survey.title,
      mode: r.survey.mode,
      respondedAt: r.createdAt,
      score: r.survey.mode === "QUIZ" ? { correct: correctCount, total: totalQuestions } : null,
      answers: r.answers.map((a) => ({
        questionId: a.question.id,
        questionText: a.question.text,
        questionType: a.question.type,
        value: a.value,
        isCorrect: a.isCorrect,
      })),
    };
  });

  return NextResponse.json({ studentNumber, surveys });
}
