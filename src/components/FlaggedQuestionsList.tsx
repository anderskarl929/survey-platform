"use client";

import { useState } from "react";

interface FlaggedQuestion {
  questionId: number;
  text: string;
  type: string;
  topicName: string;
  options: string[];
  correctAnswer: string | null;
}

interface Props {
  questions: FlaggedQuestion[];
}

export default function FlaggedQuestionsList({ questions }: Props) {
  const [items, setItems] = useState(questions);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  async function unflag(questionId: number) {
    setRemoving(questionId);
    try {
      const res = await fetch("/api/student/flagged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((q) => q.questionId !== questionId));
      }
    } finally {
      setRemoving(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2">
        Inga markerade frågor kvar — bra jobbat! 🎉
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((q) => {
        const isExpanded = expandedId === q.questionId;
        return (
          <div
            key={q.questionId}
            className="bg-white rounded-lg shadow border border-amber-100"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedId(isExpanded ? null : q.questionId)
              }
              className="w-full text-left p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {q.text}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{q.topicName}</p>
              </div>
              <span className="text-gray-400 text-sm shrink-0">
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-amber-100 pt-3">
                {q.type === "MULTIPLE_CHOICE" && q.options.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {q.options.map((opt) => (
                      <div
                        key={opt}
                        className={`text-sm px-3 py-1.5 rounded ${
                          opt === q.correctAnswer
                            ? "bg-green-50 text-green-700 font-medium"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {opt === q.correctAnswer && "✓ "}
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => unflag(q.questionId)}
                  disabled={removing === q.questionId}
                  className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-50"
                >
                  {removing === q.questionId
                    ? "Tar bort..."
                    : "🚩 Ta bort markering"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
