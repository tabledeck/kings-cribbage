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

const SEAT_COLORS = [
  "text-emerald-400",
  "text-blue-400",
  "text-orange-400",
  "text-purple-400",
];

export function ScoreBoard({
  players,
  currentTurn,
  yourSeat,
  bagCount,
  status,
}: ScoreBoardProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-xs">Scores</span>
        <span className="text-gray-500 text-xs">{bagCount} in bag</span>
      </div>
      <div className="flex gap-4 flex-wrap">
        {players.map((p) => (
          <div
            key={p.seat}
            className={`flex flex-col items-center ${
              p.seat === currentTurn && status === "active"
                ? "ring-1 ring-emerald-500 rounded-lg p-1"
                : "p-1"
            }`}
          >
            <span className={`text-xs font-medium ${SEAT_COLORS[p.seat]}`}>
              {p.name}
              {p.seat === yourSeat ? " (you)" : ""}
            </span>
            <span className="text-white text-lg font-bold">{p.score}</span>
            {p.seat === currentTurn && status === "active" && (
              <span className="text-emerald-400 text-[10px]">▶ turn</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
