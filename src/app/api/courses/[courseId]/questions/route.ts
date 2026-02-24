import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createQuestionSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const { searchParams } = request.nextUrl;
  const topicId = searchParams.get("topicId");

  const where: Record<string, unknown> = {
    topic: { courseId: Number(courseId) },
  };
  if (topicId) where.topicId = Number(topicId);

  const questions = await prisma.question.findMany({
    where,
    include: { options: true, topic: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(questions);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { text, type, topicId, options, correctOptionIndex } =
      createQuestionSchema.parse(body);

    // Verify topic belongs to this course
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, courseId: Number(courseId) },
    });
    if (!topic) {
      return NextResponse.json(
        { error: "Ämnet tillhör inte denna kurs" },
        { status: 400 }
      );
    }

    const question = await prisma.question.create({
      data: {
        text,
        type,
        topicId,
        options:
          type === "MULTIPLE_CHOICE" && options?.length
            ? {
                create: options.map((o, i) => ({
                  text: o.trim(),
                  isCorrect: i === correctOptionIndex,
                })),
              }
            : undefined,
      },
      include: { options: true, topic: true },
    });
    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
