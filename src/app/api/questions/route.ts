import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createQuestionSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const topicId = searchParams.get("topicId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (topicId) where.topicId = Number(topicId);
  if (type) where.type = type;

  const questions = await prisma.question.findMany({
    where,
    include: { options: true, topic: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(questions);
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { text, type, topicId, options, correctOptionIndex } =
      createQuestionSchema.parse(body);

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
