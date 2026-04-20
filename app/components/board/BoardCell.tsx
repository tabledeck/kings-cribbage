import { useDroppable } from "@dnd-kit/core";
import { TileDisplay } from "./Tile";
import type { Tile } from "~/domain/tiles";

interface BoardCellProps {
  row: number;
  col: number;
  tile?: Tile;
  staged?: boolean; // tile placed this turn but not yet confirmed
  invalid?: boolean; // staged tile failed scoring validation
  isCenter?: boolean;
  isLastPlaced?: boolean;
  onTapToPlace?: (row: number, col: number) => void; // mobile tap-to-place
  onUnstage?: () => void; // click staged tile to remove it
}

// Visual cell type for the 13x13 board (cosmetic only, not game logic)
function getCellType(row: number, col: number): "center" | "triple" | "double" | "normal" {
  if (row === 6 && col === 6) return "center";
  // Triple: edges midpoints
  if (
    (row === 0 && col === 6) ||
    (row === 6 && col === 0) ||
    (row === 6 && col === 12) ||
    (row === 12 && col === 6)
  ) return "triple";
  // Double: corner cells and cross positions
  if (
    (row === 0 && col === 3) || (row === 0 && col === 9) ||
    (row === 3 && col === 0) || (row === 3 && col === 12) ||
    (row === 9 && col === 0) || (row === 9 && col === 12) ||
    (row === 12 && col === 3) || (row === 12 && col === 9) ||
    (row === 3 && col === 6) || (row === 9 && col === 6) ||
    (row === 6 && col === 3) || (row === 6 && col === 9)
  ) return "double";
  return "normal";
}

export function BoardCell({
  row,
  col,
  tile,
  staged,
  invalid,
  isCenter,
  isLastPlaced,
  onTapToPlace,
  onUnstage,
}: BoardCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${row}-${col}`,
    data: { row, col },
    disabled: !!tile, // can't drop on occupied cell
  });

  const cellType = isCenter ? "center" : getCellType(row, col);

  const cellClass = [
    "board-cell",
    cellType !== "normal" ? cellType : "",
    isOver ? "drag-over" : "",
    isLastPlaced ? "last-placed" : "",
    (staged && onUnstage) || (!tile && onTapToPlace) ? "cursor-pointer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      onClick={
        staged && onUnstage
          ? onUnstage
          : !tile && onTapToPlace
          ? () => onTapToPlace(row, col)
          : undefined
      }
      className={cellClass}
    >
      {tile && (
        <TileDisplay
          tile={tile}
          staged={staged}
          invalid={invalid}
          size="fill"
        />
      )}
    </div>
  );
}
