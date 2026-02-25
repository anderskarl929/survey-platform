import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = Number(id);
  if (isNaN(surveyId)) {
    return NextResponse.json({ error: "Ogiltigt enkät-ID" }, { status: 400 });
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        include: {
          question: { include: { options: true } },
        },
        orderBy: { order: "asc" },
      },
      responses: {
        include: { answers: true },
      },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "Enkät hittades inte" }, { status: 404 });
  }

  const questions = survey.questions.map((sq) => {
    const q = sq.question;
    const questionAnswers = survey.responses.flatMap((r) =>
      r.answers.filter((a) => a.questionId === q.id)
    );

    if (q.type === "MULTIPLE_CHOICE") {
      const optionCounts: Record<string, number> = {};
      q.options.forEach((o) => (optionCounts[o.text] = 0));
      questionAnswers.forEach((a) => {
        optionCounts[a.value] = (optionCounts[a.value] || 0) + 1;
      });
      return { id: q.id, text: q.text, type: q.type, optionCounts };
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      textResponses: questionAnswers.map((a) => a.value),
    };
  });

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      responseCount: survey.responses.length,
    },
    questions,
  });
}
