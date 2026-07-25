import React from "react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
      {children}
    </p>
  );
}
