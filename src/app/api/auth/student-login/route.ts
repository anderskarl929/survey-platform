import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, COOKIE_NAME } from "@/lib/student-session";

export async function POST(request: Request) {
  const { studentNumber, courseCode } = await request.json();

  if (!studentNumber || !courseCode) {
    return NextResponse.json(
      { error: "Elevnummer och kurskod krävs" },
      { status: 400 }
    );
  }

  const course = await prisma.course.findUnique({
    where: { code: courseCode.toUpperCase().trim() },
  });

  if (!course) {
    return NextResponse.json({ error: "Ogiltig kurskod" }, { status: 404 });
  }

  const student = await prisma.student.findUnique({
    where: {
      courseId_number: { courseId: course.id, number: Number(studentNumber) },
    },
  });

  if (!student) {
    return NextResponse.json(
      { error: "Elevnumret finns inte i denna kurs" },
      { status: 404 }
    );
  }

  const token = await createStudentSession({
    studentId: student.id,
    studentNumber: student.number,
    courseId: course.id,
  });

  const response = NextResponse.json({
    success: true,
    studentNumber: student.number,
    courseId: course.id,
    courseName: course.name,
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
