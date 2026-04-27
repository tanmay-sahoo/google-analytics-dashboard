"use client";

import { useEffect, useMemo, useState } from "react";

type FlashTone = "success" | "error" | "warning" | "info";

function iconForTone(tone: FlashTone) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 7 10 17l-5-5" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
        <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

export function inferTone(message: string | null): FlashTone {
  if (!message) return "info";
  if (/(fail|error|invalid|unauthorized|forbidden|denied)/i.test(message)) return "error";
  if (/(warn|stop|skip|disabled)/i.test(message)) return "warning";
  if (/(saved|created|updated|deleted|imported|synced|completed|success)/i.test(message))
    return "success";
  return "info";
}

export default function FlashMessage({
  message,
  tone,
  onDismiss,
  durationMs = 4200
}: {
  message: string | null;
  tone?: FlashTone;
  onDismiss?: () => void;
  durationMs?: number;
}) {
  const [leaving, setLeaving] = useState(false);
  const resolvedTone = useMemo(() => tone ?? inferTone(message), [tone, message]);
  const toneClass = `flash-${resolvedTone}`;

  useEffect(() => {
    if (!message) return;
    setLeaving(false);
    const fadeOutDelay = Math.max(durationMs - 220, 500);
    const fadeTimer = window.setTimeout(() => setLeaving(true), fadeOutDelay);
    const dismissTimer = window.setTimeout(() => onDismiss?.(), durationMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`flash-message ${toneClass} flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ring-1 ring-black/5 transition-all duration-200 ${
        leaving ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="flash-message-icon inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border">
        {iconForTone(resolvedTone)}
      </span>
      <div className="flex-1 font-medium">{message}</div>
      <button
        type="button"
        onClick={() => {
          setLeaving(true);
          window.setTimeout(() => onDismiss?.(), 180);
        }}
        className="flash-message-close rounded-full px-2 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Dismiss message"
      >
        Close
      </button>
    </div>
  );
}
