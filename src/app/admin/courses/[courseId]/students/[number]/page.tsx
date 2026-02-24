"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Answer {
  questionId: number;
  questionText: string;
  questionType: string;
  value: string;
}

interface SurveyResponse {
  surveyId: number;
  surveyTitle: string;
  respondedAt: string;
  answers: Answer[];
}

interface StudentData {
  studentNumber: number;
  surveys: SurveyResponse[];
}

export default function StudentDetailPage() {
  const { courseId, number } = useParams();
  const [data, setData] = useState<StudentData | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/students/${number}`)
      .then((res) => res.json())
      .then(setData);
  }, [courseId, number]);

  if (!data) {
    return <div className="text-gray-700">Laddar...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Elev #{data.studentNumber}</h1>
      <p className="text-gray-700 mb-6">
        Svarat på {data.surveys.length} enkät{data.surveys.length !== 1 ? "er" : ""}
      </p>

      {data.surveys.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-700">Inga svar registrerade.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.surveys.map((s) => (
            <div key={s.surveyId} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{s.surveyTitle}</h2>
                <span className="text-xs text-gray-600">
                  {new Date(s.respondedAt).toLocaleDateString("sv-SE")}
                </span>
              </div>
              <div className="space-y-3">
                {s.answers.map((a) => (
                  <div key={a.questionId} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="text-sm text-gray-600 mb-1">{a.questionText}</div>
                    <div className="text-sm font-medium">
                      {a.questionType === "MULTIPLE_CHOICE" ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {a.value}
                        </span>
                      ) : (
                        <span className="italic">&quot;{a.value}&quot;</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
