import type { ReactNode, ButtonHTMLAttributes } from "react";

interface BtnSecondaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
  ghost?: boolean;
}

/** Ivory secondary button; pass ghost for dashed-underline ghost variant */
export function BtnSecondary({ children, fullWidth = true, ghost = false, className = "", ...props }: BtnSecondaryProps) {
  return (
    <button
      className={`${ghost ? "btn-ghost" : "btn-secondary"} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
