import { CrownIcon } from "~/components/icons/CrownIcon";

interface Player {
  seat: number;
  name: string;
  score: number;
}

interface ScoreBoardProps {
  players: Player[];
  currentTurn: number;
  yourSeat: number;
  bagCount: number;
  status: string;
}

const MEDALLION_CLASS = ["gold", "silver", "bronze", "copper"] as const;

export function ScoreBoard({
  players,
  currentTurn,
  yourSeat,
  bagCount,
  status,
}: ScoreBoardProps) {
  // Find the leader (highest score, tiebreak by seat)
  const maxScore = Math.max(...players.map((p) => p.score), 0);
  const leader = players.find((p) => p.score === maxScore && maxScore > 0);

  return (
    <div className="td-ledger">
      <div className="hdr">
        <svg viewBox="0 0 24 24" fill="#3a2416">
          <path d="M4 4h16v4H4zM4 10h16v2H4zM4 14h16v2H4zM4 18h11v2H4z" />
        </svg>
        <h3>Ledger</h3>
        <span className="meta">{bagCount} in bag</span>
      </div>

      {players.map((p) => {
        const isActive = p.seat === currentTurn && status === "active";
        const isYou = p.seat === yourSeat;
        const isLeader = leader?.seat === p.seat;
        const medallionClass = MEDALLION_CLASS[p.seat] ?? "copper";

        return (
          <div
            key={p.seat}
            className={`player-row ${isActive ? "active" : ""}`}
          >
            <span className={`medallion ${medallionClass}`}>
              {p.name.charAt(0).toUpperCase()}
            </span>

            <div className="p-name">
              <span className="n flex items-center gap-1">
                {isLeader && (
                  <CrownIcon className="inline-block" style={{ color: "#c9a24a", width: 14, height: 14 }} />
                )}
                {p.name}
                {isYou ? " (you)" : ""}
              </span>
              <span className="status">
                {isActive ? "Your turn" : status === "active" ? "Waiting" : "—"}
              </span>
            </div>

            <div>
              <span className="p-score">{p.score}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
