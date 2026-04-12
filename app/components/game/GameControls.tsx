import { useState } from "react";
import type { Placement } from "~/domain/scoring";
import { scoreMove } from "~/domain/scoring";
import type { BoardState } from "~/domain/board";
import { TileDisplay } from "~/components/board/Tile";
import type { Tile } from "~/domain/tiles";

interface GameControlsProps {
  stagedPlacements: Placement[];
  board: BoardState;
  isMyTurn: boolean;
  isFirstMove: boolean;
  myRack: Tile[];
  onConfirm: () => void;
  onReset: () => void;
  onPass: () => void;
  onExchange: (tileIds: number[]) => void;
}

export function GameControls({
  stagedPlacements,
  board,
  isMyTurn,
  isFirstMove,
  myRack,
  onConfirm,
  onReset,
  onPass,
  onExchange,
}: GameControlsProps) {
  const [exchangeMode, setExchangeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const hasStaged = stagedPlacements.length > 0;

  let previewScore = 0;
  if (hasStaged) {
    try {
      const scored = scoreMove(board, stagedPlacements, isFirstMove, stagedPlacements.length);
      previewScore = scored.total;
    } catch {
      // Invalid placement
    }
  }

  function toggleTile(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmExchange() {
    onExchange([...selectedIds]);
    setExchangeMode(false);
    setSelectedIds(new Set());
  }

  function cancelExchange() {
    setExchangeMode(false);
    setSelectedIds(new Set());
  }

  if (!isMyTurn) {
    return (
      <div className="text-gray-500 text-sm text-center py-2">
        Waiting for opponent...
      </div>
    );
  }

  if (exchangeMode) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-gray-400 text-sm">
          Select tiles to exchange ({selectedIds.size} selected):
        </span>
        <div className="flex gap-2 flex-wrap">
          {myRack.map((tile) => (
            <button
              key={tile.id}
              onClick={() => toggleTile(tile.id)}
              className={`rounded transition-transform ${
                selectedIds.has(tile.id)
                  ? "ring-2 ring-yellow-400 scale-110"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <TileDisplay tile={tile} size="md" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={confirmExchange}
            disabled={selectedIds.size === 0}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            Exchange ({selectedIds.size})
          </button>
          <button
            onClick={cancelExchange}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
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
            onClick={() => setExchangeMode(true)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            Exchange
          </button>
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
