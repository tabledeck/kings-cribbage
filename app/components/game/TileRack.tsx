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
    <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-xl border border-gray-700">
      <span className="text-gray-500 text-xs mr-1 whitespace-nowrap">
        Your tiles:
      </span>
      <div className="flex gap-2">
        {tiles.map((tile) => {
          const isStaged = stagedIds.has(tile.id);
          const isSelected = selectedId === tile.id;

          if (isStaged) {
            // Show placeholder for staged tiles
            return (
              <div
                key={tile.id}
                className="w-9 h-11 rounded border-2 border-dashed border-gray-600 opacity-30"
              />
            );
          }

          return (
            <div
              key={tile.id}
              onClick={() => isMyTurn && onSelectTile?.(tile.id)}
              className={isSelected ? "rounded ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900" : "rounded"}
            >
              <DraggableTile
                tile={tile}
                size="md"
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
            className="w-9 h-11 rounded border-2 border-dashed border-gray-700 opacity-20"
          />
        ))}
      </div>
    </div>
  );
}
