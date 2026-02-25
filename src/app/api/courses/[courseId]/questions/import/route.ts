import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCsvContent } from "@/lib/csv";
import { importCsvSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const cId = Number(courseId);
    if (isNaN(cId)) {
      return NextResponse.json({ error: "Ogiltigt kurs-ID" }, { status: 400 });
    }

    const body = await request.json();
    const { csvContent } = importCsvSchema.parse(body);

    const rows = parseCsvContent(csvContent);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Inga giltiga rader hittades" },
        { status: 400 }
      );
    }

    let imported = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const topic = await tx.topic.upsert({
          where: { courseId_name: { courseId: cId, name: row.topic } },
          update: {},
          create: { name: row.topic, courseId: cId },
        });

        await tx.question.create({
          data: {
            text: row.text,
            type: row.type,
            topicId: topic.id,
            options:
              row.type === "MULTIPLE_CHOICE" && row.options.length > 0
                ? {
                    create: row.options.map((o) => ({
                      text: o,
                      isCorrect: row.correctAnswer
                        ? o === row.correctAnswer
                        : false,
                    })),
                  }
                : undefined,
          },
        });
        imported++;
      }
    });

    return NextResponse.json({ imported });
  } catch (error) {
    return handleApiError(error);
  }
}
