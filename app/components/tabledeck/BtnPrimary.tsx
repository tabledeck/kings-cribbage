import type { ReactNode, ButtonHTMLAttributes } from "react";

interface BtnPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
}

/** Gold-foil primary button */
export function BtnPrimary({ children, fullWidth = true, className = "", ...props }: BtnPrimaryProps) {
  return (
    <button
      className={`btn-primary ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
