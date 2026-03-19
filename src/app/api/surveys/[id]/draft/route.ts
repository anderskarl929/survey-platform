import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = Number(id);
    if (isNaN(surveyId)) {
      return NextResponse.json({ error: "Ogiltigt enkät-ID" }, { status: 400 });
    }

    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const draft = await prisma.draftResponse.findUnique({
      where: {
        surveyId_studentId: { surveyId, studentId: session.studentId },
      },
    });

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({
      draft: {
        answers: JSON.parse(draft.answers),
        updatedAt: draft.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = Number(id);
    if (isNaN(surveyId)) {
      return NextResponse.json({ error: "Ogiltigt enkät-ID" }, { status: 400 });
    }

    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const body = await request.json();
    const answers: Record<string, string> = body.answers;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Ogiltigt format" }, { status: 400 });
    }

    // Verify survey exists and student has access
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { courseId: true },
    });

    if (!survey) {
      return NextResponse.json({ error: "Enkät hittades inte" }, { status: 404 });
    }

    if (survey.courseId !== session.courseId) {
      return NextResponse.json({ error: "Ingen åtkomst" }, { status: 403 });
    }

    // Check if already submitted
    const existing = await prisma.response.findUnique({
      where: {
        surveyId_studentId: { surveyId, studentId: session.studentId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Du har redan skickat in svar på denna enkät." },
        { status: 409 }
      );
    }

    await prisma.draftResponse.upsert({
      where: {
        surveyId_studentId: { surveyId, studentId: session.studentId },
      },
      update: { answers: JSON.stringify(answers) },
      create: {
        surveyId,
        studentId: session.studentId,
        answers: JSON.stringify(answers),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = Number(id);
    if (isNaN(surveyId)) {
      return NextResponse.json({ error: "Ogiltigt enkät-ID" }, { status: 400 });
    }

    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    await prisma.draftResponse.deleteMany({
      where: { surveyId, studentId: session.studentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
