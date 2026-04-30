"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
import Link from "next/link";
import FlashMessage from "@/components/FlashMessage";

export default function SignUpPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get("name")),
      email: String(formData.get("email")),
      password: String(formData.get("password"))
    };

    const response = await fetch(apiUrl("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Sign up failed");
    } else {
      setMessage("Account created. You can sign in now.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ash via-white to-[#f4efe6] px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-slate/50">Workspace</div>
          <h1 className="mt-2 text-3xl font-semibold">Create account</h1>
          <p className="mt-2 text-sm text-slate/60">Get access to client dashboards.</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <input name="name" placeholder="Name" className="input" />
          <input name="email" type="email" placeholder="Email" className="input" required />
          <input name="password" type="password" placeholder="Password" className="input" required />
          <FlashMessage message={error} tone="error" onDismiss={() => setError(null)} />
          <FlashMessage message={message} tone="success" onDismiss={() => setMessage(null)} />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <div className="mt-4 text-sm text-slate/60">
          Already have an account? <Link className="text-ocean" href="/signin">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
