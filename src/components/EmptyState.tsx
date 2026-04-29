import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = ""
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-1.5 py-6" : "gap-3 py-10"
      } ${className}`}
    >
      {icon ? (
        <div
          className={`flex items-center justify-center rounded-full bg-slate/5 text-slate/50 ${
            compact ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          {icon}
        </div>
      ) : null}
      <div className={`${compact ? "text-xs" : "text-sm"} font-medium text-slate/70`}>{title}</div>
      {description ? (
        <div className={`max-w-sm ${compact ? "text-[11px]" : "text-xs"} text-slate/50`}>
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
