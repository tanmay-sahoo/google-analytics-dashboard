"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/notifications?limit=20"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  async function markAllRead() {
    setLoading(true);
    await fetch(apiUrl("/api/notifications/read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true })
    });
    await load();
    setLoading(false);
  }

  async function markOneRead(id: string) {
    await fetch(apiUrl("/api/notifications/read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] })
    });
    await load();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="btn-outline relative flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || unread === 0}
              className="text-xs font-medium text-ocean hover:underline disabled:opacity-40 dark:text-sky-300"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                You're all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item) => {
                  const unreadFlag = !item.readAt;
                  const content = (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium ${unreadFlag ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                      </div>
                      <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.body}</span>
                    </div>
                  );
                  return (
                    <li key={item.id} className={`px-4 py-3 ${unreadFlag ? "bg-sky-50/40 dark:bg-sky-900/20" : ""}`}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (unreadFlag) void markOneRead(item.id);
                            setOpen(false);
                          }}
                          className="block hover:opacity-80"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="block w-full text-left hover:opacity-80"
                          onClick={() => unreadFlag && void markOneRead(item.id)}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
