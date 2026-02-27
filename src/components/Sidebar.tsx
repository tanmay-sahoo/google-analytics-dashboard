"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Bell, Users, FolderKanban, Plug } from "lucide-react";
import SidebarUserMenu from "@/components/SidebarUserMenu";
import { t } from "@/lib/i18n";

const links = [
  { href: "/dashboard", icon: LayoutGrid, key: "dashboard" },
  { href: "/projects", icon: FolderKanban, key: "projects" },
  { href: "/alerts", icon: Bell, key: "alerts" },
  { href: "/admin/users", icon: Users, key: "admin-users" },
  { href: "/admin/integrations", icon: Plug, key: "admin-integrations" },
  { href: "/admin/alerts", icon: Bell, key: "admin-alerts" }
];

export function SidebarContent({
  role,
  menuAccess,
  name,
  email,
  locale,
  onLocaleChange,
  onNavigate,
  collapsed = false
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const [projectOpen, setProjectOpen] = useState(true);

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-2 text-sm">
        {links.map((item) => {
          if (item.href.startsWith("/admin") && role !== "ADMIN") {
            return null;
          }
          if (
            role !== "ADMIN" &&
            menuAccess &&
            menuAccess.length > 0 &&
            !menuAccess.includes(item.key)
          ) {
            return null;
          }
          const Icon = item.icon;
          const label = t(
            locale,
            item.key === "dashboard"
              ? "dashboard"
              : item.key === "projects"
              ? "projects"
              : item.key === "alerts"
              ? "alerts"
              : item.key === "admin-users"
              ? "adminUsers"
              : item.key === "admin-integrations"
              ? "adminIntegrations"
              : "adminAlerts"
          );

          if (item.key === "projects") {
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setProjectOpen((value) => !value)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-slate/70 transition hover:bg-slate/5 hover:text-slate"
                >
                  <Icon size={18} />
                  <span className={collapsed ? "sr-only" : ""}>{t(locale, "projectMenu")}</span>
                  {!collapsed ? <span className="ml-auto text-xs text-slate/40">{projectOpen ? "▾" : "▸"}</span> : null}
                </button>
                {!collapsed && projectOpen ? (
                  <>
                    <Link
                      href="/projects"
                      onClick={onNavigate}
                      className="ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs text-slate/50 transition hover:bg-slate/5 hover:text-slate/70"
                    >
                      {t(locale, "projects")}
                    </Link>
                    <Link
                      href="/reports"
                      onClick={onNavigate}
                      className="ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs text-slate/50 transition hover:bg-slate/5 hover:text-slate/70"
                    >
                      {t(locale, "reports")}
                    </Link>
                  </>
                ) : null}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-slate/70 transition hover:bg-slate/5 hover:text-slate"
            >
              <Icon size={18} />
              <span className={collapsed ? "sr-only" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-6">
        <SidebarUserMenu
          name={name}
          email={email}
          locale={locale}
          onLocaleChange={onLocaleChange}
          compact={collapsed}
        />
      </div>
    </>
  );
}

export default function Sidebar({
  role,
  menuAccess,
  name,
  email,
  locale,
  onLocaleChange,
  collapsed = false,
  onToggleCollapse
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <aside
      className={`sticky top-0 z-40 hidden h-screen flex-col overflow-visible border-r border-slate-200/70 bg-white/80 px-4 py-6 transition-all lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="mb-4 flex h-10 items-center justify-center rounded-xl border border-slate/10 bg-white/80 text-slate/60 hover:bg-slate/5"
        aria-label="Toggle sidebar"
      >
        {collapsed ? "»" : "«"}
      </button>
      <SidebarContent
        role={role}
        menuAccess={menuAccess}
        name={name}
        email={email}
        locale={locale}
        onLocaleChange={onLocaleChange}
        collapsed={collapsed}
      />
    </aside>
  );
}
