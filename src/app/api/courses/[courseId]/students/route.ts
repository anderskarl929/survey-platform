import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentsSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const cId = Number(courseId);

  const students = await prisma.student.findMany({
    where: { courseId: cId },
    include: { _count: { select: { responses: true } } },
    orderBy: { number: "asc" },
  });

  return NextResponse.json(
    students.map((s) => ({
      id: s.id,
      number: s.number,
      responseCount: s._count.responses,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const cId = Number(courseId);
    const body = await request.json();
    const parsed = createStudentsSchema.parse(body);

    // Support single number or array of numbers
    const numbers: number[] =
      "numbers" in parsed
        ? parsed.numbers
        : "count" in parsed
          ? Array.from({ length: parsed.count }, (_, i) => i + 1)
          : [parsed.number];

    // Get existing student numbers to skip duplicates
    const existing = await prisma.student.findMany({
      where: { courseId: cId, number: { in: numbers } },
      select: { number: true },
    });
    const existingSet = new Set(existing.map((s) => s.number));
    const toCreate = numbers.filter((n) => !existingSet.has(n));

    if (toCreate.length > 0) {
      await prisma.student.createMany({
        data: toCreate.map((number) => ({ number, courseId: cId })),
      });
    }

    return NextResponse.json({ created: toCreate.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
