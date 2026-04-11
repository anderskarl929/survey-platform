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
    <div className="max-w-md animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 tracking-tight">Skapa ny kurs</h1>
      <form onSubmit={handleSubmit} className="card p-6">
        <label className="block text-sm font-semibold mb-2">Kursnamn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Matematik 7A"
          className="input-field mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="btn-primary"
          >
            {saving ? "Skapar..." : "Skapa kurs"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="btn-secondary"
          >
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}
