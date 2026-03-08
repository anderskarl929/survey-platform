import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentsSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/require-auth";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

function generatePassword(): string {
  // 8 chars, alphanumeric, easy to read (no ambiguous chars)
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { courseId } = await params;
  const cId = Number(courseId);
  if (isNaN(cId)) {
    return NextResponse.json({ error: "Ogiltigt kurs-ID" }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { courseId: cId },
    include: { _count: { select: { responses: true } } },
    orderBy: { number: "asc" },
  });

  return NextResponse.json(
    students.map((s) => ({
      id: s.id,
      number: s.number,
      username: s.username,
      responseCount: s._count.responses,
    }))
  );
}

export async function POST(
  request: NextRequest,
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

    // Get course code for username generation
    const course = await prisma.course.findUnique({ where: { id: cId } });
    if (!course) {
      return NextResponse.json({ error: "Kursen hittades inte" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createStudentsSchema.parse(body);

    // Support single number or array of numbers
    const numbers: number[] =
      "numbers" in parsed
        ? parsed.numbers
        : "count" in parsed
          ? Array.from({ length: parsed.count }, (_, i) => i + 1)
          : [parsed.number];

    // Get existing student numbers to skip duplicates
    const existing = await prisma.student.findMany({
      where: { courseId: cId, number: { in: numbers } },
      select: { number: true },
    });
    const existingSet = new Set(existing.map((s) => s.number));
    const toCreate = numbers.filter((n) => !existingSet.has(n));

    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, credentials: [] }, { status: 201 });
    }

    // Generate credentials
    const credentials = toCreate.map((number) => {
      const password = generatePassword();
      const username = `${course.code.toLowerCase()}-${number}`;
      return { number, username, password };
    });

    // Check for username collisions and add suffix if needed
    const usernames = credentials.map((c) => c.username);
    const existingUsernames = await prisma.student.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    });
    const existingUsernameSet = new Set(existingUsernames.map((s) => s.username));

    for (const cred of credentials) {
      if (existingUsernameSet.has(cred.username)) {
        cred.username = `${cred.username}-${nanoid(4)}`;
      }
    }

    // Hash passwords
    const hashedData = await Promise.all(
      credentials.map(async (c) => ({
        number: c.number,
        username: c.username,
        passwordHash: await bcrypt.hash(c.password, 12),
        courseId: cId,
      }))
    );

    await prisma.student.createMany({ data: hashedData });

    return NextResponse.json(
      {
        created: toCreate.length,
        credentials: credentials.map((c) => ({
          number: c.number,
          username: c.username,
          password: c.password,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
