type TabItem = {
  key: string;
  label: string;
  count?: number;
};

export default function Tabs({
  items,
  activeKey,
  buildHref,
  onSelect,
  ariaLabel
}: {
  items: TabItem[];
  activeKey: string;
  buildHref: (key: string) => string;
  onSelect?: (key: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate/10 px-4"
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const className = `relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
          active ? "text-slate" : "text-slate/60 hover:text-slate"
        }`;
        const inner = (
          <>
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active ? "bg-slate text-white" : "bg-slate/10 text-slate/60"
                }`}
              >
                {item.count}
              </span>
            ) : null}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-ocean"
              />
            ) : null}
          </>
        );

        if (onSelect) {
          return (
            <button
              type="button"
              key={item.key}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item.key)}
              className={className}
            >
              {inner}
            </button>
          );
        }

        return (
          <a
            key={item.key}
            href={buildHref(item.key)}
            role="tab"
            aria-selected={active}
            className={className}
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}
