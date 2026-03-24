"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QuestionRenderer from "@/components/QuestionRenderer";
import QuizResultsDisplay from "@/components/QuizResultsDisplay";
import ProgressBar from "@/components/ProgressBar";
import LockOverlay from "@/components/LockOverlay";

interface SurveyData {
  id: number;
  title: string;
  description: string;
  mode: string;
  lockMode: boolean;
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

export default function SurveyForm({ survey }: { survey: SurveyData }) {
  const [studentNumber, setStudentNumber] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<number> | undefined>(
    undefined
  );
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQuiz = survey.mode === "QUIZ";

  // Try to load draft and flagged questions — works if student is logged in
  useEffect(() => {
    fetch(`/api/surveys/${survey.id}/draft`)
      .then((res) => {
        if (res.ok) {
          setIsLoggedIn(true);
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.draft?.answers) {
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
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.questionIds) {
          setFlaggedIds(new Set(data.questionIds));
        }
      })
      .catch(() => {});
  }, [survey.id]);

  const saveDraft = useCallback(
    async (currentAnswers: Record<number, string>) => {
      if (!isLoggedIn) return;
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
    [survey.id, isLoggedIn]
  );

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };

      if (isLoggedIn) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => saveDraft(next), 2000);
      }

      return next;
    });
  }

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
        fetch(`/api/surveys/${survey.id}/draft`, { method: "DELETE" }).catch(() => {});
        setSubmitted(true);
        if (data.score) setScore(data.score);
        if (data.quizResults) setQuizResults(data.quizResults);
        if (data.surveyResults) setQuizResults(data.surveyResults);
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
        isQuiz={isQuiz}
        flaggedIds={flaggedIds}
      />
    );
  }

  const answeredCount = survey.questions.filter((q) => answers[q.id]?.trim()).length;
  const totalQuestions = survey.questions.length;

  return (
    <form onSubmit={handleSubmit}>
      <LockOverlay enabled={survey.lockMode && !submitted} />
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-700 mt-2">{survey.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {isQuiz && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Quiz</span>
          )}
          {survey.lockMode && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
              🔒 Låst läge
            </span>
          )}
        </div>
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
        <div className="flex items-center justify-between mt-2">
          <div>
            {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
          </div>
          {isLoggedIn && (
            <div className="text-xs text-gray-400">
              {draftLoaded && draftStatus === "idle" && "Utkast laddat"}
              {draftStatus === "saving" && "Sparar utkast…"}
              {draftStatus === "saved" && "Utkast sparat"}
              {draftStatus === "error" && (
                <span className="text-red-400">Kunde inte spara utkast</span>
              )}
            </div>
          )}
        </div>
      </div>

      <QuestionRenderer
        questions={survey.questions}
        answers={answers}
        onAnswer={setAnswer}
        flaggedIds={flaggedIds}
      />

      <div className="flex gap-3">
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 border border-gray-300"
          >
            {saving ? "Sparar..." : draftStatus === "saved" && !saving ? "Sparat — du kan fortsätta senare" : "Spara"}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`${isLoggedIn ? "flex-1" : "w-full"} bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50`}
        >
          {submitting ? "Skickar..." : "Skicka svar"}
        </button>
      </div>
    </form>
  );
}
