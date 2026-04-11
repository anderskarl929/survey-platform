import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";

export const dynamic = "force-dynamic";

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;

  const survey = await prisma.survey.findUnique({
    where: { shareCode },
    include: {
      questions: {
        include: { question: { include: { options: true } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!survey) notFound();

  const surveyData = {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    mode: survey.mode,
    lockMode: survey.lockMode,
    questions: survey.questions.map((sq) => ({
      id: sq.question.id,
      text: sq.question.text,
      type: sq.question.type,
      options: sq.question.options.map((o) => o.text),
    })),
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4">
        <SurveyForm survey={surveyData} />
      </div>
    </div>
  );
}
