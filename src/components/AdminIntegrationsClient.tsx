"use client";

import { useMemo, useState } from "react";

type Ga4Property = { id: string; displayName: string; accountId?: string; accountName?: string };
type AdsCustomer = { id: string; resourceName: string; name?: string };
type IntegrationStatus = {
  connected: boolean;
  email?: string | null;
};
type PickerType = "GA4" | "MERCHANT" | "ADS";

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
  const [merchantAccounts, setMerchantAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Set<string>>(new Set());
  const [selectedGa4, setSelectedGa4] = useState<Set<string>>(new Set());
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<PickerType | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [loading, setLoading] = useState<PickerType | null>(null);

  async function loadGa4() {
    setLoading("GA4");
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
      setLoading(null);
      return false;
    }
    const data = await response.json();
    setGa4Properties(data.properties ?? []);
    setSelectedGa4(new Set());
    setLoading(null);
    return true;
  }

  async function importGa4Projects() {
    setMessage(null);
    const body = selectedGa4.size > 0 ? JSON.stringify({ propertyIds: Array.from(selectedGa4) }) : null;
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
    setPickerType(null);
  }

  async function loadAds() {
    setLoading("ADS");
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
      setLoading(null);
      return false;
    }
    const data = await response.json();
    setAdsCustomers(data.customers ?? []);
    setSelectedAds(new Set());
    setLoading(null);
    return true;
  }

  async function loadMerchant() {
    setLoading("MERCHANT");
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
      setLoading(null);
      return false;
    }
    const data = await response.json();
    setMerchantAccounts(data.accounts ?? []);
    setSelectedMerchant(new Set());
    setLoading(null);
    return true;
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
    setPickerType(null);
  }

  async function openPicker(type: PickerType) {
    setPickerQuery("");
    if (type === "GA4" && ga4Properties.length === 0) {
      const ok = await loadGa4();
      if (!ok) return;
    }
    if (type === "ADS" && adsCustomers.length === 0) {
      const ok = await loadAds();
      if (!ok) return;
    }
    if (type === "MERCHANT" && merchantAccounts.length === 0) {
      const ok = await loadMerchant();
      if (!ok) return;
    }
    setPickerType(type);
  }

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (pickerType === "GA4") {
      return ga4Properties
        .map((item) => ({
          id: item.id,
          title: item.displayName,
          subtitle: `Account: ${item.accountName ?? item.accountId ?? "-"} - Property ID: ${item.id}`
        }))
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }
    if (pickerType === "ADS") {
      return adsCustomers
        .map((item) => ({
          id: item.id,
          title: item.name ?? item.id,
          subtitle: `Customer ID: ${item.id}`
        }))
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }
    if (pickerType === "MERCHANT") {
      return merchantAccounts
        .map((item) => ({
          id: item.id,
          title: item.name,
          subtitle: `Merchant ID: ${item.id}`
        }))
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }
    return [];
  }, [pickerType, pickerQuery, ga4Properties, adsCustomers, merchantAccounts]);

  const pickerTitle =
    pickerType === "GA4"
      ? "GA4 properties"
      : pickerType === "ADS"
      ? "Google Ads customers"
      : "Merchant accounts";

  const pickerSelectAllChecked =
    pickerType === "GA4"
      ? ga4Properties.length > 0 && selectedGa4.size === ga4Properties.length
      : pickerType === "MERCHANT"
      ? merchantAccounts.length > 0 && selectedMerchant.size === merchantAccounts.length
      : adsCustomers.length > 0 && selectedAds.size === adsCustomers.length;

  return (
    <div className="space-y-6">
      {message ? <div className="text-sm text-red-600">{message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <div className="label">GA4 Workspace Account</div>
          <div className="text-sm text-slate/70">{ga4.connected ? `Connected ${ga4.email ?? ""}` : "Not connected"}</div>
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
            <button className="btn-outline" type="button" onClick={() => void openPicker("GA4")}>
              {loading === "GA4" ? "Loading..." : "Fetch + select"}
            </button>
          </div>
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
            <button className="btn-outline" type="button" onClick={() => void openPicker("MERCHANT")}>
              {loading === "MERCHANT" ? "Loading..." : "Fetch + select"}
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="label">Google Ads Workspace Account</div>
          <div className="text-sm text-slate/70">{ads.connected ? `Connected ${ads.email ?? ""}` : "Not connected"}</div>
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
            <button className="btn-outline" type="button" onClick={() => void openPicker("ADS")}>
              {loading === "ADS" ? "Loading..." : "Fetch + select"}
            </button>
          </div>
        </div>
      </div>

      {pickerType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-3xl">
            <div className="flex items-center justify-between gap-2">
              <div className="label">{pickerTitle}</div>
              <button className="btn-outline" onClick={() => setPickerType(null)}>
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <input
                className="input"
                placeholder="Search by name or ID"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
              />

              <label className="flex items-center gap-2 text-xs text-slate/60">
                <input
                  type="checkbox"
                  checked={pickerSelectAllChecked}
                  onChange={(event) => {
                    if (!pickerType) return;
                    if (pickerType === "GA4") {
                      setSelectedGa4(
                        event.target.checked ? new Set(ga4Properties.map((item) => item.id)) : new Set()
                      );
                    } else if (pickerType === "MERCHANT") {
                      setSelectedMerchant(
                        event.target.checked ? new Set(merchantAccounts.map((item) => item.id)) : new Set()
                      );
                    } else {
                      setSelectedAds(
                        event.target.checked ? new Set(adsCustomers.map((item) => item.id)) : new Set()
                      );
                    }
                  }}
                />
                Select all
              </label>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {pickerItems.map((item) => {
                  const checked =
                    pickerType === "GA4"
                      ? selectedGa4.has(item.id)
                      : pickerType === "MERCHANT"
                      ? selectedMerchant.has(item.id)
                      : selectedAds.has(item.id);

                  return (
                    <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate/15 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (!pickerType) return;
                          if (pickerType === "GA4") {
                            const next = new Set(selectedGa4);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelectedGa4(next);
                          } else if (pickerType === "MERCHANT") {
                            const next = new Set(selectedMerchant);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelectedMerchant(next);
                          } else {
                            const next = new Set(selectedAds);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelectedAds(next);
                          }
                        }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate">{item.title}</div>
                        <div className="text-xs text-slate/60">{item.subtitle}</div>
                      </div>
                    </label>
                  );
                })}
                {pickerItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate/20 p-4 text-sm text-slate/60">
                    No results found.
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  className="btn-outline"
                  onClick={() => {
                    if (pickerType === "GA4") {
                      void loadGa4();
                    } else if (pickerType === "MERCHANT") {
                      void loadMerchant();
                    } else {
                      void loadAds();
                    }
                  }}
                >
                  Refresh list
                </button>
                {pickerType === "GA4" ? (
                  <button className="btn-primary" onClick={() => void importGa4Projects()}>
                    Import selected ({selectedGa4.size})
                  </button>
                ) : pickerType === "MERCHANT" ? (
                  <button className="btn-primary" onClick={() => void importMerchantAccounts()}>
                    Import selected ({selectedMerchant.size})
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => setPickerType(null)}>
                    Done ({selectedAds.size} selected)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
