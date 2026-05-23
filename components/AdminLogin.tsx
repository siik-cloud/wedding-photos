"use client";

import { useState, FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error || "Nesprávne heslo"
        );
      }
    } catch {
      setError("Chyba pripojenia — skús znova");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-sage-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Prihlásenie</h2>
          <p className="text-gray-500 text-sm mt-1">Zadaj admin heslo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            autoComplete="current-password"
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base
                       focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-transparent
                       disabled:opacity-60"
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-sage-500 text-white rounded-xl font-semibold
                       hover:bg-sage-600 transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Prihlasuje sa...
              </>
            ) : (
              "Prihlásiť sa"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
