"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

type SmtpSummary = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string | null;
  enabled: boolean;
  hasPassword: boolean;
  updatedAt: string;
};

const DEFAULT_FORM = {
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "",
  enabled: true
};

export default function AdminSmtpClient() {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [summary, setSummary] = useState<SmtpSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/admin/smtp"));
    if (!response.ok) {
      setLoading(false);
      setMessage("Failed to load SMTP config.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.smtp) {
      const s: SmtpSummary = data.smtp;
      setSummary(s);
      setForm({
        host: s.host,
        port: s.port,
        secure: s.secure,
        username: s.username,
        password: "",
        fromEmail: s.fromEmail,
        fromName: s.fromName ?? "",
        enabled: s.enabled
      });
    } else {
      setSummary(null);
      setForm({ ...DEFAULT_FORM });
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const payload: Record<string, unknown> = {
      host: form.host,
      port: Number(form.port),
      secure: form.secure,
      username: form.username,
      fromEmail: form.fromEmail,
      fromName: form.fromName || null,
      enabled: form.enabled
    };
    if (form.password) payload.password = form.password;

    const response = await fetch(apiUrl("/api/admin/smtp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Failed to save.");
    } else {
      setMessage("SMTP configuration saved.");
      await load();
    }
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Remove SMTP configuration?")) return;
    setSaving(true);
    const response = await fetch(apiUrl("/api/admin/smtp"), { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to remove.");
    } else {
      setMessage("SMTP configuration removed.");
      await load();
    }
    setSaving(false);
  }

  async function sendTest() {
    if (!testEmail) {
      setMessage("Enter a recipient email for the test.");
      return;
    }
    setTesting(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/admin/smtp/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Test failed.");
    } else {
      setMessage(`Test email sent to ${testEmail}.`);
    }
    setTesting(false);
  }

  const tone = inferTone(message);
  const hasSaved = Boolean(summary);
  const passwordPlaceholder = hasSaved && summary?.hasPassword ? "•••••••• (leave blank to keep)" : "Enter SMTP password";

  return (
    <div className="space-y-6">
      <FlashMessage message={message} tone={tone} onDismiss={() => setMessage(null)} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">SMTP Server</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure outbound email so the application can deliver alerts and notifications to user inboxes.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((f) => ({ ...f, enabled: event.target.checked }))}
            />
            Enabled
          </label>
        </header>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Host">
              <input
                type="text"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="smtp.example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Port">
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                className={inputClass}
              />
            </Field>
            <Field label="Username">
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={passwordPlaceholder}
                className={inputClass}
              />
            </Field>
            <Field label="From email">
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
                placeholder="alerts@example.com"
                className={inputClass}
              />
            </Field>
            <Field label="From name">
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                placeholder="Marketing Data Hub"
                className={inputClass}
              />
            </Field>
            <label className="col-span-full flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))}
              />
              Use TLS (port 465)
            </label>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : hasSaved ? "Update" : "Save"}
          </button>
          {hasSaved ? (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              Remove
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Send test email</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Send a quick verification email to confirm the SMTP server credentials.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="recipient@example.com"
            className={`${inputClass} max-w-sm`}
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || !hasSaved}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/30 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";
