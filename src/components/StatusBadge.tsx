"use client";

type Tone = "success" | "danger" | "warn" | "info" | "neutral" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  success:
    "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/50 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  danger:
    "bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-600/50 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30",
  warn:
    "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-600/60 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30",
  info:
    "bg-sky-500/15 text-sky-700 ring-1 ring-inset ring-sky-600/50 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30",
  accent:
    "bg-indigo-500/15 text-indigo-700 ring-1 ring-inset ring-indigo-600/50 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/30",
  neutral:
    "bg-gray-500/15 text-gray-700 ring-1 ring-inset ring-gray-500/50 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/25"
};

export function toneForStatus(value: string): Tone {
  const v = value.toUpperCase();
  if (
    v === "ACTIVE" ||
    v === "COMPLETED" ||
    v === "SUCCESS" ||
    v === "OK" ||
    v === "READ" ||
    v === "ENABLED"
  )
    return "success";
  if (
    v === "FAILED" ||
    v === "ERROR" ||
    v === "DELETE" ||
    v === "DELETED" ||
    v === "CRITICAL"
  )
    return "danger";
  if (v === "PAUSED" || v === "DISABLED" || v === "IDLE" || v === "SKIPPED") return "neutral";
  if (v === "STARTED" || v === "RUNNING" || v === "PENDING" || v === "IN_PROGRESS")
    return "info";
  if (v === "UNREAD" || v === "WARNING" || v === "WARN") return "warn";
  if (v === "CREATE" || v === "CREATED") return "success";
  if (v === "UPDATE" || v === "UPDATED" || v === "EDIT") return "info";
  if (v === "LOGIN" || v === "LOGOUT" || v === "AUTH") return "accent";
  return "neutral";
}

export default function StatusBadge({
  label,
  tone,
  className = ""
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? toneForStatus(label);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[resolved]} ${className}`}
    >
      {label}
    </span>
  );
}
