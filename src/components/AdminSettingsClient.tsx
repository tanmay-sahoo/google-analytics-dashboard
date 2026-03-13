"use client";

import { useState } from "react";
import AdminIngestionSettingsClient from "@/components/AdminIngestionSettingsClient";
import AdminAiSettingsClient from "@/components/AdminAiSettingsClient";

type IngestionSettings = {
  enabled: boolean;
  intervalMins: number;
  lastRunAt: string | null;
};


type TabKey = "ingestion" | "ai";

export default function AdminSettingsClient({ ingestion }: { ingestion: IngestionSettings }) {
  const [tab, setTab] = useState<TabKey>("ingestion");

  const tabs = [
    { key: "ingestion" as const, label: "Ingestion" },
    { key: "ai" as const, label: "AI config" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6 border-b border-slate/200/70 pb-2 dark:border-slate-700">
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`relative pb-2 text-xs font-semibold uppercase tracking-[0.28em] transition ${
                active
                  ? "text-slate dark:text-slate-100"
                  : "text-slate/50 hover:text-slate dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {item.label}
              {active ? (
                <span className="absolute left-0 right-0 -bottom-2 h-0.5 rounded-full bg-ocean dark:bg-sky-300" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "ingestion" ? <AdminIngestionSettingsClient initial={ingestion} /> : null}
      {tab === "ai" ? <AdminAiSettingsClient /> : null}
    </div>
  );
}
