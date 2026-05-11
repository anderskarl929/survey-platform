import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

interface FeedbackItem {
  student_number: number;
  feedback: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id, questionId } = await params;
  const surveyId = Number(id);
  const qId = Number(questionId);
  if (isNaN(surveyId) || isNaN(qId)) {
    return NextResponse.json(
      { error: "Ogiltigt enkät-ID eller fråge-ID" },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    feedbacks?: FeedbackItem[];
  } | null;

  if (!body || !Array.isArray(body.feedbacks) || body.feedbacks.length === 0) {
    return NextResponse.json(
      { error: "Body måste innehålla feedbacks-array med minst ett element" },
      { status: 400 }
    );
  }

  for (const item of body.feedbacks) {
    if (
      typeof item?.student_number !== "number" ||
      typeof item?.feedback !== "string" ||
      item.feedback.length === 0
    ) {
      return NextResponse.json(
        { error: "Varje feedback-objekt kräver student_number (nummer) och feedback (sträng)" },
        { status: 400 }
      );
    }
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      responses: {
        include: {
          student: true,
          answers: { where: { questionId: qId } },
        },
      },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "Enkät hittades inte" }, { status: 404 });
  }

  let updated = 0;
  let skipped = 0;

  for (const item of body.feedbacks) {
    const response = survey.responses.find(
      (r) => r.student.number === item.student_number && r.answers.length > 0
    );
    if (!response) {
      skipped++;
      continue;
    }

    const answer = response.answers[0];
    await prisma.answer.update({
      where: { id: answer.id },
      data: { feedback: item.feedback },
    });
    updated++;
  }

  return NextResponse.json({
    success: true,
    updated,
    skipped,
    message: `Feedback sparad för ${updated} svar${
      skipped > 0 ? `, ${skipped} hoppade över (elev ej hittad)` : ""
    }`,
  });
}
