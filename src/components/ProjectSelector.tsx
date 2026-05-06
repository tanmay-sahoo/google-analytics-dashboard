"use client";

import { useState } from "react";

export default function ProjectSelector({
  projects,
  onChange,
  value
}: {
  projects: { id: string; name: string }[];
  onChange: (id: string) => void;
  value?: string;
  // Accepted for backwards compatibility — preferences now live on the user record.
  persistKey?: string;
}) {
  const [internalValue, setInternalValue] = useState(projects[0]?.id ?? "");
  const currentValue = value ?? internalValue;

  return (
    <select
      className="input max-w-xs"
      value={currentValue}
      onChange={(event) => {
        const next = event.target.value;
        setInternalValue(next);
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
