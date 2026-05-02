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

  const cellClass = [
    "board-cell",
    isCenter ? "center" : "",
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
