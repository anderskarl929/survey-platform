import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShareCode } from "@/lib/share-code";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";
import { z } from "zod";

const createSurveyWithCourseSchema = z.object({
  title: z.string().min(1, "Titel krävs").max(200).transform((s) => s.trim()),
  description: z.string().max(1000).optional().default("").transform((s) => s.trim()),
  courseId: z.number().int().positive("Kurs-ID krävs"),
  questionIds: z.array(z.number().int().positive()).min(1, "Välj minst en fråga"),
});

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const surveys = await prisma.survey.findMany({
    include: {
      _count: { select: { questions: true, responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(surveys);
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { title, description, courseId, questionIds } =
      createSurveyWithCourseSchema.parse(body);

    const survey = await prisma.survey.create({
      data: {
        title,
        description,
        shareCode: generateShareCode(),
        courseId,
        questions: {
          create: questionIds.map((qId, index) => ({
            questionId: qId,
            order: index,
          })),
        },
      },
      include: {
        questions: {
          include: { question: { include: { options: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
