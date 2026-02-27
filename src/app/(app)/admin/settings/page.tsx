import { prisma } from "@/lib/prisma";
import AdminIngestionSettingsClient from "@/components/AdminIngestionSettingsClient";

export default async function AdminSettingsPage() {
  const setting = await prisma.ingestionSetting.findUnique({
    where: { key: "default" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate/60">Configure automatic data ingestion for GA4 and Ads.</p>
      </div>
      <AdminIngestionSettingsClient
        initial={{
          enabled: setting?.enabled ?? false,
          intervalMins: setting?.intervalMins ?? 1440,
          lastRunAt: setting?.lastRunAt ? setting.lastRunAt.toISOString() : null
        }}
      />
    </div>
  );
}
