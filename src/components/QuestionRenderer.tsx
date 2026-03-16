"use client";

import FlagButton from "@/components/FlagButton";

interface Question {
  id: number;
  text: string;
  type: string;
  options: string[];
}

interface QuestionRendererProps {
  questions: Question[];
  answers: Record<number, string>;
  onAnswer: (questionId: number, value: string) => void;
  flaggedIds?: Set<number>;
}

export default function QuestionRenderer({
  questions,
  answers,
  onAnswer,
  flaggedIds,
}: QuestionRendererProps) {
  return (
    <>
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <label className="block font-medium text-gray-900">
              {i + 1}. {q.text}
            </label>
            {flaggedIds !== undefined && (
              <FlagButton
                questionId={q.id}
                initialFlagged={flaggedIds.has(q.id)}
              />
            )}
          </div>

          {q.type === "MULTIPLE_CHOICE" ? (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.text}>
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:border-blue-300 transition-colors ${
                    answers[q.id] === opt ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => onAnswer(q.id, opt)}
                    className="accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  />
                  <span className="text-sm text-gray-900">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[q.id] || ""}
              onChange={(e) => onAnswer(q.id, e.target.value)}
              rows={3}
              placeholder="Skriv ditt svar..."
              className="w-full border rounded p-2 text-sm"
            />
          )}
        </div>
      ))}
    </>
  );
}
