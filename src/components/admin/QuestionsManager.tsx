"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface Topic {
  id: number;
  name: string;
  _count: { questions: number };
}

interface QuestionOption {
  id: number;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  id: number;
  text: string;
  type: string;
  topic: { id: number; name: string };
  options: QuestionOption[];
}

interface QuestionsManagerProps {
  apiBase: string;
  showCorrectAnswers?: boolean;
}

export default function QuestionsManager({ apiBase, showCorrectAnswers = false }: QuestionsManagerProps) {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterTopic, setFilterTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importCourseId, setImportCourseId] = useState("");
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const needsCourseSelect = apiBase === "/api";
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState({
    text: "",
    type: "MULTIPLE_CHOICE",
    topicId: "",
    options: ["", ""],
    correctOptionIndex: 0,
  });
  const [newTopicName, setNewTopicName] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterTopic ? `?topicId=${filterTopic}` : "";
      const fetches: Promise<Response>[] = [
        fetch(`${apiBase}/questions${params}`),
        fetch(`${apiBase}/topics`),
      ];
      if (needsCourseSelect) fetches.push(fetch("/api/courses"));
      const [qRes, tRes, cRes] = await Promise.all(fetches);
      if (!qRes.ok || !tRes.ok) throw new Error("Fetch failed");
      setQuestions(await qRes.json());
      setTopics(await tRes.json());
      if (cRes?.ok) setCourses(await cRes.json());
    } catch {
      showToast("Kunde inte ladda data", "error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, filterTopic, showToast, needsCourseSelect]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleImport() {
    if (!csvContent.trim()) return;
    if (needsCourseSelect && !importCourseId) {
      showToast("Välj en kurs att importera till", "error");
      return;
    }
    setImporting(true);
    try {
      const body: Record<string, unknown> = { csvContent };
      if (needsCourseSelect) body.courseId = Number(importCourseId);
      const res = await fetch(`${apiBase}/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.imported} frågor importerade!`);
        setCsvContent("");
        setShowImport(false);
        loadData();
      } else {
        showToast(data.error || "Import misslyckades", "error");
      }
    } catch {
      showToast("Import misslyckades", "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvContent(text);
  }

  async function handleAddTopic() {
    if (!newTopicName.trim()) return;
    try {
      const res = await fetch(`${apiBase}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTopicName.trim() }),
      });
      if (res.ok) {
        setNewTopicName("");
        loadData();
      } else {
        showToast("Kunde inte skapa ämne", "error");
      }
    } catch {
      showToast("Kunde inte skapa ämne", "error");
    }
  }

  async function handleAddQuestion() {
    if (!newQ.text.trim() || !newQ.topicId) return;
    const options =
      newQ.type === "MULTIPLE_CHOICE"
        ? newQ.options.filter((o) => o.trim())
        : [];
    try {
      const res = await fetch(`${apiBase}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newQ,
          topicId: Number(newQ.topicId),
          options,
        }),
      });
      if (res.ok) {
        setNewQ({ text: "", type: "MULTIPLE_CHOICE", topicId: "", options: ["", ""], correctOptionIndex: 0 });
        setShowAdd(false);
        loadData();
      } else {
        showToast("Kunde inte spara fråga", "error");
      }
    } catch {
      showToast("Kunde inte spara fråga", "error");
    }
  }

  async function handleDeleteQuestion(id: number) {
    if (!confirm("Är du säker? Frågan och alla tillhörande svar raderas.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${apiBase}/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Fråga raderad");
        loadData();
      } else {
        let msg = "Kunde inte radera fråga";
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch {
          msg = `Serverfel (${res.status})`;
        }
        showToast(msg, "error");
      }
    } catch (err) {
      console.error("Delete question error:", err);
      showToast("Kunde inte radera fråga — nätverksfel", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Radera ${selectedIds.size} frågor? Alla tillhörande svar raderas också.`)) return;
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`${apiBase}/questions/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (deleted > 0) showToast(`${deleted} frågor raderade`);
    if (failed > 0) showToast(`${failed} frågor kunde inte raderas`, "error");
    loadData();
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Frågebank</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Lägg till fråga
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            Importera CSV
          </button>
        </div>
      </div>

      {showImport && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold mb-2">Importera frågor från CSV</h3>
          <p className="text-sm text-gray-700 mb-3">
            Format: topic, type, text, option1, option2, option3, option4
          </p>
          {needsCourseSelect && (
            <select
              value={importCourseId}
              onChange={(e) => setImportCourseId(e.target.value)}
              className="border rounded p-2 text-sm mb-3 block"
            >
              <option value="">Välj kurs...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={6}
            placeholder={"topic,type,text,option1,option2,option3,option4,correctAnswer\nMatematik,MULTIPLE_CHOICE,Vad är 2+2?,3,4,5,6,4"}
            className="w-full border rounded p-2 text-sm font-mono mb-3"
          />
          <p className="text-xs text-gray-500 mb-2">Eller ladda upp en CSV-fil:</p>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-3 block text-sm" />
          <button
            onClick={handleImport}
            disabled={importing || !csvContent.trim()}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? "Importerar..." : "Importera"}
          </button>
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold mb-3">Ny fråga</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={newQ.topicId}
              onChange={(e) => setNewQ({ ...newQ, topicId: e.target.value })}
              className="border rounded p-2 text-sm"
            >
              <option value="">Välj ämne...</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Nytt ämne..."
                className="border rounded p-2 text-sm flex-1"
              />
              <button onClick={handleAddTopic} className="bg-gray-200 px-3 rounded text-sm hover:bg-gray-300">
                +
              </button>
            </div>
          </div>
          <select
            value={newQ.type}
            onChange={(e) => setNewQ({ ...newQ, type: e.target.value })}
            className="border rounded p-2 text-sm mb-3 block"
          >
            <option value="MULTIPLE_CHOICE">Flerval</option>
            <option value="FREE_TEXT">Fritext</option>
          </select>
          <input
            value={newQ.text}
            onChange={(e) => setNewQ({ ...newQ, text: e.target.value })}
            placeholder="Frågetext..."
            className="w-full border rounded p-2 text-sm mb-3"
          />
          {newQ.type === "MULTIPLE_CHOICE" && (
            <div className="mb-3">
              {showCorrectAnswers && (
                <label className="block text-xs text-gray-600 mb-1">Markera rätt svar med radioknappen</label>
              )}
              {newQ.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  {showCorrectAnswers && (
                    <input
                      type="radio"
                      name="correctOption"
                      checked={newQ.correctOptionIndex === i}
                      onChange={() => setNewQ({ ...newQ, correctOptionIndex: i })}
                      title="Rätt svar"
                    />
                  )}
                  <input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...newQ.options];
                      opts[i] = e.target.value;
                      setNewQ({ ...newQ, options: opts });
                    }}
                    placeholder={`Alternativ ${i + 1}`}
                    className="border rounded p-2 text-sm flex-1"
                  />
                </div>
              ))}
              <button
                onClick={() => setNewQ({ ...newQ, options: [...newQ.options, ""] })}
                className="text-blue-600 text-sm mt-1"
              >
                + Lägg till alternativ
              </button>
            </div>
          )}
          <button
            onClick={handleAddQuestion}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Spara fråga
          </button>
        </div>
      )}

      <div className="mb-4">
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          <option value="">Alla ämnen</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t._count.questions})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Laddar...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border-b border-red-200">
              <span className="text-sm text-red-700 font-medium">
                {selectedIds.size} frågor markerade
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? "Raderar..." : "Radera markerade"}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Avmarkera alla
              </button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={questions.length > 0 && selectedIds.size === questions.length}
                    onChange={toggleSelectAll}
                    title="Markera alla"
                  />
                </th>
                <th className="p-3">Fråga</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Ämne</th>
                <th className="p-3">Alternativ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-gray-700">
                    Inga frågor. Importera via CSV eller lägg till manuellt.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className={`border-b last:border-0 hover:bg-gray-50 ${selectedIds.has(q.id) ? "bg-blue-50" : ""}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelected(q.id)}
                      />
                    </td>
                    <td className="p-3">{q.text}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          q.type === "MULTIPLE_CHOICE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {q.type === "MULTIPLE_CHOICE" ? "Flerval" : "Fritext"}
                      </span>
                    </td>
                    <td className="p-3">{q.topic.name}</td>
                    <td className="p-3 text-gray-700">
                      {q.options.length > 0
                        ? showCorrectAnswers
                          ? q.options
                              .map((o, i) => (
                                <span key={o.id ?? i} className={o.isCorrect ? "font-bold text-green-700" : ""}>
                                  {o.text}
                                  {o.isCorrect ? " \u2713" : ""}
                                </span>
                              ))
                              .reduce(
                                (prev, curr, i) =>
                                  i === 0 ? [curr] : [...prev, ", ", curr],
                                [] as React.ReactNode[]
                              )
                          : q.options.map((o) => o.text).join(", ")
                        : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        disabled={deletingId === q.id}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                      >
                        {deletingId === q.id ? "Raderar..." : "Radera"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
