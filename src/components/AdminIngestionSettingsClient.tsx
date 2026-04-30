"use client";

import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

type IngestionSettings = {
  enabled: boolean;
  intervalMins: number;
  lastRunAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function formatUtcDate(date: Date) {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export default function AdminIngestionSettingsClient({
  initial
}: {
  initial: IngestionSettings;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [intervalMins, setIntervalMins] = useState(initial.intervalMins);
  const [lastRunAt, setLastRunAt] = useState<string | null>(initial.lastRunAt);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const nextRunAt = useMemo(() => {
    if (!enabled) return "Disabled";
    if (!lastRunAt) return "After first run";
    const next = new Date(new Date(lastRunAt).getTime() + intervalMins * 60 * 1000);
    return formatUtcDate(next);
  }, [enabled, lastRunAt, intervalMins]);
  const messageTone = inferTone(message);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/admin/ingestion-settings"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, intervalMins })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to update settings.");
    } else {
      setMessage("Settings saved.");
    }
    setSaving(false);
  }

  async function runNow() {
    setRunning(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/cron/ingest-metrics?force=1"), {
      method: "POST"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to run ingestion.");
    } else {
      const data = await response.json().catch(() => ({}));
      setLastRunAt(new Date().toISOString());
      if (data?.skipped) {
        setMessage("Ingestion skipped (disabled).");
      } else {
        setMessage("Ingestion completed.");
      }
    }
    setRunning(false);
  }

  return (
    <div className="card space-y-6">
      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-slate/10 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <span className="text-slate/70 dark:text-slate-200">Enable automatic ingestion</span>
          <button
            type="button"
            className={`relative h-6 w-11 rounded-full border transition ${
              enabled
                ? "bg-emerald-500 border-emerald-400/60"
                : "bg-slate-300 border-slate-400 dark:bg-slate-500 dark:border-slate-200"
            }`}
            onClick={() => setEnabled((current) => !current)}
          >
            <span
              className={`absolute left-1 top-1 h-4 w-4 rounded-full border border-slate-300 bg-white shadow transition dark:border-slate-200 dark:bg-slate-50 ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Interval (minutes)</div>
          <input
            type="number"
            className="input"
            min={15}
            max={10080}
            value={intervalMins}
            onChange={(event) => setIntervalMins(Number(event.target.value))}
          />
        </label>
        <div className="text-sm text-slate/60">
          <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Last run</div>
          <div className="mt-1">{formatDate(lastRunAt)}</div>
        </div>
        <div className="text-sm text-slate/60">
          <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Next run</div>
          <div className="mt-1">{nextRunAt}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="button" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
        <button className="btn-outline" type="button" onClick={runNow} disabled={running}>
          {running ? "Running..." : "Run now"}
        </button>
      </div>

      <div className="rounded-xl border border-slate/10 bg-slate/5 p-4 text-xs text-slate/60">
        <div className="font-semibold text-slate/70">How automatic ingestion works</div>
        <p className="mt-2">
          This app does not run background timers on its own. Configure a scheduler (cron or hosting provider)
          to call <span className="font-semibold text-slate">POST /api/cron/ingest-metrics</span> on your chosen interval.
          Use the same interval you set above to stay within GA4 quotas.
        </p>
      </div>
    </div>
  );
}
