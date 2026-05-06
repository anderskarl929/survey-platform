import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const { id } = await params;
    const feedbackId = Number(id);
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
      return NextResponse.json({ error: "Ogiltigt ID" }, { status: 400 });
    }

    const item = await prisma.assignmentFeedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, studentId: true, readAt: true },
    });

    if (!item || item.studentId !== session.studentId) {
      return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
    }

    if (item.readAt === null) {
      await prisma.assignmentFeedback.update({
        where: { id: feedbackId },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ id: feedbackId, read: true });
  } catch (error) {
    return handleApiError(error);
  }
}
