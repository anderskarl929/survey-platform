"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

interface TopicWithCount {
  id: number;
  name: string;
  _count: { questions: number };
}

interface Question {
  id: number;
  text: string;
  type: string;
  topic: { id: number; name: string };
}

interface TopicComposerProps {
  apiBase: string;
  allowModeSelection: boolean;
  onCreated: () => void;
  onCancel: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TopicComposer({
  apiBase,
  allowModeSelection,
  onCreated,
  onCancel,
}: TopicComposerProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("SURVEY");
  const [lockMode, setLockMode] = useState(false);
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicCounts, setTopicCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [qRes, tRes] = await Promise.all([
          fetch(`${apiBase}/questions`),
          fetch(`${apiBase}/topics`),
        ]);
        if (!qRes.ok || !tRes.ok) throw new Error("Fetch failed");
        const q = await qRes.json();
        const t: TopicWithCount[] = await tRes.json();
        setQuestions(q);
        setTopics(t);
        setTopicCounts(Object.fromEntries(t.map((topic) => [topic.id, 0])));
      } catch {
        showToast("Kunde inte ladda ämnen och frågor", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [apiBase, showToast]);

  function selectRandomQuestions(): number[] {
    const ids: number[] = [];
    for (const [topicId, count] of Object.entries(topicCounts)) {
      if (count <= 0) continue;
      const topicQuestions = questions.filter(
        (q) => q.topic.id === Number(topicId)
      );
      const picked = shuffle(topicQuestions).slice(0, count);
      ids.push(...picked.map((q) => q.id));
    }
    return ids;
  }

  async function handleCompose() {
    if (!title.trim()) return;
    const questionIds = selectRandomQuestions();
    if (questionIds.length === 0) {
      showToast("Välj minst en fråga från något ämne", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        questionIds,
        lockMode,
      };
      if (allowModeSelection) body.mode = mode;
      const res = await fetch(`${apiBase}/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("Enkät skapad!");
        onCreated();
      } else {
        const errBody = await res.text();
        console.error("Survey create failed:", res.status, errBody);
        showToast("Kunde inte skapa enkät", "error");
      }
    } catch {
      showToast("Kunde inte skapa enkät", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalSelected = Object.values(topicCounts).reduce(
    (sum, n) => sum + n,
    0
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6 text-gray-500">
        Laddar ämnen...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="font-semibold mb-3">Sätt ihop enkät från ämnen</h3>

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
              name="compose-mode"
              value="SURVEY"
              checked={mode === "SURVEY"}
              onChange={() => setMode("SURVEY")}
            />
            <span className="text-sm">Enkät</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="compose-mode"
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
        <span className="text-sm font-medium mb-2 block">
          Välj antal frågor per ämne:
        </span>
        {topics.length === 0 ? (
          <p className="text-sm text-gray-500">Inga ämnen hittades.</p>
        ) : (
          <div className="border rounded divide-y">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="flex items-center justify-between p-3"
              >
                <div>
                  <span className="text-sm font-medium">{topic.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({topic._count.questions} tillgängliga)
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={topic._count.questions}
                  value={topicCounts[topic.id] ?? 0}
                  onChange={(e) => {
                    const val = Math.min(
                      Math.max(0, parseInt(e.target.value) || 0),
                      topic._count.questions
                    );
                    setTopicCounts((prev) => ({ ...prev, [topic.id]: val }));
                  }}
                  className="w-20 border rounded p-1 text-sm text-center"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCompose}
          disabled={submitting || totalSelected === 0 || !title.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Skapar..." : "Skapa"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Avbryt
        </button>
        <span className="text-sm text-gray-500">
          Totalt: {totalSelected} frågor
        </span>
      </div>
    </div>
  );
}
