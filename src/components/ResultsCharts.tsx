"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface StudentAnswer {
  studentNumber: number;
  value: string;
  isCorrect?: boolean | null;
}

interface MCQuestion {
  id: number;
  text: string;
  type: "MULTIPLE_CHOICE";
  optionCounts: Record<string, number>;
  correctAnswer?: string | null;
  studentAnswers?: StudentAnswer[];
}

interface FTQuestion {
  id: number;
  text: string;
  type: "FREE_TEXT";
  textResponses: string[];
  studentAnswers?: StudentAnswer[];
}

type ResultQuestion = MCQuestion | FTQuestion;

export default function ResultsCharts({
  questions,
  isQuiz = false,
}: {
  questions: ResultQuestion[];
  isQuiz?: boolean;
}) {
  return (
    <div className="space-y-6">
      {questions.map((q) => (
        <div key={q.id} className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">{q.text}</h3>

          {q.type === "MULTIPLE_CHOICE" ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(q.optionCounts).map(([name, count]) => ({
                      name,
                      count,
                      isCorrect: isQuiz && q.correctAnswer === name,
                    }))}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {Object.entries(q.optionCounts).map(([name]) => (
                        <Cell
                          key={name}
                          fill={isQuiz && q.correctAnswer === name ? "#22c55e" : "#3b82f6"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {isQuiz && q.correctAnswer && (
                <p className="text-sm text-green-700 mt-2">
                  Rätt svar: <span className="font-medium">{q.correctAnswer}</span>
                </p>
              )}
              {q.studentAnswers && q.studentAnswers.length > 0 && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                    Visa per elev ({q.studentAnswers.length} svar)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {q.studentAnswers
                      .sort((a, b) => a.studentNumber - b.studentNumber)
                      .map((sa) => (
                        <div
                          key={sa.studentNumber}
                          className={`rounded p-2 text-xs ${
                            isQuiz
                              ? sa.isCorrect
                                ? "bg-green-50 border border-green-200"
                                : "bg-red-50 border border-red-200"
                              : "bg-gray-50"
                          }`}
                        >
                          <span className="font-medium">#{sa.studentNumber}</span>{" "}
                          <span className={isQuiz && !sa.isCorrect ? "text-red-600" : "text-gray-600"}>
                            {sa.value}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {q.studentAnswers && q.studentAnswers.length > 0 ? (
                q.studentAnswers
                  .sort((a, b) => a.studentNumber - b.studentNumber)
                  .map((sa) => (
                    <div
                      key={sa.studentNumber}
                      className="bg-gray-50 rounded p-3 text-sm"
                    >
                      <span className="font-medium text-gray-700">#{sa.studentNumber}</span>{" "}
                      {sa.value}
                    </div>
                  ))
              ) : q.type === "FREE_TEXT" && q.textResponses.length === 0 ? (
                <p className="text-gray-600 text-sm">Inga svar ännu.</p>
              ) : (
                q.textResponses.map((text, i) => (
                  <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                    {text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
