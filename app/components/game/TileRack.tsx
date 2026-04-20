import { DraggableTile, TileDisplay } from "~/components/board/Tile";
import type { Tile } from "~/domain/tiles";

interface TileRackProps {
  tiles: Tile[];
  stagedIds: Set<number>;
  selectedId: number | null;
  isMyTurn: boolean;
  onFlipTile?: (tileId: number) => void;
  onSelectTile?: (tileId: number) => void;
}

export function TileRack({
  tiles,
  stagedIds,
  selectedId,
  isMyTurn,
  onFlipTile,
  onSelectTile,
}: TileRackProps) {
  return (
    <div className="td-rack">
      <span className="label">Your tiles</span>
      <div className="flex gap-2 items-center">
        {tiles.map((tile) => {
          const isStaged = stagedIds.has(tile.id);
          const isSelected = selectedId === tile.id;

          if (isStaged) {
            return (
              <div
                key={tile.id}
                className="tile-rack tile tile-empty"
                style={{ width: 44, height: 54 }}
              />
            );
          }

          return (
            <div
              key={tile.id}
              onClick={() => isMyTurn && onSelectTile?.(tile.id)}
              className={isSelected ? "td-rack tile-selected-ring rounded" : "rounded"}
            >
              <DraggableTile
                tile={tile}
                size="lg"
                onFlip={
                  tile.rank === "6" ? () => onFlipTile?.(tile.id) : undefined
                }
              />
            </div>
          );
        })}
        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 5 - tiles.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="tile tile-empty"
            style={{ width: 44, height: 54, background: "rgba(0,0,0,0.25)", boxShadow: "inset 0 0 0 1px rgba(201,162,74,0.25)" }}
          />
        ))}
      </div>
    </div>
  );
}
