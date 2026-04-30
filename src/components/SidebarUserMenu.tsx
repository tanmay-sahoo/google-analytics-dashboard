"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { signOut } from "next-auth/react";
import { t } from "@/lib/i18n";
import FlashMessage from "@/components/FlashMessage";

const LANG_KEY = "mdh_lang";

export default function SidebarUserMenu({
  name,
  email,
  locale,
  onLocaleChange,
  compact = false
}: {
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(locale ?? "en");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const initial = (name ?? email ?? "U").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (locale) {
      setLang(locale);
    }
  }, [locale]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  async function setLanguage(value: string) {
    setLang(value);
    localStorage.setItem(LANG_KEY, value);
    onLocaleChange?.(value);
    document.documentElement.setAttribute("lang", value);
    await fetch(apiUrl("/api/account/preferences"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: value })
    });
    window.location.reload();
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError(null);
    setPwMessage(null);
    setPwLoading(true);
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword"));
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      setPwLoading(false);
      return;
    }

    const response = await fetch(apiUrl("/api/account/password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (response.ok) {
      setPwMessage("Password updated.");
      event.currentTarget?.reset();
      setShowPasswordModal(false);
      setToast("Password changed successfully.");
    } else {
      const data = await response.json().catch(() => ({}));
      setPwError(data.error ?? "Failed to update password.");
    }
    setPwLoading(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-3 text-left text-sm transition ${
          compact
            ? "h-10 w-10 justify-center rounded-full border border-transparent bg-transparent p-0"
            : "w-full rounded-2xl border border-slate/15 bg-white/80 px-3 py-3"
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-slate ${
            compact ? "bg-slate/15" : "bg-slate/10"
          }`}
        >
          {initial}
        </span>
        {!compact ? (
          <>
            <span className="flex-1">
              <span className="block font-semibold text-slate">{name ?? "User"}</span>
            </span>
            <span className="text-xs text-slate/40">▾</span>
          </>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute z-50 w-72 rounded-2xl border border-slate/10 bg-white p-3 shadow-xl ${
            compact ? "bottom-0 left-full ml-3" : "bottom-16 left-0"
          }`}
        >
          <div className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-slate/50">
            {email ?? ""}
          </div>
          <div className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-slate/50">
            {t(lang, "language")}
          </div>
          <select
            className="input"
            value={lang}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="en">{t(lang, "english")}</option>
            <option value="de">{t(lang, "german")}</option>
          </select>
          <div className="my-2 border-t border-slate/10" />
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate/70 hover:bg-slate/5"
            onClick={() => {
              setShowPasswordModal(true);
              setOpen(false);
            }}
          >
            {t(lang, "changePassword")}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate/70 hover:bg-slate/5"
          >
            {t(lang, "signOut")}
          </button>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-lg">
            <div className="flex items-center justify-between">
              <div className="label">{t(lang, "changePassword")}</div>
              <button className="btn-outline" onClick={() => setShowPasswordModal(false)}>
                Close
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
              <label className="block space-y-2 text-sm text-slate/70">
                <span>Current password</span>
                <input name="currentPassword" type="password" className="input" required />
              </label>
              <label className="block space-y-2 text-sm text-slate/70">
                <span>New password</span>
                <input name="newPassword" type="password" className="input" required />
              </label>
              <label className="block space-y-2 text-sm text-slate/70">
                <span>Re-enter new password</span>
                <input name="confirmPassword" type="password" className="input" required />
              </label>
              <FlashMessage message={pwError} tone="error" onDismiss={() => setPwError(null)} />
              <FlashMessage message={pwMessage} tone="success" onDismiss={() => setPwMessage(null)} />
              <button className="btn-primary" disabled={pwLoading}>
                {pwLoading ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm px-4">
        <FlashMessage message={toast} tone="success" onDismiss={() => setToast(null)} />
      </div>
    </div>
  );
}
