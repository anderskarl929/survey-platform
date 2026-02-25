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
        include: { question: { include: { options: true } } },
        orderBy: { order: "asc" },
      },
      _count: { select: { responses: true } },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "Enkät hittades inte" }, { status: 404 });
  }

  return NextResponse.json(survey);
}
