"use client";

import { useEffect, useState, useCallback } from "react";

interface LockOverlayProps {
  enabled: boolean;
}

export default function LockOverlay({ enabled }: LockOverlayProps) {
  const [violations, setViolations] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  const handleViolation = useCallback(() => {
    if (!enabled) return;
    setViolations((v) => v + 1);
    setShowWarning(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    function onVisibilityChange() {
      if (document.hidden) {
        handleViolation();
      }
    }

    function onBlur() {
      handleViolation();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, handleViolation]);

  if (!enabled || !showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Du lämnade quizen!
        </h2>
        <p className="text-gray-600 mb-1">
          Under pågående quiz får du inte byta flik eller fönster.
        </p>
        <p className="text-sm text-red-600 font-medium mb-4">
          Antal avvikelser: {violations}
        </p>
        <button
          onClick={() => setShowWarning(false)}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Tillbaka till quizen
        </button>
      </div>
    </div>
  );
}
