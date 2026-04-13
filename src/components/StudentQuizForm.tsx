"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/QuestionRenderer";
import QuizResultsDisplay from "@/components/QuizResultsDisplay";

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
  const [currentStep, setCurrentStep] = useState(0);
  const [lockViolations, setLockViolations] = useState(0);
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

    const unanswered = survey.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setError(`Du har ${unanswered.length} obesvarad${unanswered.length === 1 ? " fråga" : "e frågor"}. Alla frågor måste besvaras innan du kan skicka in.`);
      return;
    }

    setSubmitting(true);

    const answerList = survey.questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id],
    }));

    try {
      const res = await fetch(`/api/surveys/${survey.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answerList,
          lockModeViolations: lockMode ? lockViolations : undefined,
        }),
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
          className="btn-primary w-full py-3"
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
  const isLastQuestion = currentStep === totalQuestions - 1;
  const currentQuestion = survey.questions[currentStep];

  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function goNext() {
    setCurrentStep((s) => Math.min(totalQuestions - 1, s + 1));
  }

  return (
    <form onSubmit={handleSubmit}>
      <LockOverlay
        enabled={lockMode && !submitted}
        onViolationChange={setLockViolations}
      />
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{survey.title}</h1>
        {survey.description && (
          <p className="text-muted mt-2">{survey.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="badge bg-warning-light text-warning">
            Quiz
          </span>
          {lockMode && (
            <span className="badge bg-error-light text-error">
              🔒 Låst läge
            </span>
          )}
        </div>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-muted">
            Fråga {currentStep + 1} av {totalQuestions}
          </span>
          <div className="text-xs text-muted-light">
            {draftLoaded && draftStatus === "idle" && "Utkast laddat"}
            {draftStatus === "saving" && "Sparar utkast…"}
            {draftStatus === "saved" && "Utkast sparat"}
            {draftStatus === "error" && (
              <span className="text-error">Kunde inte spara utkast</span>
            )}
          </div>
        </div>
        {error && (
          <p className="text-error text-sm font-medium mt-3" role="alert">
            {error}
          </p>
        )}
      </div>

      {currentQuestion && (
        <QuestionRenderer
          questions={[currentQuestion]}
          answers={answers}
          onAnswer={setAnswer}
          flaggedIds={flaggedIds}
          startIndex={currentStep}
        />
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentStep === 0 || submitting}
          className="btn-secondary py-3 px-5"
        >
          Föregående
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || submitting}
          className="btn-secondary py-3 px-5"
        >
          {saving ? "Sparar..." : draftStatus === "saved" && !saving ? "Sparat" : "Spara"}
        </button>
        {isLastQuestion ? (
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 py-3"
          >
            {submitting ? "Skickar..." : "Skicka svar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className="btn-primary flex-1 py-3"
          >
            Nästa
          </button>
        )}
      </div>
    </form>
  );
}
