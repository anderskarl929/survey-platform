import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { handleApiError } from "@/lib/api-helpers";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { questionId } = await params;
    const qId = Number(questionId);
    if (isNaN(qId)) {
      return NextResponse.json({ error: "Ogiltigt fråge-ID" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({
      where: { id: qId },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Fråga hittades inte" },
        { status: 404 }
      );
    }

    await prisma.question.delete({ where: { id: qId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
