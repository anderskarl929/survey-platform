"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [studentNumber, setStudentNumber] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: Number(studentNumber),
          courseCode: courseCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Inloggning misslyckades");
        setLoading(false);
        return;
      }

      router.push("/student");
    } catch {
      setError("Kunde inte ansluta till servern. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Logga in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-student-number" className="block text-sm font-medium mb-1">Elevnummer</label>
            <input
              id="login-student-number"
              type="number"
              min="1"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="T.ex. 12"
              className="w-full border rounded p-2 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="login-course-code" className="block text-sm font-medium mb-1">Kurskod</label>
            <input
              id="login-course-code"
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              placeholder="T.ex. MAT7A"
              className="w-full border rounded p-2 text-sm font-mono uppercase tracking-wider"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !studentNumber || !courseCode}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Loggar in..." : "Logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
