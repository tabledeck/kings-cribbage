interface SealProps {
  count: number;
  className?: string;
}

/** Wax-seal unread badge — used on the chat trigger */
export function Seal({ count, className = "" }: SealProps) {
  if (count <= 0) return null;
  return (
    <span className={`td-chat-badge ${className}`} aria-label={`${count} unread`}>
      {count}
    </span>
  );
}
