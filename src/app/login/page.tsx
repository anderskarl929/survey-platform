"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNext(raw: string | null): string {
  if (!raw) return "/student";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/student";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Inloggning misslyckades");
        setLoading(false);
        return;
      }

      router.push(next);
    } catch {
      setError("Kunde inte ansluta till servern. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Välkommen</h1>
          <p className="text-muted text-sm mt-1">Logga in med ditt elevkonto</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold mb-1.5">Användarnamn</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="T.ex. sh1a-12"
                className="input-field"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold mb-1.5">Lösenord</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="bg-error-light text-error text-sm p-3 rounded-lg font-medium" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full py-2.5"
            >
              {loading ? "Loggar in..." : "Logga in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
