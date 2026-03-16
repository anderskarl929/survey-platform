"use client";

import type { ReactNode } from "react";
import FlagButton from "@/components/FlagButton";

interface Score {
  correct: number;
  total: number;
  percentage: number;
}

interface QuizResult {
  questionId: number;
  questionText: string;
  yourAnswer: string;
  isCorrect: boolean | null;
  correctAnswer: string | null;
}

interface QuizResultsDisplayProps {
  score: Score | null;
  quizResults: QuizResult[] | null;
  isQuiz: boolean;
  flaggedIds?: Set<number>;
  children?: ReactNode;
}

export default function QuizResultsDisplay({
  score,
  quizResults,
  isQuiz,
  flaggedIds,
  children,
}: QuizResultsDisplayProps) {
  return (
    <div>
      <div className="bg-white rounded-lg shadow p-8 text-center mb-6">
        <div className="text-4xl mb-4">
          {isQuiz ? (score && score.percentage >= 50 ? "\u2B50" : "\uD83D\uDCDD") : "\u2713"}
        </div>
        <h2 className="text-xl font-bold mb-2">
          {isQuiz ? "Resultat" : "Tack för ditt svar!"}
        </h2>
        {score && (
          <div className="mb-4">
            <div className="text-3xl font-bold text-blue-600">
              {score.correct} / {score.total}
            </div>
            <div className="text-gray-700">{score.percentage}% rätt</div>
          </div>
        )}
        {isQuiz && flaggedIds !== undefined && (
          <p className="text-sm text-gray-500 mt-2">
            🚩 Markera frågor du vill öva mer på — de sparas på din dashboard.
          </p>
        )}
        {!isQuiz && <p className="text-gray-700">Dina svar har skickats in.</p>}
      </div>

      {quizResults && (
        <div className="space-y-3 mb-6">
          {quizResults.map((r, i) => (
            <div
              key={r.questionId}
              className={`rounded-lg shadow p-4 ${
                r.isCorrect === true
                  ? "bg-green-50 border border-green-200"
                  : r.isCorrect === false
                  ? "bg-red-50 border border-red-200"
                  : "bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="font-medium text-sm">{i + 1}.</span>
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1">{r.questionText}</p>
                  <p className="text-sm">
                    Ditt svar:{" "}
                    <span
                      className={
                        r.isCorrect === false
                          ? "text-red-700 line-through"
                          : "text-green-700 font-medium"
                      }
                    >
                      {r.yourAnswer}
                    </span>
                  </p>
                  {r.isCorrect === false && r.correctAnswer && (
                    <p className="text-sm text-green-700">
                      Rätt svar: <span className="font-medium">{r.correctAnswer}</span>
                    </p>
                  )}
                  {flaggedIds !== undefined && (
                    <div className="mt-2">
                      <FlagButton
                        questionId={r.questionId}
                        initialFlagged={flaggedIds.has(r.questionId)}
                        size="md"
                      />
                    </div>
                  )}
                </div>
                <span className="text-lg">
                  {r.isCorrect === true ? "\u2705" : r.isCorrect === false ? "\u274C" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
