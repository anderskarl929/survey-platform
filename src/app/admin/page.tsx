import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { topics: true, surveys: true } },
      surveys: {
        include: { _count: { select: { responses: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mina kurser</h1>
        <Link
          href="/admin/courses/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Skapa ny kurs
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-700 mb-4">Inga kurser skapade ännu.</p>
          <Link
            href="/admin/courses/new"
            className="text-blue-600 hover:underline"
          >
            Skapa din första kurs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const totalResponses = course.surveys.reduce(
              (sum, s) => sum + s._count.responses,
              0
            );
            return (
              <Link
                key={course.id}
                href={`/admin/courses/${course.id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <h2 className="text-lg font-semibold mb-1">{course.name}</h2>
                <div className="text-xs text-gray-600 mb-3 font-mono">Kod: {course.code}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-2xl font-bold">{course._count.topics}</div>
                    <div className="text-gray-700">Ämnen</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{course._count.surveys}</div>
                    <div className="text-gray-700">Enkäter</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalResponses}</div>
                    <div className="text-gray-700">Svar</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-3">
                  Skapad {new Date(course.createdAt).toLocaleDateString("sv-SE")}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
