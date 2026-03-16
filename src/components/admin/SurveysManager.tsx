"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import TopicComposer from "./TopicComposer";

interface Topic {
  id: number;
  name: string;
}

interface QuestionOption {
  id: number;
  text: string;
}

interface Question {
  id: number;
  text: string;
  type: string;
  topic: Topic;
  options: QuestionOption[];
}

interface Survey {
  id: number;
  title: string;
  shareCode: string;
  mode?: string;
  lockMode?: boolean;
  createdAt: string;
  _count: { questions: number; responses: number };
}

interface SurveysManagerProps {
  apiBase: string;
  allowModeSelection?: boolean;
  resultsBasePath: string;
}

export default function SurveysManager({
  apiBase,
  allowModeSelection = false,
  resultsBasePath,
}: SurveysManagerProps) {
  const { showToast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState<"none" | "manual" | "compose">("none");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState("SURVEY");
  const [lockMode, setLockMode] = useState(false);
  const [filterTopic, setFilterTopic] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadSurveys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/surveys`);
      if (!res.ok) throw new Error("Fetch failed");
      setSurveys(await res.json());
    } catch {
      showToast("Kunde inte ladda enkäter", "error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, showToast]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  async function deleteSurvey(id: number) {
    if (!confirm("Är du säker? Alla svar kopplade till denna enkät/quiz raderas också.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${apiBase}/surveys/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Enkät raderad");
        loadSurveys();
      } else {
        showToast("Kunde inte radera enkät", "error");
      }
    } catch {
      showToast("Kunde inte radera enkät", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadQuestions() {
    try {
      const [qRes, tRes] = await Promise.all([
        fetch(`${apiBase}/questions`),
        fetch(`${apiBase}/topics`),
      ]);
      if (!qRes.ok || !tRes.ok) throw new Error("Fetch failed");
      setQuestions(await qRes.json());
      setTopics(await tRes.json());
    } catch {
      showToast("Kunde inte ladda frågor", "error");
    }
  }

  function openCreate() {
    setCreateMode("manual");
    loadQuestions();
  }

  function toggleQuestion(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!title.trim() || selectedIds.length === 0) return;
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        questionIds: selectedIds,
        lockMode,
      };
      if (allowModeSelection) body.mode = mode;

      const res = await fetch(`${apiBase}/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setMode("SURVEY");
        setLockMode(false);
        setSelectedIds([]);
        setCreateMode("none");
        loadSurveys();
      } else {
        showToast("Kunde inte skapa enkät", "error");
      }
    } catch {
      showToast("Kunde inte skapa enkät", "error");
    }
  }

  const filteredQuestions = filterTopic
    ? questions.filter((q) => q.topic.id === Number(filterTopic))
    : questions;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Enkäter</h1>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Skapa enkät
          </button>
          {allowModeSelection && (
            <button
              onClick={() => setCreateMode("compose")}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
            >
              Sätt ihop enkät
            </button>
          )}
        </div>
      </div>

      {createMode === "compose" && (
        <TopicComposer
          apiBase={apiBase}
          allowModeSelection={allowModeSelection}
          onCreated={() => { setCreateMode("none"); loadSurveys(); }}
          onCancel={() => setCreateMode("none")}
        />
      )}

      {createMode === "manual" && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold mb-3">Ny enkät</h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel..."
            className="w-full border rounded p-2 text-sm mb-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskrivning (valfritt)..."
            rows={2}
            className="w-full border rounded p-2 text-sm mb-3"
          />

          {allowModeSelection && (
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="SURVEY"
                  checked={mode === "SURVEY"}
                  onChange={() => setMode("SURVEY")}
                />
                <span className="text-sm">Enkät</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="QUIZ"
                  checked={mode === "QUIZ"}
                  onChange={() => setMode("QUIZ")}
                />
                <span className="text-sm">Quiz (rätt/fel-svar)</span>
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lockMode}
              onChange={(e) => setLockMode(e.target.checked)}
            />
            <span className="text-sm">🔒 Låst läge</span>
            <span className="text-xs text-gray-500">(elever kan inte byta flik under quiz)</span>
          </label>

          <div className="mb-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium">Välj frågor:</span>
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="border rounded p-1 text-sm"
              >
                <option value="">Alla ämnen</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <span className="text-sm text-gray-700">{selectedIds.length} valda</span>
            </div>
            <div className="max-h-60 overflow-y-auto border rounded">
              {filteredQuestions.map((q) => (
                <label
                  key={q.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                  />
                  <span className="text-sm flex-1">{q.text}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      q.type === "MULTIPLE_CHOICE"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {q.type === "MULTIPLE_CHOICE" ? "Flerval" : "Fritext"}
                  </span>
                  <span className="text-xs text-gray-600">{q.topic.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!title.trim() || selectedIds.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Skapa
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Laddar...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Titel</th>
                <th className="p-3">Frågor</th>
                <th className="p-3">Svar</th>
                <th className="p-3">Delningslänk</th>
                <th className="p-3">Skapad</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {surveys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-gray-700">
                    Inga enkäter skapade ännu.
                  </td>
                </tr>
              ) : (
                surveys.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      {s.title}
                      {allowModeSelection && s.mode === "QUIZ" && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                          Quiz
                        </span>
                      )}
                      {s.lockMode && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                          🔒
                        </span>
                      )}
                    </td>
                    <td className="p-3">{s._count.questions}</td>
                    <td className="p-3">{s._count.responses}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs truncate max-w-[200px]">
                          /s/{s.shareCode}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/s/${s.shareCode}`
                            );
                            setCopiedId(s.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          title="Kopiera full URL"
                        >
                          {copiedId === s.id ? "Kopierad!" : "Kopiera länk"}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      {new Date(s.createdAt).toLocaleDateString("sv-SE")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`${resultsBasePath}/${s.id}/results`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Resultat
                        </Link>
                        <button
                          onClick={() => deleteSurvey(s.id)}
                          disabled={deletingId === s.id}
                          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                        >
                          {deletingId === s.id ? "Raderar..." : "Radera"}
                        </button>
                      </div>
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
