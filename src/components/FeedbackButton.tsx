"use client";

import { useState } from "react";

interface FeedbackButtonProps {
  answerId: number;
  initialFeedback: string | null;
}

export default function FeedbackButton({
  answerId,
  initialFeedback,
}: FeedbackButtonProps) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestFeedback() {
    setLoading(true);
    setError("");
    try {
      // First check if feedback already exists
      const getRes = await fetch(`/api/student/answers/${answerId}/feedback`);
      const getData = await getRes.json();

      if (getData.feedback) {
        setFeedback(getData.feedback);
        return;
      }

      // If not, request generation
      const postRes = await fetch(`/api/student/answers/${answerId}/feedback`, {
        method: "POST",
      });
      const postData = await postRes.json();

      if (postRes.ok && postData.feedback) {
        setFeedback(postData.feedback);
      } else {
        setError(postData.error || "Kunde inte generera feedback");
      }
    } catch {
      setError("Kunde inte hämta feedback");
    } finally {
      setLoading(false);
    }
  }

  if (feedback) {
    return (
      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-sm">🤖</span>
          <span className="text-xs font-semibold text-blue-700">
            AI-feedback
          </span>
        </div>
        <p className="text-sm text-blue-900 leading-relaxed">{feedback}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={requestFeedback}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <span className="animate-spin text-xs">⏳</span>
            Genererar feedback...
          </>
        ) : (
          <>
            <span>🤖</span>
            Få AI-feedback
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
