import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { Tile as TileType } from "~/domain/tiles";
import { tileLabel } from "~/domain/tiles";
import { FlipIcon } from "~/components/icons/FlipIcon";

interface TileProps {
  tile: TileType;
  draggable?: boolean;
  staged?: boolean;
  invalid?: boolean;
  size?: "sm" | "md" | "lg" | "fill";
  onFlip?: () => void;
}

// Map tile color + id parity to one of four suit visual classes
// light tiles → heart / diamond; dark tiles → spade / club
function getSuit(tile: TileType): "heart" | "diamond" | "spade" | "club" {
  const isEven = tile.id % 2 === 0;
  if (tile.color === "light") {
    return isEven ? "heart" : "diamond";
  }
  return isEven ? "spade" : "club";
}

function getSuitSymbol(suit: "heart" | "diamond" | "spade" | "club"): string {
  return { heart: "♥", diamond: "♦", spade: "♠", club: "♣" }[suit];
}

const SIZE_CLASSES: Record<string, string> = {
  sm:   "tile tile-sm",
  md:   "tile tile-md",
  lg:   "tile tile-lg",
  fill: "tile",
};

export function TileDisplay({
  tile,
  staged,
  invalid,
  size = "md",
  onFlip,
}: TileProps) {
  const label = tileLabel(tile);
  const canFlip = tile.rank === "6";
  const suit = getSuit(tile);
  const suitSymbol = getSuitSymbol(suit);

  const stateClass = invalid ? "invalid" : staged ? "staged" : "";

  return (
    <motion.div
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`${SIZE_CLASSES[size]} ${suit} ${stateClass} ${onFlip && canFlip ? "cursor-pointer" : ""}`}
      style={size === "fill" ? { width: "100%", height: "100%" } : undefined}
      onClick={canFlip ? onFlip : undefined}
      title={canFlip ? "Click to flip 6/9" : undefined}
    >
      <span className="n">{label}</span>
      <span className="s">{suitSymbol}</span>
      {canFlip && (
        <FlipIcon className="flip-icon" />
      )}
    </motion.div>
  );
}

export function DraggableTile({
  tile,
  size = "md",
  onFlip,
}: TileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `tile-${tile.id}`,
      data: { tile },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TileDisplay tile={tile} size={size} onFlip={onFlip} />
    </div>
  );
}
