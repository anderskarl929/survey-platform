import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

function escCsv(val: unknown): string {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

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
        include: { question: true },
        orderBy: { order: "asc" },
      },
      responses: {
        include: { student: true, answers: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!survey) {
    return new Response("Enkät hittades inte", { status: 404 });
  }

  const questions = survey.questions.map((sq) => sq.question);

  // CSV header
  const headers = [
    "Elevnummer",
    "Tidpunkt",
    ...questions.map((q) => q.text),
  ];

  // CSV rows
  const rows = survey.responses.map((r) => {
    const answerMap = new Map(
      r.answers.map((a) => [a.questionId, a.value])
    );
    return [
      r.student.number,
      r.createdAt.toISOString(),
      ...questions.map((q) => answerMap.get(q.id) || ""),
    ];
  });

  const csvContent = [
    headers.map(escCsv).join(","),
    ...rows.map((row) => row.map(escCsv).join(",")),
  ].join("\n");

  // BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF";

  return new Response(bom + csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enkat-${survey.id}-resultat.csv"`,
    },
  });
}
