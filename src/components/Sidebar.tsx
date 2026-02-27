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
  onNavigate
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
  onNavigate?: () => void;
}) {
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
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-slate/70 transition hover:bg-slate/5 hover:text-slate"
            >
              <Icon size={18} />
              {t(
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
              )}
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
  onLocaleChange
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  onLocaleChange?: (value: string) => void;
}) {
  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-64 flex-col overflow-visible border-r border-slate-200/70 bg-white/80 px-6 py-8 lg:flex">
      <SidebarContent
        role={role}
        menuAccess={menuAccess}
        name={name}
        email={email}
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
    </aside>
  );
}
