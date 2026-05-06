import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const items = await prisma.assignmentFeedback.findMany({
      where: { studentId: session.studentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        readAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        content: i.content,
        read: i.readAt !== null,
        createdAt: i.createdAt.toISOString(),
      })),
      unreadCount: items.filter((i) => i.readAt === null).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
