import { AnimatePresence, motion } from "framer-motion";
import { useCallback } from "react";
import { BoardCell } from "./BoardCell";
import { isValidCell, posKey, type BoardState } from "~/domain/board";
import type { Tile } from "~/domain/tiles";
import type { Placement } from "~/domain/scoring";

interface ScorePopup {
  id: number;
  points: number;
  row: number;
  col: number;
}

interface BoardProps {
  board: BoardState;
  stagedPlacements: Placement[];
  playerRack: Tile[];
  isMyTurn: boolean;
  isTouchDevice: boolean;
  selectedTile: Tile | null;
  onStageTile: (placement: Placement) => void;
  onUnstage: (tileId: number) => void;
  onFlipTile: (tileId: number) => void;
  onClearSelectedTile: () => void;
  popups?: ScorePopup[];
  invalidStagedPositions?: Set<string>;
}

export function Board({
  board,
  stagedPlacements,
  isMyTurn,
  isTouchDevice,
  selectedTile,
  onStageTile,
  onUnstage,
  onClearSelectedTile,
  popups = [],
  invalidStagedPositions,
}: BoardProps) {
  const stagedMap = new Map(
    stagedPlacements.map((p) => [posKey(p.row, p.col), p.tile]),
  );

  const handleTapCell = useCallback(
    (row: number, col: number) => {
      if (!selectedTile || !isMyTurn) return;
      onStageTile({ row, col, tile: selectedTile });
      onClearSelectedTile();
    },
    [selectedTile, isMyTurn, onStageTile, onClearSelectedTile],
  );

  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const valid = isValidCell(r, c);
      const key = posKey(r, c);
      const committedCell = board.get(key);
      const stagedTile = stagedMap.get(key);
      const tile = committedCell?.tile ?? stagedTile;

      const isLastPlaced = stagedPlacements.some(
        (p) => p.row === r && p.col === c,
      );

      if (!valid) {
        cells.push(
          <div key={key} className="aspect-square" />,
        );
      } else {
        cells.push(
          <BoardCell
            key={key}
            row={r}
            col={c}
            tile={tile}
            staged={!!stagedTile}
            invalid={!!stagedTile && (invalidStagedPositions?.has(key) ?? false)}
            isCenter={r === 6 && c === 6}
            isLastPlaced={isLastPlaced && !stagedTile}
            onTapToPlace={
              isTouchDevice && isMyTurn && !tile ? handleTapCell : undefined
            }
            onUnstage={
              stagedTile && isMyTurn ? () => onUnstage(stagedTile.id) : undefined
            }
          />,
        );
      }
    }
  }

  return (
    <div className="relative" style={{ width: "min(90vw, 90vh, 600px)" }}>
      <div
        className="grid grid-cols-13 gap-0.5 p-1 bg-gray-900 rounded-xl border border-gray-700"
      >
        {cells}
      </div>

      {/* Score pop-ups float over the board */}
      <AnimatePresence>
        {popups.map((p) => {
          const pct = (n: number) => `${((n + 0.5) / 13) * 100}%`;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: 0, scale: 0.9 }}
              animate={{ opacity: 0, y: -44, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0, ease: "easeOut" }}
              className="pointer-events-none absolute text-yellow-300 font-bold text-base drop-shadow-lg z-20 -translate-x-1/2"
              style={{ left: pct(p.col), top: pct(p.row) }}
            >
              +{p.points}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
