"use client";

import { useEffect, useRef, useState } from "react";

export default function ProjectSelector({
  projects,
  onChange,
  value,
  persistKey
}: {
  projects: { id: string; name: string }[];
  onChange: (id: string) => void;
  value?: string;
  persistKey?: string;
}) {
  const [internalValue, setInternalValue] = useState(projects[0]?.id ?? "");
  const restoredRef = useRef(false);
  const currentValue = value ?? internalValue;

  useEffect(() => {
    if (!persistKey || restoredRef.current || typeof window === "undefined") return;
    restoredRef.current = true;
    const saved = window.localStorage.getItem(persistKey);
    if (!saved) return;
    if (!projects.some((project) => project.id === saved)) return;
    if (saved === currentValue) return;
    setInternalValue(saved);
    onChange(saved);
  }, [persistKey, projects, onChange, currentValue]);

  return (
    <select
      className="input max-w-xs"
      value={currentValue}
      onChange={(event) => {
        const next = event.target.value;
        setInternalValue(next);
        if (persistKey && typeof window !== "undefined") {
          window.localStorage.setItem(persistKey, next);
        }
        onChange(next);
      }}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}
