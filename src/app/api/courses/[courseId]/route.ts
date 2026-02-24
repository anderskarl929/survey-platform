import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: Number(courseId) },
    include: {
      _count: { select: { topics: true, surveys: true } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Kurs hittades inte" }, { status: 404 });
  }
  return NextResponse.json(course);
}
