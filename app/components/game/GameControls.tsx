import type { Placement } from "~/domain/scoring";
import { scoreMove } from "~/domain/scoring";
import type { BoardState } from "~/domain/board";

interface GameControlsProps {
  stagedPlacements: Placement[];
  board: BoardState;
  isMyTurn: boolean;
  isFirstMove: boolean;
  onConfirm: () => void;
  onReset: () => void;
  onPass: () => void;
  onExchange: (tileIds: number[]) => void;
  rackTileIds: number[];
}

export function GameControls({
  stagedPlacements,
  board,
  isMyTurn,
  isFirstMove,
  onConfirm,
  onReset,
  onPass,
}: GameControlsProps) {
  const hasStaged = stagedPlacements.length > 0;

  // Preview score for staged tiles
  let previewScore = 0;
  if (hasStaged) {
    try {
      const scored = scoreMove(board, stagedPlacements, isFirstMove, stagedPlacements.length);
      previewScore = scored.total;
    } catch {
      // Invalid placement, score is 0
    }
  }

  if (!isMyTurn) {
    return (
      <div className="text-gray-500 text-sm text-center py-2">
        Waiting for opponent...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {hasStaged ? (
        <>
          <button
            onClick={onConfirm}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            Confirm{previewScore > 0 ? ` (+${previewScore} pts)` : ""}
          </button>
          <button
            onClick={onReset}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Reset
          </button>
        </>
      ) : (
        <>
          <span className="text-gray-400 text-sm flex-1">
            Drag a tile to the board
          </span>
          <button
            onClick={onPass}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            Pass
          </button>
        </>
      )}
    </div>
  );
}
