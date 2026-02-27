"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const params = useSearchParams();
  const from = params.get("from") ?? "/dashboard";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: from
    });

    if (result?.error) {
      setError(
        result.error === "AccountInactive"
          ? "Your account is inactive. Please contact the admin."
          : "Invalid credentials"
      );
    } else if (result?.url) {
      window.location.href = result.url;
    }
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f2ec] px-6 py-10">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-[#f1d4a3]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-[#b6d8f2]/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-white/60 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-4xl items-center">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.35em] text-slate/50">Sign in</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate">Welcome back</h2>
            <p className="mt-2 text-sm text-slate/60">
              Use your workspace credentials to continue.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate/10">
            <label className="block space-y-2 text-sm text-slate/70">
              <span>Email</span>
              <input name="email" type="email" placeholder="you@company.com" className="input" required />
            </label>
            <label className="block space-y-2 text-sm text-slate/70">
              <span>Password</span>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  className="input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate/50 transition hover:text-slate"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l18 18" />
                      <path d="M10.5 10.5a2.5 2.5 0 0 0 3.5 3.5" />
                      <path d="M7.1 7.1C4.6 9 3 12 3 12s3.6 6 9 6c1.7 0 3.2-.4 4.5-1" />
                      <path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c5.4 0 9 6 9 6s-1.2 2-3.3 3.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="mt-4 text-sm text-slate/60">
            <Link className="text-ocean" href="/forgot-password">Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
