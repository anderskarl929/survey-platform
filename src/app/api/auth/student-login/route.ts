import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, COOKIE_NAME } from "@/lib/student-session";
import { studentLoginSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

// Extract the client IP from standard proxy headers. Only accepts the first
// value in x-forwarded-for (which proxies set to the real client) and falls
// back to x-real-ip. Returns "unknown" if nothing valid is found - and callers
// should layer a second rate limit (e.g. per-username) since header-based
// keys can be spoofed by any client that controls the connection.
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || real || "";
  if (candidate && (IPV4.test(candidate) || IPV6.test(candidate))) {
    return candidate;
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = studentLoginSchema.parse(body);

    // Rate limit by IP AND by username - 10 attempts per minute on each axis.
    // Two axes so that IP spoofing doesn't let an attacker brute-force a
    // single username, and a compromised shared IP can't lock out everyone.
    const ip = getClientIp(request);
    for (const key of [`student-login-ip:${ip}`, `student-login-user:${username}`]) {
      const { allowed, retryAfterMs } = rateLimit(key, {
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
    }

    const student = await prisma.student.findUnique({
      where: { username },
      include: { course: true },
    });

    if (!student || !(await bcrypt.compare(password, student.passwordHash))) {
      return NextResponse.json(
        { error: "Ogiltigt användarnamn eller lösenord" },
        { status: 401 }
      );
    }

    const token = await createStudentSession({
      studentId: student.id,
      studentNumber: student.number,
      courseId: student.courseId,
    });

    const response = NextResponse.json({
      success: true,
      studentNumber: student.number,
      courseId: student.courseId,
      courseName: student.course.name,
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
