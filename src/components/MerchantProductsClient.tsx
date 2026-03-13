"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectOption = {
  id: string;
  name: string;
  merchantId: string | null;
};

type MerchantAccount = {
  id: string;
  name: string;
};

type MerchantProduct = {
  offerId: string;
  title: string;
  link?: string;
  imageLink?: string;
  availability?: string;
  priceValue?: number;
  priceCurrency?: string;
};

type ImportedProduct = {
  id: string;
  offerId: string;
  title: string;
  link: string | null;
  imageLink: string | null;
  availability: string | null;
  priceValue: number | null;
  priceCurrency: string | null;
  clicks: number | null;
  impressions: number | null;
  sales: number | null;
  revenue: number | null;
  updatedAt: string;
};

type AiSettings = {
  provider: string;
  model: string;
};

function formatNumber(value?: number | null) {
  if (value === undefined || value === null) return "-";
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatCurrency(value?: number | null, currency?: string | null) {
  if (value === undefined || value === null) return "-";
  if (!currency) return new Intl.NumberFormat("en-IN").format(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value);
}

function heuristicSuggestion(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  const keywords = tokens.filter((token) => token.length > 3).slice(0, 8);
  const suggestedTitle = tokens.slice(0, 12).join(" ");
  return {
    title: suggestedTitle || title,
    keywords: keywords.join(", ")
  };
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    total,
    totalPages,
    items: items.slice(start, start + pageSize)
  };
}

export default function MerchantProductsClient({
  projects,
  importedMerchants,
  isAdmin
}: {
  projects: ProjectOption[];
  importedMerchants: MerchantAccount[];
  isAdmin: boolean;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.find((item) => item.merchantId)?.id ?? projects[0]?.id ?? ""
  );
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(
    projects.find((item) => item.merchantId)?.merchantId ?? importedMerchants[0]?.id ?? ""
  );
  const [available, setAvailable] = useState<MerchantProduct[]>([]);
  const [imported, setImported] = useState<ImportedProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [tab, setTab] = useState<"merchants" | "products" | "insights">("merchants");
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});
  const [availableQuery, setAvailableQuery] = useState("");
  const [importedQuery, setImportedQuery] = useState("");
  const [availablePage, setAvailablePage] = useState(1);
  const [importedPage, setImportedPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<MerchantAccount | null>(null);
  const [deleteInput, setDeleteInput] = useState("");

  const currentProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadImported();
  }, [selectedProjectId]);

  useEffect(() => {
    const matching = projects.find((item) => item.id === selectedProjectId)?.merchantId;
    if (matching) {
      setSelectedMerchantId(matching);
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (!selectedMerchantId || tab !== "products") return;
    void loadAvailable();
  }, [selectedMerchantId, tab]);

  useEffect(() => {
    void loadAiSettings();
  }, []);

  async function loadAiSettings() {
    setAiLoading(true);
    const response = await fetch("/api/ai/settings");
    if (!response.ok) {
      setAiSettings(null);
      setAiLoading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    setAiSettings({
      provider: data.provider ?? "",
      model: data.model ?? ""
    });
    setAiLoading(false);
  }

  async function loadAvailable() {
    if (!selectedMerchantId) return;
    setLoading(true);
    setMessage(null);
    setLoadingCount(0);
    setAvailable([]);
    setSelected(new Set());
    setAvailablePage(1);
    const controller = new AbortController();
    setAbortController(controller);
    const collected: MerchantProduct[] = [];
    let pageToken: string | null = null;
    const seenTokens = new Set<string>();
    try {
      do {
        if (controller.signal.aborted) {
          setMessage("Fetch stopped.");
          break;
        }
        if (pageToken) {
          if (seenTokens.has(pageToken)) {
            setMessage("Stopped fetching: repeated page token from Merchant API.");
            break;
          }
          seenTokens.add(pageToken);
        }
        const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const response = await fetch(
          `/api/merchant/products?merchantId=${selectedMerchantId}&projectId=${selectedProjectId}&paged=1${tokenParam}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setMessage(data.error ?? "Failed to load Merchant products.");
          setAvailable([]);
          setLoading(false);
          return;
        }
        const data = await response.json();
        const batch = data.products ?? [];
        collected.push(...batch);
        setAvailable([...collected]);
        setLoadingCount(collected.length);
        pageToken = data.nextPageToken ?? null;
      } while (pageToken);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Fetch stopped.");
      } else {
        setMessage("Failed to fetch Merchant products.");
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }

  async function loadImported() {
    if (!selectedProjectId) return;
    const response = await fetch(`/api/merchant/products/imported?projectId=${selectedProjectId}`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setImported(data.products ?? []);
    setImportedPage(1);
  }

  async function importSelected() {
    if (!selectedProjectId || !selectedMerchantId) return;
    const payload = available.filter((item) => selected.has(item.offerId));
    if (payload.length === 0) {
      setMessage("Select at least one product to import.");
      return;
    }
    setImporting(true);
    setImportedCount(0);
    setImportTotal(payload.length);
    setMessage(null);
    const batchSize = 1000;
    try {
      for (let index = 0; index < payload.length; index += batchSize) {
        const batch = payload.slice(index, index + batchSize);
        const response = await fetch("/api/merchant/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProjectId,
            merchantId: selectedMerchantId,
            products: batch
          })
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setMessage(data.error ?? "Failed to import Merchant products.");
          setImporting(false);
          return;
        }
        setImportedCount(Math.min(index + batch.length, payload.length));
      }
      setMessage(`Imported ${payload.length} products.`);
    } finally {
      setImporting(false);
      void loadImported();
    }
  }

  async function deleteMerchantAccount(merchantId: string) {
    if (!isAdmin) return;
    const response = await fetch(`/api/integrations/merchant/imported/${merchantId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setMessage("Failed to delete Merchant account.");
      return;
    }
    window.location.reload();
  }

  async function generateAiSuggestion(product: ImportedProduct) {
    if (!aiSettings?.provider || !aiSettings?.model) {
      setMessage("AI settings are not configured yet.");
      return;
    }
    const response = await fetch("/api/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: product.title,
        offerId: product.offerId
      })
    });
    if (!response.ok) {
      setMessage("Failed to generate AI suggestion.");
      return;
    }
    const data = await response.json();
    setAiSuggestions((prev) => ({
      ...prev,
      [product.offerId]: data.suggestion ?? ""
    }));
  }

  const filteredAvailable = available.filter((item) =>
    `${item.title} ${item.offerId}`.toLowerCase().includes(availableQuery.toLowerCase())
  );
  const filteredImported = imported.filter((item) =>
    `${item.title} ${item.offerId}`.toLowerCase().includes(importedQuery.toLowerCase())
  );

  const allSelected =
    filteredAvailable.length > 0 &&
    filteredAvailable.every((item) => selected.has(item.offerId));

  const availablePageData = paginate(filteredAvailable, availablePage, rowsPerPage);
  const importedPageData = paginate(filteredImported, importedPage, rowsPerPage);

  const selling = imported.filter((item) => (item.sales ?? 0) > 0);
  const nonSelling = imported.filter((item) => (item.sales ?? 0) === 0);

  const aiReady = Boolean(aiSettings?.provider && aiSettings?.model);

  return (
    <>
      <div className="space-y-6">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-6 border-b border-slate/200/70 pb-2 dark:border-slate-700">
            {[
              { key: "merchants" as const, label: "Merchants" },
              { key: "products" as const, label: "Products" },
              { key: "insights" as const, label: "Insights" }
            ].map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`relative pb-2 text-xs font-semibold uppercase tracking-[0.28em] transition ${
                    active
                      ? "text-slate dark:text-slate-100"
                      : "text-slate/50 hover:text-slate dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute left-0 right-0 -bottom-2 h-0.5 rounded-full bg-ocean dark:bg-sky-300" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {tab === "merchants" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate/60">Select a Merchant account to manage products.</div>
              {message ? <div className="alert">{message}</div> : null}
              {importedMerchants.length === 0 ? (
                <div className="text-sm text-slate/50">No Merchant accounts imported yet.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {importedMerchants.map((account) => (
                    <div key={account.id} className="rounded-2xl border border-slate/200/70 bg-white/80 p-4">
                      <div className="font-semibold text-slate">{account.name}</div>
                      <div className="text-xs text-slate/50">Merchant ID: {account.id}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          className="btn-outline"
                          type="button"
                          onClick={() => {
                            const linkedProject = projects.find((item) => item.merchantId === account.id);
                            if (linkedProject) {
                              setSelectedProjectId(linkedProject.id);
                            }
                            setSelectedMerchantId(account.id);
                            setTab("products");
                          }}
                        >
                          View products
                        </button>
                        {isAdmin ? (
                          <button
                            className="btn-outline"
                            type="button"
                            onClick={() => {
                              setDeleteTarget(account);
                              setDeleteInput("");
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "products" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <div className="text-slate/70">Project</div>
                    <select
                      className="input min-w-[220px]"
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-slate/50">
                      Linked Merchant ID: {currentProject?.merchantId ?? "Not connected"}
                    </div>
                  </label>
                  <label className="space-y-2 text-sm">
                    <div className="text-slate/70">Merchant account</div>
                    <select
                      className="input min-w-[220px]"
                      value={selectedMerchantId}
                      onChange={(event) => setSelectedMerchantId(event.target.value)}
                    >
                      <option value="">Select Merchant account</option>
                      {importedMerchants.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} - {account.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-outline" type="button" onClick={loadAvailable} disabled={loading}>
                  {loading ? "Loading..." : "Fetch products"}
                </button>
                {loading ? (
                  <button
                    className="btn-outline"
                    type="button"
                    onClick={() => abortController?.abort()}
                  >
                    Stop
                  </button>
                ) : null}
                <button
                  className="btn-primary"
                  type="button"
                  onClick={importSelected}
                  disabled={loading || importing}
                >
                  {importing ? "Importing..." : "Import selected"}
                </button>
              </div>
            </div>

            {message ? <div className="alert">{message}</div> : null}
            {loading ? (
              <div className="text-xs text-slate/60">
                Fetching products... {loadingCount > 0 ? `${loadingCount} loaded` : "Starting"}
              </div>
            ) : null}
            {importing ? (
              <div className="text-xs text-slate/60">
                Importing products... {importedCount} of {importTotal}
              </div>
            ) : null}

              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="label">Available products</div>
                    <div className="flex items-center gap-2">
                      <input
                        className="input h-9"
                        placeholder="Search products"
                        value={availableQuery}
                        onChange={(event) => setAvailableQuery(event.target.value)}
                      />
                      <select
                        className="input h-9"
                        value={rowsPerPage}
                        onChange={(event) => setRowsPerPage(Number(event.target.value))}
                      >
                        {[10, 25, 50].map((value) => (
                          <option key={value} value={value}>
                            {value}/page
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="w-10">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelected(new Set(filteredAvailable.map((item) => item.offerId)));
                                } else {
                                  setSelected(new Set());
                                }
                              }}
                            />
                          </th>
                          <th>Product</th>
                          <th>Availability</th>
                          <th className="text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availablePageData.items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-sm text-slate/50">
                              No Merchant products loaded yet.
                            </td>
                          </tr>
                        ) : (
                          availablePageData.items.map((item) => (
                            <tr key={item.offerId} className="border-t border-slate-100">
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selected.has(item.offerId)}
                                  onChange={(event) => {
                                    const next = new Set(selected);
                                    if (event.target.checked) {
                                      next.add(item.offerId);
                                    } else {
                                      next.delete(item.offerId);
                                    }
                                    setSelected(next);
                                  }}
                                />
                              </td>
                              <td>
                                <div className="font-semibold">{item.title}</div>
                                <div className="text-xs text-slate/50">{item.offerId}</div>
                              </td>
                              <td>{item.availability ?? "-"}</td>
                              <td className="text-right">
                                {item.priceValue ? `${item.priceValue} ${item.priceCurrency ?? ""}` : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate/60">
                    <div>
                      {availablePageData.items.length === 0
                        ? "0"
                        : `${(availablePageData.page - 1) * rowsPerPage + 1}-${
                            (availablePageData.page - 1) * rowsPerPage + availablePageData.items.length
                          }`} of {availablePageData.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-outline"
                        type="button"
                        disabled={availablePageData.page <= 1}
                        onClick={() => setAvailablePage((prev) => Math.max(prev - 1, 1))}
                      >
                        Prev
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        disabled={availablePageData.page >= availablePageData.totalPages}
                        onClick={() => setAvailablePage((prev) => prev + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="label">Imported products</div>
                    <input
                      className="input h-9"
                      placeholder="Search imported"
                      value={importedQuery}
                      onChange={(event) => setImportedQuery(event.target.value)}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="text-right">Clicks</th>
                          <th className="text-right">Impressions</th>
                          <th className="text-right">Sales</th>
                          <th className="text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedPageData.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-sm text-slate/50">
                              No imported products yet.
                            </td>
                          </tr>
                        ) : (
                          importedPageData.items.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td>
                                <div className="font-semibold">{item.title}</div>
                                <div className="text-xs text-slate/50">{item.offerId}</div>
                              </td>
                              <td className="text-right">{formatNumber(item.clicks)}</td>
                              <td className="text-right">{formatNumber(item.impressions)}</td>
                              <td className="text-right">{formatNumber(item.sales)}</td>
                              <td className="text-right">{formatCurrency(item.revenue, item.priceCurrency)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate/60">
                    <div>
                      {importedPageData.items.length === 0
                        ? "0"
                        : `${(importedPageData.page - 1) * rowsPerPage + 1}-${
                            (importedPageData.page - 1) * rowsPerPage + importedPageData.items.length
                          }`} of {importedPageData.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-outline"
                        type="button"
                        disabled={importedPageData.page <= 1}
                        onClick={() => setImportedPage((prev) => Math.max(prev - 1, 1))}
                      >
                        Prev
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        disabled={importedPageData.page >= importedPageData.totalPages}
                        onClick={() => setImportedPage((prev) => prev + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "insights" ? (
            <div className="space-y-4">
              {message ? <div className="alert">{message}</div> : null}
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <div className="card space-y-2">
                  <div className="label">AI suggestions</div>
                  <div className="text-sm text-slate/60">
                    {aiLoading
                      ? "Loading AI settings..."
                      : aiReady
                      ? `Using ${aiSettings?.provider} / ${aiSettings?.model}`
                      : "AI is not configured yet."}
                  </div>
                  {isAdmin ? (
                    <a className="text-xs font-semibold text-ocean" href="/admin/settings">
                      Configure AI in Settings
                    </a>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate/10 bg-slate/5 p-4 text-sm text-slate/60">
                  <div className="font-semibold text-slate/70">Selling logic</div>
                  <p className="mt-2">
                    Products with sales greater than 0 are considered selling. If sales are 0, review Merchant
                    performance reporting or connect Ads/Analytics for conversions.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card space-y-3">
                  <div className="label">Selling products</div>
                  {selling.length === 0 ? (
                    <div className="text-sm text-slate/50">No selling products yet.</div>
                  ) : (
                    selling.map((product) => (
                      <div key={product.id} className="rounded-xl border border-slate/10 p-3">
                        <div className="font-semibold">{product.title}</div>
                        <div className="text-xs text-slate/50">Sales: {formatNumber(product.sales)}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="card space-y-3">
                  <div className="label">Non-selling products</div>
                  {nonSelling.length === 0 ? (
                    <div className="text-sm text-slate/50">No non-selling products yet.</div>
                  ) : (
                    nonSelling.map((product) => {
                      const heuristic = heuristicSuggestion(product.title);
                      return (
                        <div key={product.id} className="rounded-xl border border-slate/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{product.title}</div>
                              <div className="text-xs text-slate/50">Offer ID: {product.offerId}</div>
                            </div>
                            <button
                              className="btn-outline"
                              type="button"
                              onClick={() => generateAiSuggestion(product)}
                              disabled={!aiReady}
                            >
                              AI suggest
                            </button>
                          </div>
                          <div className="mt-3 text-xs text-slate/60">
                            <div className="font-semibold text-slate/70">Heuristic suggestion</div>
                            <div>Title: {heuristic.title}</div>
                            <div>Keywords: {heuristic.keywords}</div>
                          </div>
                          {aiSuggestions[product.offerId] ? (
                            <div className="mt-3 text-xs text-slate/60">
                              <div className="font-semibold text-slate/70">AI suggestion</div>
                              <div>{aiSuggestions[product.offerId]}</div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-slate">Delete Merchant account</div>
            <p className="mt-2 text-sm text-slate/60">
              This will remove all imported products and project connections for{" "}
              <span className="font-semibold text-slate">{deleteTarget.name}</span>.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="text-slate/70">Type the Merchant ID to confirm.</div>
              <input
                className="input"
                value={deleteInput}
                onChange={(event) => setDeleteInput(event.target.value)}
                placeholder={deleteTarget.id}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="btn-outline"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={deleteInput !== deleteTarget.id}
                onClick={() => {
                  const id = deleteTarget.id;
                  setDeleteTarget(null);
                  void deleteMerchantAccount(id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
