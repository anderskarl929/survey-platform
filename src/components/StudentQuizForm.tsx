"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/QuestionRenderer";
import QuizResultsDisplay from "@/components/QuizResultsDisplay";
import ProgressBar from "@/components/ProgressBar";

interface SurveyData {
  id: number;
  title: string;
  description: string;
  mode: string;
  questions: {
    id: number;
    text: string;
    type: string;
    options: string[];
  }[];
}

interface QuizResult {
  questionId: number;
  questionText: string;
  yourAnswer: string;
  isCorrect: boolean | null;
  correctAnswer: string | null;
}

interface Score {
  correct: number;
  total: number;
  percentage: number;
}

interface Props {
  survey: SurveyData;
  studentNumber: number;
  courseCode: string;
}

export default function StudentQuizForm({
  survey,
  studentNumber,
  courseCode,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const answerList = survey.questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, value: answers[q.id] }));

    try {
      const res = await fetch(`/api/surveys/${survey.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber, courseCode, answers: answerList }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
        if (data.score) setScore(data.score);
        if (data.quizResults) setQuizResults(data.quizResults);
      } else {
        setError(data.error || "Något gick fel");
      }
    } catch {
      setError("Kunde inte skicka svar. Kontrollera din internetanslutning.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <QuizResultsDisplay score={score} quizResults={quizResults} isQuiz>
        <button
          onClick={() => router.push("/student")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Tillbaka till dashboard
        </button>
      </QuizResultsDisplay>
    );
  }

  const answeredCount = survey.questions.filter(
    (q) => answers[q.id]?.trim()
  ).length;
  const totalQuestions = survey.questions.length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-700 mt-2">{survey.description}</p>
        )}
        <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
          Quiz
        </span>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <ProgressBar answered={answeredCount} total={totalQuestions} />
        {error && (
          <p className="text-red-600 text-sm mt-3" role="alert">
            {error}
          </p>
        )}
      </div>

      <QuestionRenderer questions={survey.questions} answers={answers} onAnswer={setAnswer} />

      <button
        type="submit"
        disabled={submitting || answeredCount < totalQuestions}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Skickar..." : "Skicka svar"}
      </button>
    </form>
  );
}
