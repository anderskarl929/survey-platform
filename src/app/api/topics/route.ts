import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-helpers";
import { z } from "zod";

const createTopicWithCourseSchema = z.object({
  name: z.string().min(1, "Namn krävs").max(100).transform((s) => s.trim()),
  courseId: z.number().int().positive("Kurs-ID krävs"),
});

export async function GET() {
  const topics = await prisma.topic.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(topics);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, courseId } = createTopicWithCourseSchema.parse(body);
    const topic = await prisma.topic.create({
      data: { name, courseId },
    });
    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
