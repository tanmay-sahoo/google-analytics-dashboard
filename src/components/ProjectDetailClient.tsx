"use client";

import { useEffect, useState } from "react";

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
  const [ga4Properties, setGa4Properties] = useState<
    { id: string; displayName: string; accountName?: string }[]
  >([]);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [merchantAccounts, setMerchantAccounts] = useState<{ id: string; name: string }[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const cacheKey = "mdh_ga4_properties_cache";
  const cacheTimeKey = "mdh_ga4_properties_cache_time";
  const merchantCacheKey = "mdh_merchant_accounts_cache";
  const merchantCacheTimeKey = "mdh_merchant_accounts_cache_time";
  const cacheTtlMs = 6 * 60 * 60 * 1000;

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

  async function saveSource(type: "GA4" | "ADS" | "MERCHANT", externalId: string) {
    if (!externalId || externalId.trim().length < 2) {
      return;
    }
    setMessage(null);
    const response = await fetch("/api/datasources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, type, externalId })
    });

    if (response.ok) {
      setMessage("Data source saved.");
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save data source.");
    }
  }

  async function syncNow() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/metrics/sync", {
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
    const response = await fetch("/api/integrations/ga4/properties");
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
    const response = await fetch("/api/integrations/merchant/imported");
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

  async function deleteProject() {
    setDeleteError(null);
    if (confirmName.trim() !== projectName) {
      setDeleteError("Project name does not match.");
      return;
    }
    setDeleteLoading(true);
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/projects";
      return;
    }
    const data = await response.json().catch(() => ({}));
    setDeleteError(data.error ?? "Failed to delete project.");
    setDeleteLoading(false);
  }

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
              value={ga4Id ?? ""}
              onChange={(event) => saveSource("GA4", event.target.value)}
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
              defaultValue={ga4Id ?? ""}
              onBlur={(event) => saveSource("GA4", event.target.value)}
              placeholder="Or enter property ID manually"
            />
            <button className="btn-outline w-fit" type="button" onClick={loadGa4Properties}>
              {ga4Loading ? "Loading..." : "Fetch GA4 properties"}
            </button>
          </div>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Google Ads Customer ID</div>
          <input
            className="input"
            defaultValue={adsId ?? ""}
            onBlur={(event) => saveSource("ADS", event.target.value)}
            placeholder="e.g. 123-456-7890"
          />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Merchant Center Account ID</div>
          <div className="flex flex-col gap-2">
            <select
              className="input"
              value={merchantId ?? ""}
              onChange={(event) => saveSource("MERCHANT", event.target.value)}
            >
              <option value="">Select Merchant account</option>
              {merchantAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                  disabled={assignedMerchantIds.includes(account.id) && account.id !== merchantId}
                >
                  {account.name} - {account.id}
                  {assignedMerchantIds.includes(account.id) && account.id !== merchantId ? " (in use)" : ""}
                </option>
              ))}
            </select>
            <input
              className="input"
              defaultValue={merchantId ?? ""}
              onBlur={(event) => saveSource("MERCHANT", event.target.value)}
              placeholder="Or enter Merchant ID manually"
            />
            <button className="btn-outline w-fit" type="button" onClick={loadMerchantAccounts}>
              {merchantLoading ? "Loading..." : "Refresh Merchant accounts"}
            </button>
          </div>
        </label>
      </div>
      <div className="text-xs text-slate/50">
        OAuth connection is managed in Admin -> Integrations.
      </div>
      {message ? <div className="text-sm text-slate/60">{message}</div> : null}

      {role === "ADMIN" ? (
        <div className="pt-4">
          <button className="btn-outline" onClick={() => setShowDelete(true)}>
            Delete project
          </button>
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
              {deleteError ? <div className="text-sm text-red-600">{deleteError}</div> : null}
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary"
                  disabled={deleteLoading}
                  onClick={deleteProject}
                >
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
