"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface Student {
  id: number;
  number: number;
  responseCount: number;
}

export default function StudentsPage() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState("30");
  const [adding, setAdding] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}/students`);
      if (!res.ok) throw new Error("Fetch failed");
      setStudents(await res.json());
    } catch {
      showToast("Kunde inte ladda elever", "error");
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  async function handleAddBulk(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (n < 1 || n > 200) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      if (res.ok) {
        loadStudents();
        setCount("30");
      } else {
        showToast("Kunde inte lägga till elever", "error");
      }
    } catch {
      showToast("Kunde inte lägga till elever", "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Elever</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleAddBulk} className="flex items-end gap-3">
          <div>
            <label htmlFor="student-count" className="block text-sm font-medium mb-1">Antal elever</label>
            <input
              id="student-count"
              type="number"
              min="1"
              max="200"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="border rounded p-2 text-sm w-24"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Lägger till..." : "Lägg till elever (1-N)"}
          </button>
          <span className="text-xs text-gray-600">
            Skapar elevnummer 1 till {count || "N"}. Befintliga nummer hoppas över.
          </span>
        </form>
      </div>

      {loading ? (
        <div className="text-gray-500">Laddar...</div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-700">Inga elever registrerade ännu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Elevnummer</th>
                <th className="p-3">Antal enkätsvar</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">#{s.number}</td>
                  <td className="p-3">{s.responseCount}</td>
                  <td className="p-3">
                    <Link
                      href={`/admin/courses/${courseId}/students/${s.number}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Visa svar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
