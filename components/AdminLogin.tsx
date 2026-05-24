"use client";

import { useState, FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
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
        setError((data as { error?: string }).error || "Nesprávne heslo");
      }
    } catch {
      setError("Chyba pripojenia — skús znova");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-stone-100 flex items-center justify-center mb-4">
            <Lock className="w-5 h-5 text-stone-500" strokeWidth={1.5} />
          </div>
          <h2 className="font-sans text-lg font-semibold text-stone-900 tracking-tight">
            Prihlásenie
          </h2>
          <p className="font-sans text-sm text-stone-500 mt-1">Zadaj administrátorské heslo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            autoComplete="current-password"
            disabled={loading}
            className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm
                       text-stone-900 placeholder-stone-400
                       focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-400
                       disabled:opacity-50 transition-colors"
          />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-sage-800 text-white rounded-lg font-sans text-sm
                       font-medium tracking-[0.03em] hover:bg-sage-900 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Prihlasujem…</>
            ) : "Prihlásiť sa"}
          </button>
        </form>
      </div>
    </div>
  );
}
