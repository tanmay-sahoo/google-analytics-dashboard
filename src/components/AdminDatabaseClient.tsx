"use client";

import { useEffect, useMemo, useState } from "react";
import FlashMessage, { inferTone } from "@/components/FlashMessage";

type DbResponse = {
  tables: string[];
  table: string;
  page: number;
  take: number;
  total: number;
  totalPages: number;
  rows: Array<Record<string, unknown>>;
};

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export default function AdminDatabaseClient() {
  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState("User");
  const [page, setPage] = useState(1);
  const [take, setTake] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const query = new URLSearchParams({
      table,
      page: String(page),
      take: String(take)
    });
    const response = await fetch(`/api/admin/db?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to load DB table.");
      setLoading(false);
      return;
    }
    const data = (await response.json()) as DbResponse;
    setTables(data.tables ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setRows(data.rows ?? []);
    setMessage(null);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, page, take]);

  useEffect(() => {
    if (!tables.length) return;
    if (!tables.includes(table)) {
      setTable(tables[0]);
      setPage(1);
    }
  }, [tables, table]);

  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) return [] as string[];
    return Object.keys(first);
  }, [rows]);

  const messageTone = inferTone(message);

  return (
    <div className="card space-y-4">
      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />
      <div className="grid gap-3 md:grid-cols-4">
        <label className="space-y-2 text-sm md:col-span-2">
          <div className="text-slate/70">DB table</div>
          <select
            className="input"
            value={table}
            onChange={(event) => {
              setTable(event.target.value);
              setPage(1);
            }}
          >
            {(tables.length ? tables : [table]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate/70">Rows per page</div>
          <select
            className="input"
            value={String(take)}
            onChange={(event) => {
              setTake(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
        <div className="flex items-end text-sm text-slate/60">
          <div>
            <div>Total rows: {total}</div>
            <div>
              Page {page} of {totalPages}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-outline" onClick={() => void loadData()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button className="btn-outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>
          Prev
        </button>
        <button
          className="btn-outline"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={loading || page >= totalPages}
        >
          Next
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate/10">
        <table className="table min-w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${String(row.id ?? rowIndex)}`} className="border-t border-slate-100">
                  {columns.map((column) => (
                    <td key={`${rowIndex}-${column}`} className="max-w-[360px] truncate align-top">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate-100">
                <td className="text-slate/60" colSpan={Math.max(columns.length, 1)}>
                  No rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate/50">
        Sensitive values are masked in this viewer (password hashes, OAuth tokens, and API keys).
      </div>
    </div>
  );
}

