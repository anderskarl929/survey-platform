import { prisma } from "../prisma.js";

interface BulkItem {
  student_number: number;
  title: string;
  content: string;
}

async function findCourseByCode(course_code: string) {
  const course = await prisma.course.findUnique({ where: { code: course_code } });
  if (!course) {
    throw new Error(`Kurs med kod "${course_code}" hittades inte`);
  }
  return course;
}

export async function postAssignmentFeedback(
  course_code: string,
  student_number: number,
  title: string,
  content: string
): Promise<string> {
  const course = await findCourseByCode(course_code);

  const student = await prisma.student.findUnique({
    where: { courseId_number: { courseId: course.id, number: student_number } },
  });
  if (!student) {
    return JSON.stringify({
      error: `Elev #${student_number} finns inte i kurs ${course_code}`,
    });
  }

  const created = await prisma.assignmentFeedback.create({
    data: { studentId: student.id, title, content },
  });

  return JSON.stringify({
    success: true,
    id: created.id,
    student_number,
    title,
    message: `Feedback "${title}" sparad för elev ${student_number} i ${course_code}`,
  });
}

export async function bulkPostAssignmentFeedback(
  course_code: string,
  items: BulkItem[]
): Promise<string> {
  const course = await findCourseByCode(course_code);

  const students = await prisma.student.findMany({
    where: { courseId: course.id },
    select: { id: true, number: true },
  });
  const byNumber = new Map(students.map((s) => [s.number, s.id]));

  const created: Array<{ student_number: number; title: string; id: number }> = [];
  const skipped: Array<{ student_number: number; title: string; reason: string }> = [];

  for (const item of items) {
    const studentId = byNumber.get(item.student_number);
    if (!studentId) {
      skipped.push({
        student_number: item.student_number,
        title: item.title,
        reason: "Elev hittades inte",
      });
      continue;
    }
    const row = await prisma.assignmentFeedback.create({
      data: { studentId, title: item.title, content: item.content },
    });
    created.push({ student_number: item.student_number, title: item.title, id: row.id });
  }

  return JSON.stringify(
    {
      success: true,
      course_code,
      created_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
    },
    null,
    2
  );
}
