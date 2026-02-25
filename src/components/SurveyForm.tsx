"use client";

import { useState } from "react";
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

export default function SurveyForm({ survey }: { survey: SurveyData }) {
  const [studentNumber, setStudentNumber] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);

  const isQuiz = survey.mode === "QUIZ";

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const num = Number(studentNumber);
    if (!studentNumber || isNaN(num) || num < 1) {
      setError("Ange ett giltigt elevnummer (1 eller högre).");
      return;
    }

    if (!courseCode.trim()) {
      setError("Ange din kurskod.");
      return;
    }

    setSubmitting(true);

    const answerList = survey.questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, value: answers[q.id] }));

    try {
      const res = await fetch(`/api/surveys/${survey.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: num,
          courseCode: courseCode.trim(),
          answers: answerList,
        }),
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
    return <QuizResultsDisplay score={score} quizResults={quizResults} isQuiz={isQuiz} />;
  }

  const answeredCount = survey.questions.filter((q) => answers[q.id]?.trim()).length;
  const totalQuestions = survey.questions.length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-700 mt-2">{survey.description}</p>
        )}
        {isQuiz && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Quiz</span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-6">
          <ProgressBar answered={answeredCount} total={totalQuestions} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="student-number" className="block font-medium mb-2">Ditt elevnummer</label>
            <input
              id="student-number"
              type="number"
              min="1"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="T.ex. 7"
              className="w-full border rounded p-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="course-code" className="block font-medium mb-2">Kurskod</label>
            <input
              id="course-code"
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              placeholder="T.ex. MAT7A"
              className="w-full border rounded p-2 text-sm font-mono uppercase tracking-wider"
              required
            />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-2" role="alert">{error}</p>}
      </div>

      <QuestionRenderer questions={survey.questions} answers={answers} onAnswer={setAnswer} />

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Skickar..." : "Skicka svar"}
      </button>
    </form>
  );
}
