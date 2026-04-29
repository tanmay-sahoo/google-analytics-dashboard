"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import NotificationBell from "@/components/NotificationBell";

export default function Topbar({
  locale,
  theme: initialTheme,
  onMenuClick
}: {
  locale?: string;
  theme?: "light" | "dark";
  onMenuClick?: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme ?? "light");

  useEffect(() => {
    const next = initialTheme ?? "light";
    document.documentElement.setAttribute("data-theme", next);
    document.querySelector(".app-shell")?.setAttribute("data-theme", next);
    setTheme(next);
  }, [initialTheme]);

  async function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.querySelector(".app-shell")?.setAttribute("data-theme", next);
    await fetch("/api/account/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next })
    });
  }

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-6 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-outline lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </button>
        <div className="text-lg font-semibold tracking-tight">{t(locale, "appTitle")}</div>
      </div>
      <div className="flex items-center gap-3">
      <NotificationBell />
      <button
        className="btn-outline flex items-center gap-2"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v2" />
            <path d="M12 19v2" />
            <path d="M4.2 5.2l1.4 1.4" />
            <path d="M18.4 18.4l1.4 1.4" />
            <path d="M3 12h2" />
            <path d="M19 12h2" />
            <path d="M5.6 18.4l-1.4 1.4" />
            <path d="M19.8 5.2l-1.4 1.4" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.5 6.5 0 0 0 11.5 11.5z" />
          </svg>
        )}
        <span className="text-sm">{theme === "light" ? t(locale, "themeLight") : t(locale, "themeDark")}</span>
      </button>
      </div>
    </header>
  );
}
