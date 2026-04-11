import { useDroppable } from "@dnd-kit/core";
import { TileDisplay } from "./Tile";
import type { Tile } from "~/domain/tiles";

interface BoardCellProps {
  row: number;
  col: number;
  tile?: Tile;
  staged?: boolean; // tile placed this turn but not yet confirmed
  isCenter?: boolean;
  isLastPlaced?: boolean;
  onTapToPlace?: (row: number, col: number) => void; // mobile tap-to-place
}

export function BoardCell({
  row,
  col,
  tile,
  staged,
  isCenter,
  isLastPlaced,
  onTapToPlace,
}: BoardCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${row}-${col}`,
    data: { row, col },
    disabled: !!tile, // can't drop on occupied cell
  });

  return (
    <div
      ref={setNodeRef}
      onClick={!tile && onTapToPlace ? () => onTapToPlace(row, col) : undefined}
      className={`
        aspect-square rounded flex items-center justify-center transition-colors
        border border-gray-700/50
        ${!tile && onTapToPlace ? "cursor-pointer" : ""}
        ${isCenter && !tile ? "bg-emerald-900/40 border-emerald-600/50" : "bg-gray-800/40"}
        ${isOver ? "bg-emerald-800/60 border-emerald-400" : ""}
        ${isLastPlaced ? "bg-emerald-900/30" : ""}
      `}
    >
      {tile && (
        <TileDisplay
          tile={tile}
          staged={staged}
          size="sm"
        />
      )}
    </div>
  );
}
