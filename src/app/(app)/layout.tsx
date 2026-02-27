import AppShell from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth-helpers";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const locale = user?.locale ?? "en";
  const theme = (user?.theme ?? "light") as "light" | "dark";

  return (
    <AppShell
      role={user?.role}
      menuAccess={(user?.menuAccess as string[] | null) ?? null}
      name={user?.name}
      email={user?.email}
      locale={locale}
      theme={theme}
    >
      {children}
    </AppShell>
  );
}
