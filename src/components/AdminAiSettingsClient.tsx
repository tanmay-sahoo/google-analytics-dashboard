"use client";

import { useEffect, useMemo, useState } from "react";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

type AiConfig = {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  isDefault: boolean;
  createdAt: string;
};

const providers = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "groq", label: "Groq" },
  { value: "gemini", label: "Gemini" }
];

export default function AdminAiSettingsClient() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    void loadConfigs();
  }, []);

  const defaultConfig = useMemo(() => configs.find((item) => item.isDefault) ?? null, [configs]);
  const messageTone = inferTone(message);

  async function loadConfigs() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/ai-configs");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load AI configs.");
      setLoading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    setConfigs(Array.isArray(data.configs) ? data.configs : []);
    setLoading(false);
  }

  async function fetchModels() {
    if (!provider || !apiKey) {
      setMessage("Select provider and enter API key first.");
      return;
    }
    setLoadingModels(true);
    setMessage(null);
    const response = await fetch("/api/admin/ai-configs/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load models.");
      setLoadingModels(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    setModels(Array.isArray(data.models) ? data.models : []);
    setLoadingModels(false);
  }

  async function createConfig() {
    if (!provider || !model || !apiKey) {
      setMessage("Provider, model, and API key are required.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/ai-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, apiKey, isDefault: setDefault })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save AI config.");
      setLoading(false);
      return;
    }
    setShowModal(false);
    setProvider("");
    setApiKey("");
    setModel("");
    setModels([]);
    setSetDefault(true);
    await loadConfigs();
    setLoading(false);
  }

  async function setDefaultConfig(id: string) {
    const response = await fetch(`/api/admin/ai-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true })
    });
    if (!response.ok) {
      setMessage("Failed to set default config.");
      return;
    }
    await loadConfigs();
  }

  async function deleteConfig(id: string) {
    const response = await fetch(`/api/admin/ai-configs/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Failed to delete AI config.");
      return;
    }
    await loadConfigs();
  }

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">AI configurations</div>
          <p className="text-sm text-slate/60">
            Add multiple providers and choose which one is default for suggestions.
          </p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setShowModal(true)}>
          + Add config
        </button>
      </div>

      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />
      {loading ? <div className="text-sm text-slate/60">Loading...</div> : null}

      {configs.length === 0 && !loading ? (
        <div className="text-sm text-slate/50">No AI configs yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {configs.map((config) => (
            <div key={config.id} className="rounded-2xl border border-slate/200/70 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate">
                  {config.provider.toUpperCase()} · {config.model}
                </div>
                {config.isDefault ? <span className="chip">Default</span> : null}
              </div>
              <div className="mt-2 text-xs text-slate/50">Added {config.createdAt}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!config.isDefault ? (
                  <button className="btn-outline" type="button" onClick={() => setDefaultConfig(config.id)}>
                    Set default
                  </button>
                ) : null}
                <button className="btn-outline" type="button" onClick={() => deleteConfig(config.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-slate">Add AI configuration</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Provider</div>
                <select className="input" value={provider} onChange={(event) => setProvider(event.target.value)}>
                  <option value="">Select provider</option>
                  {providers.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">API key</div>
                <input
                  className="input"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste API key"
                />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate/70">Model</span>
                  <button className="btn-outline" type="button" onClick={fetchModels}>
                    {loadingModels ? "Loading..." : "Fetch models"}
                  </button>
                </div>
                <input
                  className="input"
                  list="ai-models"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={loadingModels ? "Loading models..." : "Select or search model"}
                />
                <datalist id="ai-models">
                  {models.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={setDefault}
                  onChange={(event) => setSetDefault(event.target.checked)}
                />
                <span className="text-slate/70">Set as default</span>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button className="btn-outline" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={createConfig}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {defaultConfig ? (
        <div className="rounded-xl border border-slate/10 bg-slate/5 p-4 text-xs text-slate/60">
          <div className="font-semibold text-slate/70">Current default</div>
          <div className="mt-2">
            {defaultConfig.provider.toUpperCase()} · {defaultConfig.model}
          </div>
        </div>
      ) : null}
    </div>
  );
}
