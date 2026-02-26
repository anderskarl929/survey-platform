import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, COOKIE_NAME } from "@/lib/student-session";
import { studentLoginSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP — 10 attempts per minute
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed, retryAfterMs } = rateLimit(`student-login:${ip}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "För många inloggningsförsök. Försök igen senare." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { studentNumber, courseCode } = studentLoginSchema.parse(body);

    const course = await prisma.course.findUnique({
      where: { code: courseCode },
    });

    if (!course) {
      // Generic message to prevent enumeration
      return NextResponse.json(
        { error: "Ogiltig kurskod eller elevnummer" },
        { status: 401 }
      );
    }

    const student = await prisma.student.findUnique({
      where: {
        courseId_number: { courseId: course.id, number: studentNumber },
      },
    });

    if (!student) {
      // Same generic message — don't reveal whether course or student is wrong
      return NextResponse.json(
        { error: "Ogiltig kurskod eller elevnummer" },
        { status: 401 }
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
  } catch (error) {
    return handleApiError(error);
  }
}
