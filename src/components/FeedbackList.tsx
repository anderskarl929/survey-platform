"use client";

import { useState } from "react";

export interface FeedbackItem {
  id: number;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  items: FeedbackItem[];
  initialUnread: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FeedbackList({ items: initial, initialUnread }: Props) {
  const [items, setItems] = useState(initial);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnread);

  async function handleClick(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    const target = items.find((i) => i.id === id);
    if (target && !target.read) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, read: true } : i))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await fetch(`/api/student/assignment-feedback/${id}/read`, {
          method: "POST",
        });
      } catch {
        // best effort - kvar som "läst" i UI även om servern missar
      }
    }
  }

  return (
    <>
      {unreadCount > 0 && (
        <p className="text-sm text-muted mb-3">
          {unreadCount} oläst{unreadCount === 1 ? "" : "a"}
        </p>
      )}
      <div className="space-y-3">
        {items.map((item) => {
          const isOpen = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`card p-4 transition-all ${
                !item.read ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                className="w-full text-left"
                aria-expanded={isOpen}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold tracking-tight flex items-center gap-2">
                      {item.title}
                      {!item.read && (
                        <span className="badge bg-primary-light text-primary-dark text-xs">
                          Ny
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="text-muted text-sm shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-border-light">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {item.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
