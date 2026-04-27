"use client";

type SortDirection = "asc" | "desc";

export default function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left"
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right" | "center";
}) {
  const justifyClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const arrow = active ? (direction === "asc" ? "^" : "v") : "<>";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center gap-1.5 ${justifyClass} text-left text-inherit transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-90 hover:opacity-100"
      }`}
      title={`Sort by ${label}`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className={`${active ? "text-ocean opacity-100" : "opacity-50"} text-[10px] leading-none`}>{arrow}</span>
    </button>
  );
}

