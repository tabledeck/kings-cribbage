import type { ReactNode } from "react";

interface ScrollProps {
  children: ReactNode;
  className?: string;
}

/** Parchment modal panel — used for modals and round-end summaries */
export function Scroll({ children, className = "" }: ScrollProps) {
  return (
    <div className={`td-modal ${className}`}>
      {children}
    </div>
  );
}
