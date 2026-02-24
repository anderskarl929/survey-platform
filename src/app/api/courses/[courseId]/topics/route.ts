import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTopicSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const topics = await prisma.topic.findMany({
    where: { courseId: Number(courseId) },
    include: { _count: { select: { questions: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(topics);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { name } = createTopicSchema.parse(body);
    const topic = await prisma.topic.create({
      data: { name, courseId: Number(courseId) },
    });
    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
