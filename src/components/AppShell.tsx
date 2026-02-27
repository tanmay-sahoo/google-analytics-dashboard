"use client";

import { useState } from "react";
import Sidebar, { SidebarContent } from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function AppShell({
  role,
  menuAccess,
  name,
  email,
  locale,
  theme,
  children
}: {
  role?: string;
  menuAccess?: string[] | null;
  name?: string | null;
  email?: string | null;
  locale?: string;
  theme?: "light" | "dark";
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="app-shell h-screen overflow-hidden bg-gradient-to-br from-ash via-white to-[#f4efe6]"
      data-theme={theme}
      data-locale={locale}
    >
      <div className="flex h-screen">
        <Sidebar
          role={role}
          menuAccess={menuAccess}
          name={name}
          email={email}
          locale={locale}
        />
        <div className="flex flex-1 flex-col">
          <Topbar locale={locale} theme={theme} onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-slate/10 bg-white/95 px-6 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-6 flex flex-1 flex-col">
              <SidebarContent
                role={role}
                menuAccess={menuAccess}
                name={name}
                email={email}
                locale={locale}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
