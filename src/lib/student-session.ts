import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "survey-platform-dev-secret-change-in-prod"
);

const COOKIE_NAME = "student-session";

interface StudentSession {
  studentId: number;
  studentNumber: number;
  courseId: number;
}

export async function createStudentSession(session: StudentSession): Promise<string> {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
  return token;
}

export async function getStudentSession(): Promise<StudentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      studentId: payload.studentId as number,
      studentNumber: payload.studentNumber as number,
      courseId: payload.courseId as number,
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
