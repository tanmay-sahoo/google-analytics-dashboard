import { prisma } from "@/lib/prisma";
import AdminSettingsClient from "@/components/AdminSettingsClient";

export default async function AdminSettingsPage() {
  const setting = await prisma.ingestionSetting.findUnique({
    where: { key: "default" }
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate/60">Configure ingestion schedules, AI suggestions, and database visibility.</p>
      </div>
      <AdminSettingsClient
        ingestion={{
          enabled: setting?.enabled ?? false,
          intervalMins: setting?.intervalMins ?? 1440,
          lastRunAt: setting?.lastRunAt ? setting.lastRunAt.toISOString() : null
        }}
      />
    </div>
  );
}
