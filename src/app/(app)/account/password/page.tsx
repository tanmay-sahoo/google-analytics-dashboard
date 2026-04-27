"use client";

import { useState } from "react";
import FlashMessage from "@/components/FlashMessage";

export default function ChangePasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      currentPassword: String(formData.get("currentPassword")),
      newPassword: String(formData.get("newPassword"))
    };

    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      setMessage("Password updated.");
      event.currentTarget.reset();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to update password.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <div className="page-title">Change password</div>
          <div className="muted">Update your workspace password.</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
        <label className="block space-y-2 text-sm text-slate/70">
          <span>Current password</span>
          <input name="currentPassword" type="password" className="input" required />
        </label>
        <label className="block space-y-2 text-sm text-slate/70">
          <span>New password</span>
          <input name="newPassword" type="password" className="input" required />
        </label>
        <FlashMessage message={error} tone="error" onDismiss={() => setError(null)} />
        <FlashMessage message={message} tone="success" onDismiss={() => setMessage(null)} />
        <button className="btn-primary" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
