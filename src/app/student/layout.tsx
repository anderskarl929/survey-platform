import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStudentSession();
  const unreadFeedback = session
    ? await prisma.assignmentFeedback.count({
        where: { studentId: session.studentId, readAt: null },
      })
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border-light sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/student" className="font-bold text-foreground hover:text-primary transition-colors text-sm tracking-tight">
              Dashboard
            </Link>
            <Link href="/student/results" className="text-sm text-muted hover:text-foreground transition-colors">
              Mina resultat
            </Link>
            <Link
              href="/student/feedback"
              className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              Feedback
              {unreadFeedback > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-white">
                  {unreadFeedback}
                </span>
              )}
            </Link>
          </div>
          <form action="/api/student/logout" method="POST">
            <button
              type="submit"
              className="btn-secondary text-xs"
            >
              Logga ut
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
