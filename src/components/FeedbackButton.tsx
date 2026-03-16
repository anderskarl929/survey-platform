"use client";

interface FeedbackDisplayProps {
  feedback: string | null;
}

export default function FeedbackDisplay({ feedback }: FeedbackDisplayProps) {
  if (!feedback) return null;

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
