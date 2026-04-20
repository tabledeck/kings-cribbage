import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** suit for color treatment: heart | diamond | spade | club */
  suit?: "heart" | "diamond" | "spade" | "club";
}

/** Die-cut paper frame — bone tile with grain texture */
export function Card({ children, suit, className = "" }: CardProps) {
  return (
    <div className={`tile ${suit ?? ""} ${className}`}>
      {children}
    </div>
  );
}
