"use client";

import { useState, type ReactNode } from "react";
import Tabs from "@/components/Tabs";

export type AdsBreakdownTab = {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
};

export default function AdsBreakdownTabs({
  tabs,
  defaultActiveKey,
  ariaLabel
}: {
  tabs: AdsBreakdownTab[];
  defaultActiveKey: string;
  ariaLabel?: string;
}) {
  const initial = tabs.some((tab) => tab.key === defaultActiveKey)
    ? defaultActiveKey
    : tabs[0]?.key ?? "";
  const [activeKey, setActiveKey] = useState(initial);

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel={ariaLabel}
        items={tabs.map(({ key, label, count }) => ({ key, label, count }))}
        activeKey={activeKey}
        buildHref={() => "#"}
        onSelect={(key) => setActiveKey(key)}
      />
      {tabs.map((tab) =>
        tab.key === activeKey ? (
          <div key={tab.key}>{tab.content}</div>
        ) : null
      )}
    </div>
  );
}
