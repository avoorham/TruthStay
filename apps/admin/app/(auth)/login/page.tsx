"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    router.push("/content");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue opacity-5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <svg width="36" height="46" viewBox="0 0 56 72" fill="none">
            <rect x="6" y="18" width="44" height="14" rx="7" fill="#2ECDA7"/>
            <rect x="20" y="2" width="16" height="62" rx="8" fill="#0A7AFF"/>
            <rect x="20" y="18" width="16" height="14" fill="#5BC8D6" opacity="0.65"/>
          </svg>
          <span className="font-display text-2xl font-bold text-white tracking-tight">
            truthstay
          </span>
        </div>

        <div className="bg-navy-light rounded-2xl p-8 border border-white/10">
          <h1 className="font-display text-xl font-bold text-white mb-1">Admin Portal</h1>
          <p className="text-grey-500 text-sm mb-6">Sign in with your admin account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-grey-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@truthstay.com"
                className="w-full bg-navy border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-grey-700 focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/20 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-navy border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-grey-700 focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/20 transition"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue hover:bg-blue-dark text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-grey-700 text-xs mt-6">
          Access restricted to authorised team members only
        </p>
      </div>
    </div>
  );
}
