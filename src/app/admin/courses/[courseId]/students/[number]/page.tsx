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
    return <div className="text-muted">Laddar...</div>;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-2 tracking-tight">Elev #{data.studentNumber}</h1>
      <p className="text-muted mb-6">
        Svarat på {data.surveys.length} enkät{data.surveys.length !== 1 ? "er" : ""}
      </p>

      {data.surveys.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted">Inga svar registrerade.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {data.surveys.map((s) => (
            <div key={s.surveyId} className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold tracking-tight">{s.surveyTitle}</h2>
                <span className="text-xs text-muted">
                  {new Date(s.respondedAt).toLocaleDateString("sv-SE")}
                </span>
              </div>
              <div className="space-y-3">
                {s.answers.map((a) => (
                  <div key={a.questionId} className="border-b border-border-light last:border-0 pb-3 last:pb-0">
                    <div className="text-sm text-muted mb-1">{a.questionText}</div>
                    <div className="text-sm font-medium">
                      {a.questionType === "MULTIPLE_CHOICE" ? (
                        <span className="bg-primary-light text-primary px-2.5 py-0.5 rounded-lg text-xs font-semibold">
                          {a.value}
                        </span>
                      ) : (
                        <span className="italic text-foreground">&quot;{a.value}&quot;</span>
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
