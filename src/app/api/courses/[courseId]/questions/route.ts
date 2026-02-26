import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createQuestionSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { courseId } = await params;
  const cId = Number(courseId);
  if (isNaN(cId)) {
    return NextResponse.json({ error: "Ogiltigt kurs-ID" }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const topicId = searchParams.get("topicId");

  const where: Record<string, unknown> = {
    topic: { courseId: cId },
  };
  if (topicId) {
    const tid = Number(topicId);
    if (isNaN(tid)) {
      return NextResponse.json({ error: "Ogiltigt ämnes-ID" }, { status: 400 });
    }
    where.topicId = tid;
  }

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
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const cId = Number(courseId);
    if (isNaN(cId)) {
      return NextResponse.json({ error: "Ogiltigt kurs-ID" }, { status: 400 });
    }

    const body = await request.json();
    const { text, type, topicId, options, correctOptionIndex } =
      createQuestionSchema.parse(body);

    // Verify topic belongs to this course
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, courseId: cId },
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
