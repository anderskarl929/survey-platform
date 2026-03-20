"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/QuestionRenderer";
import QuizResultsDisplay from "@/components/QuizResultsDisplay";
import ProgressBar from "@/components/ProgressBar";
import LockOverlay from "@/components/LockOverlay";

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
  answerId?: number | null;
  questionId: number;
  questionText: string;
  questionType?: string;
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
  lockMode?: boolean;
}

export default function StudentQuizForm({ survey, lockMode = false }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft and flagged questions on mount
  useEffect(() => {
    fetch(`/api/surveys/${survey.id}/draft`)
      .then((res) => res.json())
      .then((data) => {
        if (data.draft?.answers) {
          const loaded: Record<number, string> = {};
          for (const [key, value] of Object.entries(data.draft.answers)) {
            loaded[Number(key)] = value as string;
          }
          setAnswers(loaded);
          setDraftLoaded(true);
        }
      })
      .catch(() => {});

    fetch("/api/student/flagged")
      .then((res) => res.json())
      .then((data) => {
        if (data.questionIds) {
          setFlaggedIds(new Set(data.questionIds));
        }
      })
      .catch(() => {});
  }, [survey.id]);

  const saveDraft = useCallback(
    async (currentAnswers: Record<number, string>) => {
      const hasAnswers = Object.values(currentAnswers).some((v) => v.trim());
      if (!hasAnswers) return;

      setDraftStatus("saving");
      try {
        const res = await fetch(`/api/surveys/${survey.id}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: currentAnswers }),
        });
        setDraftStatus(res.ok ? "saved" : "error");
      } catch {
        setDraftStatus("error");
      }
    },
    [survey.id]
  );

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };

      // Debounce auto-save: 2 seconds after last change
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveDraft(next), 2000);

      return next;
    });
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const [saving, setSaving] = useState(false);

  async function handleSaveDraft() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaving(true);
    await saveDraft(answers);
    setSaving(false);
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
        body: JSON.stringify({ answers: answerList }),
      });

      const data = await res.json();

      if (res.ok) {
        // Delete draft on successful submit
        fetch(`/api/surveys/${survey.id}/draft`, { method: "DELETE" }).catch(() => {});
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
      <QuizResultsDisplay
        score={score}
        quizResults={quizResults}
        isQuiz
        flaggedIds={flaggedIds}
      >
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
      <LockOverlay enabled={lockMode && !submitted} />
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-700 mt-2">{survey.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
            Quiz
          </span>
          {lockMode && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
              🔒 Låst läge
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <ProgressBar answered={answeredCount} total={totalQuestions} />
        <div className="flex items-center justify-between mt-3">
          <div>
            {error && (
              <p className="text-red-600 text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {draftLoaded && draftStatus === "idle" && "Utkast laddat"}
            {draftStatus === "saving" && "Sparar utkast…"}
            {draftStatus === "saved" && "Utkast sparat"}
            {draftStatus === "error" && (
              <span className="text-red-400">Kunde inte spara utkast</span>
            )}
          </div>
        </div>
      </div>

      <QuestionRenderer
        questions={survey.questions}
        answers={answers}
        onAnswer={setAnswer}
        flaggedIds={flaggedIds}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || submitting}
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 border border-gray-300"
        >
          {saving ? "Sparar..." : draftStatus === "saved" && !saving ? "Sparat — du kan fortsätta senare" : "Spara"}
        </button>
        <button
          type="submit"
          disabled={submitting || answeredCount < totalQuestions}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Skickar..." : "Skicka svar"}
        </button>
      </div>
    </form>
  );
}
