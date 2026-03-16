import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-helpers";

const MCP_URL = process.env.MCP_SERVER_URL || "http://localhost:3002";

// GET — check if feedback exists (read from MCP server)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ answerId: string }> }
) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const { answerId } = await params;
    const id = Number(answerId);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ogiltigt ID" }, { status: 400 });
    }

    // Verify answer belongs to student
    const answer = await prisma.answer.findUnique({
      where: { id },
      include: { response: { select: { studentId: true } } },
    });

    if (!answer) {
      return NextResponse.json({ error: "Svar hittades inte" }, { status: 404 });
    }

    if (answer.response.studentId !== session.studentId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
    }

    const res = await fetch(`${MCP_URL}/feedback/${id}`);
    const data = await res.json();

    return NextResponse.json({ feedback: data.feedback || null });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST — request feedback generation from MCP server
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ answerId: string }> }
) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const { answerId } = await params;
    const id = Number(answerId);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ogiltigt ID" }, { status: 400 });
    }

    // Verify answer belongs to student
    const answer = await prisma.answer.findUnique({
      where: { id },
      include: { response: { select: { studentId: true } } },
    });

    if (!answer) {
      return NextResponse.json({ error: "Svar hittades inte" }, { status: 404 });
    }

    if (answer.response.studentId !== session.studentId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
    }

    const res = await fetch(`${MCP_URL}/feedback/${id}`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Kunde inte generera feedback" },
        { status: res.status }
      );
    }

    return NextResponse.json({ feedback: data.feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
