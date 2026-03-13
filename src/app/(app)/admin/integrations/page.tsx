import { prisma } from "@/lib/prisma";
import AdminIntegrationsClient from "@/components/AdminIntegrationsClient";

export default async function AdminIntegrationsPage() {
  const [ga4, ads, merchant] = await Promise.all([
    prisma.integrationSetting.findUnique({ where: { type: "GA4" } }),
    prisma.integrationSetting.findUnique({ where: { type: "ADS" } }),
    prisma.integrationSetting.findUnique({ where: { type: "MERCHANT" } })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Integrations</h1>
        <p className="text-sm text-slate/60">Connect shared OAuth accounts for GA4 and Google Ads.</p>
      </div>

      <AdminIntegrationsClient
        ga4={{ connected: Boolean(ga4?.refreshToken), email: ga4?.connectedEmail }}
        ads={{ connected: Boolean(ads?.refreshToken), email: ads?.connectedEmail }}
        merchant={{ connected: Boolean(merchant?.refreshToken), email: merchant?.connectedEmail }}
      />
    </div>
  );
}
