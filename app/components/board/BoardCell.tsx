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
  highlightCenter?: boolean;
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
  highlightCenter,
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
    highlightCenter ? "first-target" : "",
    isOver ? "drag-over" : "",
    isLastPlaced ? "last-placed" : "",
    (staged && onUnstage) || (!tile && onTapToPlace) ? "cursor-pointer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      data-row={row}
      data-col={col}
      role={onTapToPlace || onUnstage ? "button" : undefined}
      aria-label={
        tile
          ? undefined
          : `Square row ${row + 1}, column ${col + 1}${isCenter ? ", crown" : ""}`
      }
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
