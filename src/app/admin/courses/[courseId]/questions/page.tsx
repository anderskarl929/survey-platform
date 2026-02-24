"use client";

import { useParams } from "next/navigation";
import QuestionsManager from "@/components/admin/QuestionsManager";

export default function CourseQuestionsPage() {
  const { courseId } = useParams();
  return <QuestionsManager apiBase={`/api/courses/${courseId}`} showCorrectAnswers />;
}
