"use client";

import { useMemo, useState } from "react";

export type PaginatedTableColumn = {
  label: string;
  align?: "left" | "right";
  className?: string;
};

export type PaginatedTableProps = {
  columns: PaginatedTableColumn[];
  rows: React.ReactNode[][];
  emptyMessage?: string;
  initialPerPage?: 10 | 25 | 50;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterRow?: (row: React.ReactNode[], query: string) => boolean;
};

const PER_PAGE_OPTIONS: ReadonlyArray<10 | 25 | 50> = [10, 25, 50];

function defaultRowFilter(row: React.ReactNode[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return row.some((cell) => {
    if (cell == null || typeof cell === "boolean") return false;
    if (typeof cell === "string" || typeof cell === "number") {
      return String(cell).toLowerCase().includes(trimmed);
    }
    return false;
  });
}

export default function PaginatedTable({
  columns,
  rows,
  emptyMessage = "No data yet.",
  initialPerPage = 10,
  searchable = false,
  searchPlaceholder = "Search...",
  filterRow = defaultRowFilter
}: PaginatedTableProps) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<10 | 25 | 50>(initialPerPage);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    return rows.filter((row) => filterRow(row, query));
  }, [rows, query, searchable, filterRow]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paged = filtered.slice(startIndex, startIndex + perPage);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate/60">
        {searchable ? (
          <input
            className="input h-9 max-w-xs text-sm"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              className="input h-8 w-20 px-2 py-0 text-xs"
              value={perPage}
              onChange={(event) => {
                setPerPage(Number(event.target.value) as 10 | 25 | 50);
                setPage(1);
              }}
            >
              {PER_PAGE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div>
            {totalRows ? `${startIndex + 1}-${Math.min(startIndex + perPage, totalRows)}` : "0"} of {totalRows}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className={`${
                    column.align === "right" ? "text-right" : "text-left"
                  } ${column.className ?? ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length ? (
              paged.map((row, rowIndex) => (
                <tr key={`row-${startIndex + rowIndex}`} className="border-t border-slate/10">
                  {row.map((cell, cellIndex) => {
                    const column = columns[cellIndex];
                    return (
                      <td
                        key={`cell-${startIndex + rowIndex}-${cellIndex}`}
                        className={column?.align === "right" ? "text-right" : ""}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate/10">
                <td colSpan={columns.length} className="py-4 text-center text-slate/50">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalRows > perPage ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-outline"
            disabled={currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Prev
          </button>
          <div className="text-xs text-slate/50">
            Page {currentPage} of {totalPages}
          </div>
          <button
            type="button"
            className="btn-outline"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
