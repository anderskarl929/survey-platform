"use client";

import { useState } from "react";

interface FlagButtonProps {
  questionId: number;
  initialFlagged: boolean;
  size?: "sm" | "md";
}

export default function FlagButton({
  questionId,
  initialFlagged,
  size = "sm",
}: FlagButtonProps) {
  const [flagged, setFlagged] = useState(initialFlagged);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/student/flagged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlagged(data.flagged);
      }
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses =
    size === "md"
      ? "px-3 py-1.5 text-sm gap-1.5"
      : "px-2 py-1 text-xs gap-1";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={flagged ? "Ta bort markering" : "Markera som svår"}
      className={`inline-flex items-center rounded-full border transition-colors ${sizeClasses} ${
        flagged
          ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
          : "bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
      } disabled:opacity-50`}
    >
      <span>{flagged ? "🚩" : "⚑"}</span>
      <span>{flagged ? "Markerad" : "Markera som svår"}</span>
    </button>
  );
}
