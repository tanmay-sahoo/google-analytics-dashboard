"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Bell,
  Users,
  FolderKanban,
  Plug,
  Settings,
  ListChecks,
  BarChart3,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import SidebarUserMenu from "@/components/SidebarUserMenu";
import { t } from "@/lib/i18n";

const links = [
  { href: "/dashboard", icon: LayoutGrid, key: "dashboard" },
  { href: "/projects", icon: FolderKanban, key: "projects" },
  { href: "/alerts", icon: Bell, key: "alerts" },
  { href: "/admin/users", icon: Users, key: "admin-users" },
  { href: "/admin/integrations", icon: Plug, key: "admin-integrations" },
  { href: "/admin/alerts", icon: Bell, key: "admin-alerts" },
  { href: "/admin/settings", icon: Settings, key: "admin-settings" },
  { href: "/admin/logs", icon: ListChecks, key: "admin-logs" }
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
  const pathname = usePathname() ?? "";
  const [projectOpen, setProjectOpen] = useState(true);

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const projectSectionActive =
    isPathActive("/projects") || isPathActive("/reports") || isPathActive("/merchant") || isPathActive("/ads");

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-2 text-sm">
        {links.map((item) => {
          if (role !== "ADMIN") {
            const isAdminPath = item.href.startsWith("/admin");
            if (isAdminPath) {
              // Admin-area links require explicit menuAccess.
              if (!menuAccess || !menuAccess.includes(item.key)) return null;
            } else if (menuAccess && menuAccess.length > 0 && !menuAccess.includes(item.key)) {
              // Non-admin links: respect explicit menuAccess if set.
              return null;
            }
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
              : item.key === "admin-alerts"
              ? "adminAlerts"
              : item.key === "admin-settings"
              ? "adminSettings"
              : "adminLogs"
          );

          if (item.key === "projects") {
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setProjectOpen((value) => !value)}
                  className={`flex w-full items-center rounded-xl py-2 transition ${
                    projectSectionActive
                      ? "bg-slate/10 text-slate"
                      : "text-slate/80 hover:bg-slate/5 hover:text-slate"
                  } ${
                    collapsed ? "justify-center px-2" : "gap-3 px-3"
                  }`}
                >
                  <Icon size={18} />
                  <span className={collapsed ? "sr-only" : ""}>{t(locale, "projectMenu")}</span>
                  {!collapsed ? (
                    <span className="ml-auto text-xs text-slate/40">
                      {projectOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  ) : null}
                </button>
                {!collapsed && projectOpen ? (
                  <>
                    <Link
                      href="/projects"
                      onClick={onNavigate}
                      className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition ${
                        isPathActive("/projects")
                          ? "bg-slate/10 text-slate"
                          : "text-slate/60 hover:bg-slate/5 hover:text-slate/80"
                      }`}
                    >
                      {t(locale, "projects")}
                    </Link>
                    <Link
                      href="/reports"
                      onClick={onNavigate}
                      className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition ${
                        isPathActive("/reports")
                          ? "bg-slate/10 text-slate"
                          : "text-slate/60 hover:bg-slate/5 hover:text-slate/80"
                      }`}
                    >
                      {t(locale, "reports")}
                    </Link>
                    <Link
                      href="/merchant"
                      onClick={onNavigate}
                      className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition ${
                        isPathActive("/merchant")
                          ? "bg-slate/10 text-slate"
                          : "text-slate/60 hover:bg-slate/5 hover:text-slate/80"
                      }`}
                    >
                      {t(locale, "merchant")}
                    </Link>
                    <Link
                      href="/ads"
                      onClick={onNavigate}
                      className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition ${
                        isPathActive("/ads")
                          ? "bg-slate/10 text-slate"
                          : "text-slate/60 hover:bg-slate/5 hover:text-slate/80"
                      }`}
                    >
                      <BarChart3 size={14} className="mr-2" />
                      {t(locale, "adsIntelligence")}
                    </Link>
                  </>
                ) : null}
              </div>
            );
          }

          const active = isPathActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center rounded-xl py-2 transition ${
                active ? "bg-slate/10 text-slate" : "text-slate/80 hover:bg-slate/5 hover:text-slate"
              } ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              }`}
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
      className={`sticky top-0 z-40 hidden h-screen flex-col overflow-visible border-r border-slate-200/70 bg-white/80 px-4 py-6 transition-all duration-200 lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate/20 bg-slate text-white shadow-sm transition hover:bg-slate/90 ${
          collapsed ? "self-center" : "ml-auto"
        }`}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
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
