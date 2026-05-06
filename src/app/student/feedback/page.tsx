import { getStudentSession } from "@/lib/student-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FeedbackList, { FeedbackItem } from "@/components/FeedbackList";

export default async function StudentFeedbackPage() {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  const rows = await prisma.assignmentFeedback.findMany({
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

  const items: FeedbackItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
  }));

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Feedback från läraren</h2>
        <p className="text-sm text-muted mt-0.5">
          Återkoppling på inlämnade uppgifter, presentationer och annat utanför quizen.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-center py-12">
          Ingen feedback ännu. När din lärare postar feedback dyker den upp här.
        </p>
      ) : (
        <FeedbackList items={items} initialUnread={unreadCount} />
      )}
    </div>
  );
}
