import type { ReactNode } from "react";

interface PlaqueProps {
  children: ReactNode;
  className?: string;
}

/** Raised bone plaque — for titles, section headers, and info panels */
export function Plaque({ children, className = "" }: PlaqueProps) {
  return (
    <div className={`td-plaque ${className}`}>
      {children}
    </div>
  );
}
