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

type NavItem = { href: string; icon: typeof LayoutGrid; key: string };

const workspaceLinks: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, key: "dashboard" },
  { href: "/projects", icon: FolderKanban, key: "projects" },
  { href: "/alerts", icon: Bell, key: "alerts" }
];

const adminLinks: NavItem[] = [
  { href: "/admin/users", icon: Users, key: "admin-users" },
  { href: "/admin/integrations", icon: Plug, key: "admin-integrations" },
  { href: "/admin/alerts", icon: Bell, key: "admin-alerts" },
  { href: "/admin/settings", icon: Settings, key: "admin-settings" },
  { href: "/admin/logs", icon: ListChecks, key: "admin-logs" }
];

function labelKeyFor(key: string) {
  switch (key) {
    case "dashboard":
      return "dashboard" as const;
    case "projects":
      return "projects" as const;
    case "alerts":
      return "alerts" as const;
    case "admin-users":
      return "adminUsers" as const;
    case "admin-integrations":
      return "adminIntegrations" as const;
    case "admin-alerts":
      return "adminAlerts" as const;
    case "admin-settings":
      return "adminSettings" as const;
    default:
      return "adminLogs" as const;
  }
}

function navItemClasses(active: boolean, collapsed: boolean) {
  const base = "relative flex w-full items-center rounded-xl py-2 transition-colors duration-150";
  const layout = collapsed ? "justify-center px-2" : "gap-3 px-3";
  const state = active
    ? "bg-slate/10 text-slate before:absolute before:left-1 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-ocean"
    : "text-slate/80 hover:bg-slate/5 hover:text-slate";
  return `${base} ${layout} ${state}`;
}

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
  logoUrl?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const [projectOpen, setProjectOpen] = useState(true);

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const projectSectionActive =
    isPathActive("/projects") || isPathActive("/reports") || isPathActive("/merchant") || isPathActive("/ads");

  function isItemVisible(item: NavItem): boolean {
    if (role === "ADMIN") return true;
    const isAdminPath = item.href.startsWith("/admin");
    if (isAdminPath) {
      return !!(menuAccess && menuAccess.includes(item.key));
    }
    if (menuAccess && menuAccess.length > 0) {
      return menuAccess.includes(item.key);
    }
    return true;
  }

  function renderItem(item: NavItem) {
    if (!isItemVisible(item)) return null;
    const Icon = item.icon;
    const label = t(locale, labelKeyFor(item.key));

    if (item.key === "projects") {
      return (
        <div key={item.href} className="space-y-1">
          <button
            type="button"
            onClick={() => setProjectOpen((value) => !value)}
            className={navItemClasses(projectSectionActive, collapsed)}
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
                className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
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
                className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
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
                className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
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
                className={`ml-9 flex items-center rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
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
        className={navItemClasses(active, collapsed)}
      >
        <Icon size={18} />
        <span className={collapsed ? "sr-only" : ""}>{label}</span>
      </Link>
    );
  }

  const visibleWorkspace = workspaceLinks.filter(isItemVisible);
  const visibleAdmin = adminLinks.filter(isItemVisible);

  return (
    <>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-2 text-sm">
        {visibleWorkspace.length > 0 ? (
          <>
            {!collapsed ? (
              <div className="label px-3 pb-1 pt-1">Workspace</div>
            ) : (
              <div className="my-1 h-px bg-slate/10" />
            )}
            <div className="space-y-1">{visibleWorkspace.map(renderItem)}</div>
          </>
        ) : null}

        {visibleAdmin.length > 0 ? (
          <>
            {!collapsed ? (
              <div className="label px-3 pb-1 pt-4">Admin</div>
            ) : (
              <div className="my-3 h-px bg-slate/10" />
            )}
            <div className="space-y-1">{visibleAdmin.map(renderItem)}</div>
          </>
        ) : null}
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

function BrandMark({ logoUrl }: { logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ocean to-slate text-white shadow-sm ring-1 ring-white/10">
      <span className="text-[11px] font-bold tracking-tight">MDH</span>
    </div>
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
  onToggleCollapse,
  logoUrl
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  logoUrl?: string | null;
}) {
  return (
    <aside
      className={`group/sidebar sticky top-0 z-40 hidden h-screen flex-col overflow-visible border-r border-slate-200/70 bg-white/80 px-4 py-6 transition-all duration-200 lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {collapsed ? (
        <div className="relative mb-6 flex h-10 items-center justify-center">
          <div className="transition-opacity duration-150 group-hover/sidebar:opacity-0">
            <BrandMark logoUrl={logoUrl} />
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute inset-0 m-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate/15 bg-white text-slate/70 opacity-0 shadow-sm transition-opacity duration-150 hover:border-slate/30 hover:text-slate group-hover/sidebar:opacity-100"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between gap-2">
          <BrandMark logoUrl={logoUrl} />
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate/15 text-slate/70 transition-colors duration-150 hover:border-slate/30 hover:bg-slate/5 hover:text-slate"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      )}
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
