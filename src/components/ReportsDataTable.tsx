"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/format";
import SortableHeader from "@/components/SortableHeader";

type Column = {
  label: string;
  formatType?: "number" | "currency";
};

type Row = {
  label: string;
  values: number[];
};

export default function ReportsDataTable({
  title,
  dimensionLabel,
  columns,
  rows,
  currency
}: {
  title: string;
  dimensionLabel: string;
  columns: Column[];
  rows: Row[];
  currency?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("dimension");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(trimmed));
  }, [rows, query]);

  const totals = useMemo(() => {
    return columns.map((_, index) =>
      filtered.reduce((sum, row) => {
        const value = row.values?.[index];
        return sum + (typeof value === "number" ? value : 0);
      }, 0)
    );
  }, [filtered, columns]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  const sortedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let compare = 0;
      if (sortKey === "dimension") {
        compare = a.label.localeCompare(b.label);
      } else if (sortKey.startsWith("metric-")) {
        const columnIndex = Number(sortKey.replace("metric-", ""));
        const aValue = a.values?.[columnIndex] ?? 0;
        const bValue = b.values?.[columnIndex] ?? 0;
        compare = aValue - bValue;
      }
      if (compare === 0) compare = a.label.localeCompare(b.label);
      return compare * direction;
    });
  }, [filtered, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paged = sortedRows.slice(startIndex, startIndex + perPage);

  function formatValue(value: number, columnIndex: number) {
    const formatType = columns[columnIndex]?.formatType ?? "number";
    if (formatType === "currency") {
      return formatCurrency(value, currency);
    }
    return formatNumber(value);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate/200/70 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate/60">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              className="input h-8 w-20 px-2 py-0 text-xs"
              value={perPage}
              onChange={(event) => {
                setPerPage(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div>
            {sortedRows.length ? `${startIndex + 1}-${Math.min(startIndex + perPage, sortedRows.length)}` : "0"} of{" "}
            {sortedRows.length}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full border-collapse">
          <thead>
            <tr>
              <th className="w-10 pb-2 text-left">
                <input type="checkbox" />
              </th>
              <th className="pb-2 text-left text-xs uppercase tracking-[0.2em] text-slate/50">
                <SortableHeader
                  label={dimensionLabel}
                  active={sortKey === "dimension"}
                  direction={sortDirection}
                  onClick={() => toggleSort("dimension")}
                />
              </th>
              {columns.map((column, index) => (
                <th key={column.label} className="pb-2 text-right text-xs uppercase tracking-[0.2em] text-slate/50">
                  <SortableHeader
                    label={column.label}
                    active={sortKey === `metric-${index}`}
                    direction={sortDirection}
                    onClick={() => toggleSort(`metric-${index}`)}
                    align="right"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate/100 text-sm">
              <td className="py-3">
                <input type="checkbox" />
              </td>
              <td className="py-3 font-semibold">Total</td>
              {totals.map((total, index) => (
                <td key={index} className="py-3 text-right">
                  <div className="font-semibold">{formatValue(total, index)}</div>
                  <div className="text-xs text-slate/50">100% of total</div>
                </td>
              ))}
            </tr>
            {paged.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`} className="border-t border-slate/100 text-sm">
                <td className="py-3">
                  <input type="checkbox" />
                </td>
                <td className="py-3">{row.label}</td>
                {(row.values ?? []).map((value, index) => {
                  const total = totals[index] ?? 0;
                  const percent = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <td key={index} className="py-3 text-right">
                      <div>{formatValue(value, index)}</div>
                      <div className="text-xs text-slate/50">{percent.toFixed(2)}%</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          className="btn-outline"
          disabled={currentPage <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Prev
        </button>
        <div className="text-xs text-slate/50">{currentPage}</div>
        <button
          className="btn-outline"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

