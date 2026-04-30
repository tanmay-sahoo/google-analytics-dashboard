"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

const MAX_FILE_BYTES = 256 * 1024; // 256KB raw

export default function AdminBrandClient() {
  const [logoData, setLogoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/brand"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLogoData(typeof data.logoData === "string" ? data.logoData : null);
      }
    } finally {
      setLoading(false);
    }
  }

  function readFileAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setMessage(`File too large. Keep it under ${Math.round(MAX_FILE_BYTES / 1024)}KB.`);
      return;
    }
    const dataUri = await readFileAsDataUri(file);
    setSaving(true);
    setMessage(null);
    const res = await fetch(apiUrl("/api/admin/brand"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoData: dataUri })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to upload logo.");
      setSaving(false);
      return;
    }
    setLogoData(dataUri);
    setMessage("Logo updated. Reload the page to see it in the sidebar.");
    setSaving(false);
  }

  async function clearLogo() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(apiUrl("/api/admin/brand"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoData: null })
    });
    if (!res.ok) {
      setMessage("Failed to remove logo.");
      setSaving(false);
      return;
    }
    setLogoData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("Logo removed. Reload the page to see the change in the sidebar.");
    setSaving(false);
  }

  return (
    <div className="card space-y-5">
      <div>
        <div className="label">Brand logo</div>
        <p className="mt-1 text-xs text-slate/60">
          Shown in the sidebar header. PNG, JPEG, WebP or SVG up to 256KB. Square or 1:1 ratio works
          best.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate/10 bg-white">
          {loading ? (
            <span className="text-xs text-slate/50">…</span>
          ) : logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt="Brand logo" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-ocean to-slate text-white">
              <span className="text-[11px] font-bold tracking-tight">MDH</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-outline cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              disabled={saving || loading}
            />
            {logoData ? "Replace logo" : "Upload logo"}
          </label>
          {logoData ? (
            <button
              type="button"
              className="btn-outline"
              onClick={() => void clearLogo()}
              disabled={saving}
            >
              Remove logo
            </button>
          ) : null}
        </div>
      </div>

      <FlashMessage
        message={saving ? "Saving…" : message}
        tone={saving ? "info" : inferTone(message)}
        onDismiss={saving ? undefined : () => setMessage(null)}
      />
    </div>
  );
}
