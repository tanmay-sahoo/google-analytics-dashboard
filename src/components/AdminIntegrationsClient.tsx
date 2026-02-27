"use client";

import { useState } from "react";

type Ga4Property = { id: string; displayName: string; accountId?: string; accountName?: string };

type AdsCustomer = { id: string; resourceName: string; name?: string };

type IntegrationStatus = {
  connected: boolean;
  email?: string | null;
};

export default function AdminIntegrationsClient({
  ga4,
  ads
}: {
  ga4: IntegrationStatus;
  ads: IntegrationStatus;
}) {
  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [adsCustomers, setAdsCustomers] = useState<AdsCustomer[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadGa4() {
    setMessage(null);
    const response = await fetch("/api/integrations/ga4/properties");
    if (!response.ok) {
      let errorMessage = "Failed to load GA4 properties";
      try {
        const data = await response.json();
        errorMessage = data.error ?? errorMessage;
      } catch {
        // Keep default message if response isn't JSON.
      }
      setMessage(errorMessage);
      return;
    }
    const data = await response.json();
    setGa4Properties(data.properties ?? []);
  }

  async function importGa4Projects() {
    setMessage(null);
    const response = await fetch("/api/integrations/ga4/import", { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to import GA4 projects");
      return;
    }
    const data = await response.json();
    setMessage(`Imported ${data.created} projects (${data.skipped} skipped).`);
  }

  async function loadAds() {
    setMessage(null);
    const response = await fetch("/api/integrations/ads/customers");
    if (!response.ok) {
      let errorMessage = "Failed to load Ads customers";
      try {
        const data = await response.json();
        errorMessage = data.error ?? errorMessage;
      } catch {
        // Keep default message if response isn't JSON.
      }
      setMessage(errorMessage);
      return;
    }
    const data = await response.json();
    setAdsCustomers(data.customers ?? []);
  }

  return (
    <div className="space-y-6">
      {message ? <div className="text-sm text-red-600">{message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <div className="label">GA4 Workspace Account</div>
          <div className="text-sm text-slate/70">
            {ga4.connected ? `Connected ${ga4.email ?? ""}` : "Not connected"}
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/integrations/google/start?type=GA4">
              {ga4.connected ? "Reconnect" : "Connect"}
            </a>
            {ga4.connected ? (
              <form action="/api/integrations/GA4" method="post">
                <button className="btn-outline" type="submit">
                  Disconnect
                </button>
              </form>
            ) : null}
            <button className="btn-outline" type="button" onClick={loadGa4}>
              Fetch properties
            </button>
            <button className="btn-outline" type="button" onClick={importGa4Projects}>
              Import as projects
            </button>
          </div>
          {ga4Properties.length ? (
            <div className="mt-3 space-y-2 text-sm">
              {ga4Properties.map((prop) => (
                <div key={prop.id} className="rounded-xl border border-slate/10 bg-white px-3 py-2">
                  <div className="font-semibold text-slate">{prop.displayName}</div>
                  <div className="text-xs text-slate/60">
                    Account: {prop.accountName ?? prop.accountId ?? "-"} · Property ID: {prop.id}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="card space-y-3">
          <div className="label">Google Ads Workspace Account</div>
          <div className="text-sm text-slate/70">
            {ads.connected ? `Connected ${ads.email ?? ""}` : "Not connected"}
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/integrations/google/start?type=ADS">
              {ads.connected ? "Reconnect" : "Connect"}
            </a>
            {ads.connected ? (
              <form action="/api/integrations/ADS" method="post">
                <button className="btn-outline" type="submit">
                  Disconnect
                </button>
              </form>
            ) : null}
            <button className="btn-outline" type="button" onClick={loadAds}>
              Fetch customers
            </button>
          </div>
          {adsCustomers.length ? (
            <div className="mt-3 space-y-2 text-sm">
              {adsCustomers.map((customer) => (
                <div key={customer.resourceName} className="rounded-xl border border-slate/10 bg-white px-3 py-2">
                  <div className="font-semibold text-slate">{customer.name ?? customer.id}</div>
                  <div className="text-xs text-slate/60">Customer ID: {customer.id}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
