"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export default function NewCoursePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const course = await res.json();
      router.push(`/admin/courses/${course.id}`);
    } else {
      const data = await res.json();
      showToast(data.error || "Kunde inte skapa kurs", "error");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Skapa ny kurs</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium mb-2">Kursnamn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Matematik 7A"
          className="w-full border rounded p-2 text-sm mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Skapar..." : "Skapa kurs"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="bg-gray-200 px-4 py-2 rounded text-sm hover:bg-gray-300"
          >
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}
