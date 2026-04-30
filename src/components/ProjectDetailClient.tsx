"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

type PickerType = "GA4" | "ADS" | "MERCHANT";

export default function ProjectDetailClient({
  projectId,
  ga4Id,
  adsId,
  merchantId,
  assignedMerchantIds,
  projectName,
  role
}: {
  projectId: string;
  ga4Id?: string | null;
  adsId?: string | null;
  merchantId?: string | null;
  assignedMerchantIds: string[];
  projectName: string;
  role?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGa4Id, setSelectedGa4Id] = useState(ga4Id ?? "");
  const [selectedAdsId, setSelectedAdsId] = useState(adsId ?? "");
  const [selectedMerchantId, setSelectedMerchantId] = useState(merchantId ?? "");
  const [ga4Properties, setGa4Properties] = useState<
    { id: string; displayName: string; accountName?: string }[]
  >([]);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [merchantAccounts, setMerchantAccounts] = useState<{ id: string; name: string }[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [adsCustomers, setAdsCustomers] = useState<{ id: string; name: string }[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const cacheKey = "mdh_ga4_properties_cache";
  const cacheTimeKey = "mdh_ga4_properties_cache_time";
  const merchantCacheKey = "mdh_merchant_accounts_cache";
  const merchantCacheTimeKey = "mdh_merchant_accounts_cache_time";
  const adsCacheKey = "mdh_ads_customers_cache";
  const adsCacheTimeKey = "mdh_ads_customers_cache_time";
  const cacheTtlMs = 6 * 60 * 60 * 1000;

  useEffect(() => {
    setSelectedGa4Id(ga4Id ?? "");
  }, [ga4Id]);

  useEffect(() => {
    setSelectedAdsId(adsId ?? "");
  }, [adsId]);

  useEffect(() => {
    setSelectedMerchantId(merchantId ?? "");
  }, [merchantId]);

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as typeof ga4Properties;
        if (Array.isArray(parsed)) {
          setGa4Properties(parsed);
        }
      } catch {
        // Ignore bad cache.
      }
    }
    const lastFetched = Number(localStorage.getItem(cacheTimeKey) ?? 0);
    if (Date.now() - lastFetched > cacheTtlMs) {
      void loadGa4Properties();
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(adsCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as typeof adsCustomers;
        if (Array.isArray(parsed)) {
          setAdsCustomers(parsed);
        }
      } catch {
        // Ignore bad cache.
      }
    }
    const lastFetched = Number(localStorage.getItem(adsCacheTimeKey) ?? 0);
    if (Date.now() - lastFetched > cacheTtlMs) {
      void loadAdsCustomers();
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(merchantCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as typeof merchantAccounts;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMerchantAccounts(parsed);
        }
      } catch {
        // Ignore bad cache.
      }
    }
    void loadMerchantAccounts();
  }, []);

  async function saveSource(type: PickerType, externalId: string) {
    if (!externalId || externalId.trim().length < 2) return;

    if (type === "GA4") setSelectedGa4Id(externalId);
    if (type === "ADS") setSelectedAdsId(externalId);
    if (type === "MERCHANT") setSelectedMerchantId(externalId);

    setMessage(null);
    const response = await fetch(apiUrl("/api/datasources"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, type, externalId })
    });

    if (response.ok) {
      setMessage("Data source saved.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setMessage(data.error ?? "Failed to save data source.");
  }

  async function syncNow() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/metrics/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId })
    });

    if (response.ok) {
      setMessage("Metrics synced.");
    } else {
      setMessage("Sync failed.");
    }
    setLoading(false);
  }

  async function loadGa4Properties() {
    setGa4Loading(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/integrations/ga4/properties"));
    if (response.ok) {
      const data = await response.json();
      const list = data.properties ?? [];
      setGa4Properties(list);
      localStorage.setItem(cacheKey, JSON.stringify(list));
      localStorage.setItem(cacheTimeKey, String(Date.now()));
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load GA4 properties.");
    }
    setGa4Loading(false);
  }

  async function loadMerchantAccounts() {
    setMerchantLoading(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/integrations/merchant/imported"));
    if (response.ok) {
      const data = await response.json();
      const list = data.accounts ?? [];
      setMerchantAccounts(list);
      localStorage.setItem(merchantCacheKey, JSON.stringify(list));
      localStorage.setItem(merchantCacheTimeKey, String(Date.now()));
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load Merchant accounts.");
    }
    setMerchantLoading(false);
  }

  async function loadAdsCustomers() {
    setAdsLoading(true);
    setMessage(null);
    const response = await fetch(apiUrl("/api/integrations/ads/customers"));
    if (response.ok) {
      const data = await response.json();
      const list = (data.customers ?? []).map((item: { id: string; name?: string }) => ({
        id: item.id,
        name: item.name ?? item.id
      }));
      setAdsCustomers(list);
      localStorage.setItem(adsCacheKey, JSON.stringify(list));
      localStorage.setItem(adsCacheTimeKey, String(Date.now()));
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load Ads customers.");
    }
    setAdsLoading(false);
  }

  async function openPicker(type: PickerType) {
    setPickerType(type);
    setPickerQuery("");
    if (type === "GA4" && ga4Properties.length === 0) await loadGa4Properties();
    if (type === "ADS" && adsCustomers.length === 0) await loadAdsCustomers();
    if (type === "MERCHANT" && merchantAccounts.length === 0) await loadMerchantAccounts();
  }

  async function refreshPickerList() {
    if (pickerType === "GA4") await loadGa4Properties();
    if (pickerType === "ADS") await loadAdsCustomers();
    if (pickerType === "MERCHANT") await loadMerchantAccounts();
  }

  async function deleteProject() {
    setDeleteError(null);
    if (confirmName.trim() !== projectName) {
      setDeleteError("Project name does not match.");
      return;
    }
    setDeleteLoading(true);
    const response = await fetch(apiUrl(`/api/projects/${projectId}`), { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/projects";
      return;
    }
    const data = await response.json().catch(() => ({}));
    setDeleteError(data.error ?? "Failed to delete project.");
    setDeleteLoading(false);
  }

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();

    if (pickerType === "GA4") {
      return ga4Properties
        .map((item) => ({
          id: item.id,
          title: item.displayName,
          subtitle: `${item.accountName ?? "-"} - Property ID: ${item.id}`,
          disabled: false
        }))
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }

    if (pickerType === "ADS") {
      return adsCustomers
        .map((item) => ({
          id: item.id,
          title: item.name,
          subtitle: `Customer ID: ${item.id}`,
          disabled: false
        }))
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }

    if (pickerType === "MERCHANT") {
      return merchantAccounts
        .map((item) => {
          const inUse = assignedMerchantIds.includes(item.id) && item.id !== selectedMerchantId;
          return {
            id: item.id,
            title: item.name,
            subtitle: `Merchant ID: ${item.id}${inUse ? " (in use)" : ""}`,
            disabled: inUse
          };
        })
        .filter((item) => !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
    }

    return [];
  }, [pickerType, pickerQuery, ga4Properties, adsCustomers, merchantAccounts, assignedMerchantIds, selectedMerchantId]);

  const pickerTitle =
    pickerType === "GA4"
      ? "Select GA4 property"
      : pickerType === "ADS"
      ? "Select Ads customer"
      : "Select Merchant account";

  const pickerLoading =
    pickerType === "GA4" ? ga4Loading : pickerType === "ADS" ? adsLoading : merchantLoading;
  const messageTone = inferTone(message);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">Data sources</div>
          <p className="text-sm text-slate/60">Store GA4 property, Ads customer, and Merchant IDs.</p>
        </div>
        <button className="btn-outline" onClick={syncNow} disabled={loading}>
          {loading ? "Syncing..." : "Sync now"}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">GA4 Property ID</div>
          <div className="flex flex-col gap-2">
            <select
              className="input"
              value={selectedGa4Id}
              onChange={(event) => void saveSource("GA4", event.target.value)}
            >
              <option value="">Select GA4 property</option>
              {ga4Properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.displayName}
                  {prop.accountName ? ` - ${prop.accountName}` : ""}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={selectedGa4Id}
              onChange={(event) => setSelectedGa4Id(event.target.value)}
              onBlur={(event) => void saveSource("GA4", event.target.value)}
              placeholder="Or enter property ID manually"
            />
            <button className="btn-outline w-fit" type="button" onClick={() => void openPicker("GA4")}>
              {ga4Loading ? "Loading..." : "Fetch"}
            </button>
          </div>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Google Ads Customer ID</div>
          <div className="flex flex-col gap-2">
            <select
              className="input"
              value={selectedAdsId}
              onChange={(event) => void saveSource("ADS", event.target.value)}
            >
              <option value="">Select Ads customer</option>
              {adsCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.id}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={selectedAdsId}
              onChange={(event) => setSelectedAdsId(event.target.value)}
              onBlur={(event) => void saveSource("ADS", event.target.value)}
              placeholder="Or enter customer ID manually (e.g. 123-456-7890)"
            />
            <button className="btn-outline w-fit" type="button" onClick={() => void openPicker("ADS")}>
              {adsLoading ? "Loading..." : "Fetch"}
            </button>
          </div>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Merchant Center Account ID</div>
          <div className="flex flex-col gap-2">
            <select
              className="input"
              value={selectedMerchantId}
              onChange={(event) => void saveSource("MERCHANT", event.target.value)}
            >
              <option value="">Select Merchant account</option>
              {merchantAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                  disabled={assignedMerchantIds.includes(account.id) && account.id !== selectedMerchantId}
                >
                  {account.name} - {account.id}
                  {assignedMerchantIds.includes(account.id) && account.id !== selectedMerchantId ? " (in use)" : ""}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={selectedMerchantId}
              onChange={(event) => setSelectedMerchantId(event.target.value)}
              onBlur={(event) => void saveSource("MERCHANT", event.target.value)}
              placeholder="Or enter Merchant ID manually"
            />
            <button className="btn-outline w-fit" type="button" onClick={() => void openPicker("MERCHANT")}>
              {merchantLoading ? "Loading..." : "Fetch"}
            </button>
          </div>
        </label>
      </div>
      <div className="text-xs text-slate/50">OAuth connection is managed in Admin -&gt; Integrations.</div>
      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />

      {role === "ADMIN" ? (
        <div className="pt-4">
          <button className="btn-outline" onClick={() => setShowDelete(true)}>
            Delete project
          </button>
        </div>
      ) : null}

      {pickerType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="label">{pickerTitle}</div>
              <div className="flex items-center gap-2">
                <button className="btn-outline" onClick={() => void refreshPickerList()} disabled={pickerLoading}>
                  {pickerLoading ? "Refreshing..." : "Refresh"}
                </button>
                <button className="btn-outline" onClick={() => setPickerType(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <input
                className="input"
                placeholder="Search by name or ID"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
              />
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      if (pickerType) {
                        void saveSource(pickerType, item.id);
                      }
                      setPickerType(null);
                    }}
                    className="w-full rounded-xl border border-slate/15 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="text-sm font-semibold text-slate">{item.title}</div>
                    <div className="text-xs text-slate/60">{item.subtitle}</div>
                  </button>
                ))}
                {pickerItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate/20 p-4 text-sm text-slate/60">
                    No results found.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-lg">
            <div className="flex items-center justify-between">
              <div className="label">Delete project</div>
              <button className="btn-outline" onClick={() => setShowDelete(false)}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate/70">
              <p>
                Type <span className="font-semibold text-slate">{projectName}</span> to confirm deletion.
              </p>
              <input
                className="input"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                placeholder="Project name"
              />
              <FlashMessage message={deleteError} tone="error" onDismiss={() => setDeleteError(null)} />
              <div className="flex items-center gap-2">
                <button className="btn-primary" disabled={deleteLoading} onClick={deleteProject}>
                  {deleteLoading ? "Deleting..." : "Confirm delete"}
                </button>
                <button className="btn-outline" onClick={() => setShowDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
