"use client";

import type { ReactNode } from "react";
import { Character } from "@/components/Character";

interface EmptyStateProps {
  characterKey?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  characterKey = "mv_smile",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3rem 1.5rem",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ marginBottom: 20, opacity: 0.95 }}>
        <Character characterKey={characterKey} size={120} framed />
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      {description && (
        <p style={{ marginBottom: 12, lineHeight: 1.6, fontSize: 14 }}>{description}</p>
      )}
      {action}
    </div>
  );
}
