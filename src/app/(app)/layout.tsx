import AppShell from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const locale = user?.locale ?? "en";
  const theme = (user?.theme ?? "light") as "light" | "dark";

  let logoUrl: string | null = null;
  try {
    const brand = await prisma.brandSetting.findUnique({ where: { key: "default" } });
    logoUrl = brand?.logoData ?? null;
  } catch {
    // BrandSetting table may not exist yet (pre-migration); fall back to default mark.
    logoUrl = null;
  }

  return (
    <AppShell
      role={user?.role}
      menuAccess={(user?.menuAccess as string[] | null) ?? null}
      name={user?.name}
      email={user?.email}
      locale={locale}
      theme={theme}
      logoUrl={logoUrl}
    >
      {children}
    </AppShell>
  );
}
