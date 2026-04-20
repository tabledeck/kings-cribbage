import type { CSSProperties } from "react";

interface CrownIconProps {
  className?: string;
  style?: CSSProperties;
}

export function CrownIcon({ className = "", style }: CrownIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M2 17h20l-2-9-5 5-3-8-3 8-5-5-2 9z" />
      <path d="M2 17h20" strokeWidth="1" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
