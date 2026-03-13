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
  ads,
  merchant
}: {
  ga4: IntegrationStatus;
  ads: IntegrationStatus;
  merchant: IntegrationStatus;
}) {
  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [adsCustomers, setAdsCustomers] = useState<AdsCustomer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [merchantAccounts, setMerchantAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Set<string>>(new Set());
  const [selectedGa4, setSelectedGa4] = useState<Set<string>>(new Set());

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
    setSelectedGa4(new Set());
  }

  async function importGa4Projects() {
    setMessage(null);
    const body =
      selectedGa4.size > 0
        ? JSON.stringify({ propertyIds: Array.from(selectedGa4) })
        : null;
    const response = await fetch("/api/integrations/ga4/import", {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to import GA4 projects");
      return;
    }
    const data = await response.json();
    setMessage(`Imported ${data.created} projects (${data.skipped} skipped).`);
  }

  const allSelected = ga4Properties.length > 0 && selectedGa4.size === ga4Properties.length;

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

  async function loadMerchant() {
    setMessage(null);
    const response = await fetch("/api/integrations/merchant/accounts");
    if (!response.ok) {
      let errorMessage = "Failed to load Merchant accounts";
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
    setMerchantAccounts(data.accounts ?? []);
    setSelectedMerchant(new Set());
  }

  async function importMerchantAccounts() {
    if (selectedMerchant.size === 0) {
      setMessage("Select at least one Merchant account to import.");
      return;
    }
    const payload = merchantAccounts.filter((account) => selectedMerchant.has(account.id));
    const response = await fetch("/api/integrations/merchant/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: payload })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to import Merchant accounts.");
      return;
    }
    const data = await response.json();
    setMessage(`Imported ${data.imported} Merchant accounts.`);
  }

  const allMerchantsSelected =
    merchantAccounts.length > 0 && selectedMerchant.size === merchantAccounts.length;

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
              {selectedGa4.size > 0 ? "Import selected" : "Import as projects"}
            </button>
          </div>
          {ga4Properties.length ? (
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2 text-xs text-slate/60">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedGa4(new Set(ga4Properties.map((prop) => prop.id)));
                    } else {
                      setSelectedGa4(new Set());
                    }
                  }}
                />
                Select all
              </label>
              {ga4Properties.map((prop) => (
                <label
                  key={prop.id}
                  className="flex items-start gap-3 rounded-xl border border-slate/10 bg-white px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedGa4.has(prop.id)}
                    onChange={(event) => {
                      const next = new Set(selectedGa4);
                      if (event.target.checked) {
                        next.add(prop.id);
                      } else {
                        next.delete(prop.id);
                      }
                      setSelectedGa4(next);
                    }}
                  />
                  <div>
                    <div className="font-semibold text-slate">{prop.displayName}</div>
                    <div className="text-xs text-slate/60">
                      Account: {prop.accountName ?? prop.accountId ?? "-"} - Property ID: {prop.id}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <div className="card space-y-3">
          <div className="label">Merchant Center Account</div>
          <div className="text-sm text-slate/70">
            {merchant.connected ? `Connected ${merchant.email ?? ""}` : "Not connected"}
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href="/api/integrations/google/start?type=MERCHANT">
              {merchant.connected ? "Reconnect" : "Connect"}
            </a>
            {merchant.connected ? (
              <form action="/api/integrations/MERCHANT" method="post">
                <button className="btn-outline" type="submit">
                  Disconnect
                </button>
              </form>
            ) : null}
            <button className="btn-outline" type="button" onClick={loadMerchant}>
              Fetch accounts
            </button>
            {selectedMerchant.size > 0 ? (
              <button className="btn-outline" type="button" onClick={importMerchantAccounts}>
                Import selected
              </button>
            ) : null}
          </div>
          {merchantAccounts.length ? (
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2 text-xs text-slate/60">
                <input
                  type="checkbox"
                  checked={allMerchantsSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedMerchant(new Set(merchantAccounts.map((account) => account.id)));
                    } else {
                      setSelectedMerchant(new Set());
                    }
                  }}
                />
                Select all
              </label>
              {merchantAccounts.map((account) => (
                <label
                  key={account.id}
                  className="flex items-start gap-3 rounded-xl border border-slate/10 bg-white px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedMerchant.has(account.id)}
                    onChange={(event) => {
                      const next = new Set(selectedMerchant);
                      if (event.target.checked) {
                        next.add(account.id);
                      } else {
                        next.delete(account.id);
                      }
                      setSelectedMerchant(next);
                    }}
                  />
                  <div>
                    <div className="font-semibold text-slate">{account.name}</div>
                    <div className="text-xs text-slate/60">Merchant ID: {account.id}</div>
                  </div>
                </label>
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
