export function FlipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4l4-2v4H4V4z" fill="currentColor" stroke="none" />
      <path d="M8 6c5 0 9 3.5 9 8" />
      <path d="M20 20l-4 2v-4h4v2z" fill="currentColor" stroke="none" />
      <path d="M16 18C11 18 7 14.5 7 10" />
    </svg>
  );
}
