import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { createCourseSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";

function generateCourseCode(): string {
  return nanoid(6).toUpperCase().replace(/[_-]/g, "X");
}

export async function GET() {
  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { topics: true, surveys: true, students: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = createCourseSchema.parse(body);
    const course = await prisma.course.create({
      data: { name, code: generateCourseCode() },
    });
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
