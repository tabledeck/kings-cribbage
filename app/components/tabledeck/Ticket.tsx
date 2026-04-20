interface TicketProps {
  label: string;
  value: string | number;
  className?: string;
}

/** Raffle-ticket chip for label + value pairs (round, trick, turn, bag count) */
export function Ticket({ label, value, className = "" }: TicketProps) {
  return (
    <div className={`td-mini-plaque ${className}`}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}
