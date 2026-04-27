"use client";

import { ReactNode, isValidElement, useMemo, useState } from "react";
import SortableHeader from "@/components/SortableHeader";

function extractSortableValue(value: ReactNode): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) {
    return value.map((item) => String(extractSortableValue(item))).join(" ");
  }
  if (isValidElement(value)) {
    return extractSortableValue((value.props as { children?: ReactNode })?.children);
  }
  return String(value);
}

export default function Table({
  headers,
  rows
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function toggleSort(index: number) {
    if (sortIndex === index) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortIndex(index);
    setSortDirection("asc");
  }

  const sortedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const leftRaw = extractSortableValue(a[sortIndex]);
      const rightRaw = extractSortableValue(b[sortIndex]);

      let compare = 0;
      if (typeof leftRaw === "number" && typeof rightRaw === "number") {
        compare = leftRaw - rightRaw;
      } else {
        compare = String(leftRaw).localeCompare(String(rightRaw), undefined, {
          numeric: true,
          sensitivity: "base"
        });
      }

      return compare * direction;
    });
  }, [rows, sortDirection, sortIndex]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <table className="table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={header} className="pb-2">
                <SortableHeader
                  label={header}
                  active={sortIndex === index}
                  direction={sortDirection}
                  onClick={() => toggleSort(index)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

