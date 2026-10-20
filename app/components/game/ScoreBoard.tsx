import { CrownIcon } from "~/components/icons/CrownIcon";
import { WIN_SCORE_THRESHOLD } from "~/domain/game-logic";

interface Player {
  seat: number;
  name: string;
  score: number;
  connected?: boolean;
  empty?: boolean;
}

interface ScoreBoardProps {
  players: Player[];
  currentTurn: number;
  yourSeat: number;
  bagCount: number;
  status: string;
  winner?: number | null;
}

const MEDALLION_CLASS = ["gold", "silver", "bronze", "copper"] as const;

export function ScoreBoard({
  players,
  currentTurn,
  yourSeat,
  bagCount,
  status,
  winner = null,
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
        <span className="meta">
          {status === "active" || status === "finished" ? `${bagCount} in bag` : `First to ${WIN_SCORE_THRESHOLD}`}
        </span>
      </div>

      {players.map((p) => {
        const isActive = p.seat === currentTurn && status === "active" && !p.empty;
        const isYou = p.seat === yourSeat && !p.empty;
        const isLeader = leader?.seat === p.seat && !p.empty;
        const medallionClass = MEDALLION_CLASS[p.seat] ?? "copper";
        const goalPct = Math.max(0, Math.min(100, (p.score / WIN_SCORE_THRESHOLD) * 100));

        let statusLabel = "—";
        if (p.empty) statusLabel = "Open seat";
        else if (p.connected === false && status !== "waiting") statusLabel = "Disconnected";
        else if (status === "waiting") statusLabel = "Seated";
        else if (status === "guessing") statusLabel = "Guessing";
        else if (status === "finished") statusLabel = p.seat === winner ? "Winner" : "Finished";
        else if (isActive && isYou) statusLabel = "Your turn";
        else if (isActive) statusLabel = "Playing";
        else if (status === "active") statusLabel = "Waiting";

        return (
          <div
            key={p.seat}
            className={`player-row ${isActive ? "active" : ""} ${p.empty ? "is-empty" : ""}`}
          >
            <span className={`medallion ${p.empty ? "copper" : medallionClass}`} aria-hidden="true">
              {p.empty ? "?" : p.name.charAt(0).toUpperCase()}
            </span>

            <div className="p-name">
              <span className="n flex items-center gap-1">
                {isLeader && (
                  <CrownIcon className="inline-block" style={{ color: "#c9a24a", width: 14, height: 14 }} />
                )}
                {p.name}
                {isYou ? " (you)" : ""}
              </span>
              <span className="status">{statusLabel}</span>
              {!p.empty && (status === "active" || status === "finished") && (
                <span className="goal-track" aria-hidden="true">
                  <span className="goal-fill" style={{ width: `${goalPct}%` }} />
                </span>
              )}
            </div>

            <div>
              <span className="p-score">{p.empty ? "" : p.score}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
