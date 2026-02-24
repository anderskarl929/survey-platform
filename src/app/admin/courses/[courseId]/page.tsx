import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CourseDashboard({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const cId = Number(courseId);

  const [course, questionCount, surveyCount, responseCount, studentCount, recentSurveys] =
    await Promise.all([
      prisma.course.findUnique({ where: { id: cId } }),
      prisma.question.count({ where: { topic: { courseId: cId } } }),
      prisma.survey.count({ where: { courseId: cId } }),
      prisma.response.count({ where: { survey: { courseId: cId } } }),
      prisma.student.count({ where: { courseId: cId } }),
      prisma.survey.findMany({
        where: { courseId: cId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { responses: true, questions: true } } },
      }),
    ]);

  const stats = [
    { label: "Frågor", value: questionCount },
    { label: "Enkäter", value: surveyCount },
    { label: "Svar", value: responseCount },
    { label: "Elever", value: studentCount },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      {course && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm text-gray-700">Kurskod:</span>
          <span className="bg-gray-100 px-3 py-1 rounded font-mono text-lg font-bold tracking-wider">
            {course.code}
          </span>
          <span className="text-xs text-gray-600">Dela med eleverna för inloggning</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-gray-700 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Senaste enkäter</h2>
      {recentSurveys.length === 0 ? (
        <p className="text-gray-700">Inga enkäter skapade ännu.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Titel</th>
                <th className="p-3">Frågor</th>
                <th className="p-3">Svar</th>
                <th className="p-3">Skapad</th>
              </tr>
            </thead>
            <tbody>
              {recentSurveys.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">{s.title}</td>
                  <td className="p-3">{s._count.questions}</td>
                  <td className="p-3">{s._count.responses}</td>
                  <td className="p-3">
                    {new Date(s.createdAt).toLocaleDateString("sv-SE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
