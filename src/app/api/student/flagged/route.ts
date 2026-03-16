import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";
import { handleApiError } from "@/lib/api-helpers";

// GET — list all flagged question IDs for the current student
export async function GET() {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const flagged = await prisma.flaggedQuestion.findMany({
      where: { studentId: session.studentId },
      select: { questionId: true },
    });

    return NextResponse.json({
      questionIds: flagged.map((f) => f.questionId),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST — toggle flag on a question { questionId: number }
export async function POST(request: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const { questionId } = await request.json();
    if (typeof questionId !== "number") {
      return NextResponse.json(
        { error: "questionId krävs" },
        { status: 400 }
      );
    }

    // Check the question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      return NextResponse.json(
        { error: "Frågan hittades inte" },
        { status: 404 }
      );
    }

    // Toggle: if already flagged, remove; otherwise create
    const existing = await prisma.flaggedQuestion.findUnique({
      where: {
        studentId_questionId: {
          studentId: session.studentId,
          questionId,
        },
      },
    });

    if (existing) {
      await prisma.flaggedQuestion.delete({ where: { id: existing.id } });
      return NextResponse.json({ flagged: false, questionId });
    } else {
      await prisma.flaggedQuestion.create({
        data: { studentId: session.studentId, questionId },
      });
      return NextResponse.json({ flagged: true, questionId });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
