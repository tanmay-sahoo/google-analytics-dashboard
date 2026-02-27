import { ReactNode } from "react";

export default function Table({
  headers,
  rows
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <table className="table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="pb-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
