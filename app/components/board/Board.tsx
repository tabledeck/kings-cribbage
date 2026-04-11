import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useCallback } from "react";
import { BoardCell } from "./BoardCell";
import { TileDisplay } from "./Tile";
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
  onStageTile: (placement: Placement) => void;
  onUnstage: (tileId: number) => void;
  onFlipTile: (tileId: number) => void;
  popups?: ScorePopup[];
}

export function Board({
  board,
  stagedPlacements,
  playerRack,
  isMyTurn,
  isTouchDevice,
  onStageTile,
  onUnstage,
  onFlipTile,
  popups = [],
}: BoardProps) {
  const [activeTile, setActiveTile] = useState<Tile | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null); // mobile tap-select

  const stagedMap = new Map(
    stagedPlacements.map((p) => [posKey(p.row, p.col), p.tile]),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const tile = event.active.data.current?.tile as Tile | undefined;
    if (tile) setActiveTile(tile);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTile(null);
      const tile = event.active.data.current?.tile as Tile | undefined;
      const cellData = event.over?.data.current as
        | { row: number; col: number }
        | undefined;

      if (!tile || !cellData) return;
      if (!isMyTurn) return;

      onStageTile({ row: cellData.row, col: cellData.col, tile });
    },
    [isMyTurn, onStageTile],
  );

  // Mobile: tap a rack tile to select, then tap a board cell to place
  const handleTapRackTile = useCallback(
    (tile: Tile) => {
      if (!isTouchDevice) return;
      setSelectedTile((prev) => (prev?.id === tile.id ? null : tile));
    },
    [isTouchDevice],
  );

  const handleTapCell = useCallback(
    (row: number, col: number) => {
      if (!selectedTile || !isMyTurn) return;
      onStageTile({ row, col, tile: selectedTile });
      setSelectedTile(null);
    },
    [selectedTile, isMyTurn, onStageTile],
  );

  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const valid = isValidCell(r, c);
      const key = posKey(r, c);
      const committedCell = board.get(key);
      const stagedTile = stagedMap.get(key);
      const tile = committedCell?.tile ?? stagedTile;

      // Check if this was in the last placement (for highlighting)
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
            isCenter={r === 6 && c === 6}
            isLastPlaced={isLastPlaced && !stagedTile}
            onTapToPlace={
              isTouchDevice && isMyTurn && !tile ? handleTapCell : undefined
            }
          />,
        );
      }
    }
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Board grid + score pop-ups share the same relative container */}
      <div className="relative" style={{ width: "min(90vw, 90vh, 600px)" }}>
        <div
          className="grid grid-cols-13 gap-0.5 p-1 bg-gray-900 rounded-xl border border-gray-700"
        >
          {cells}
        </div>

        {/* Score pop-ups float over the board */}
        <AnimatePresence>
          {popups.map((p) => {
            // Each of the 13 cells is ~(1/13) of the board width/height.
            // p.row and p.col are 0-indexed.
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

      <DragOverlay>
        {activeTile && <TileDisplay tile={activeTile} size="md" />}
      </DragOverlay>
    </DndContext>
  );
}
