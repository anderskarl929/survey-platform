import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCsvContent } from "@/lib/csv";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";
import { z } from "zod";

const importSchema = z.object({
  csvContent: z.string().min(1, "CSV-innehåll krävs").max(1_000_000, "CSV-filen är för stor"),
  courseId: z.number().int().positive("Kurs-ID krävs"),
});

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { csvContent, courseId } = importSchema.parse(body);

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
          where: { courseId_name: { courseId, name: row.topic } },
          update: {},
          create: { name: row.topic, courseId },
        });

        await tx.question.create({
          data: {
            text: row.text,
            type: row.type,
            topicId: topic.id,
            options:
              row.type === "MULTIPLE_CHOICE" && row.options.length > 0
                ? { create: row.options.map((o) => ({ text: o })) }
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
