import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { Tile as TileType } from "~/domain/tiles";
import { tileLabel } from "~/domain/tiles";

interface TileProps {
  tile: TileType;
  draggable?: boolean;
  staged?: boolean;
  size?: "sm" | "md" | "lg" | "fill";
  onFlip?: () => void;
}

const SUIT_COLORS = {
  light: "bg-amber-50 text-gray-900 border-amber-200",
  dark: "bg-blue-900 text-white border-blue-700",
};

const SIZES = {
  sm: "w-7 h-9 text-xs",
  md: "w-9 h-11 text-sm",
  lg: "w-12 h-14 text-base",
  fill: "w-full h-full text-xs",
};

export function TileDisplay({
  tile,
  staged,
  size = "md",
  onFlip,
}: TileProps) {
  const label = tileLabel(tile);
  const canFlip = tile.rank === "6";

  return (
    <motion.div
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`
        relative rounded border-2 font-bold flex items-center justify-center select-none
        ${SUIT_COLORS[tile.color]}
        ${SIZES[size]}
        ${staged ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-950" : ""}
        ${onFlip && canFlip ? "cursor-pointer" : ""}
      `}
      onClick={canFlip ? onFlip : undefined}
      title={canFlip ? "Click to flip 6/9" : undefined}
    >
      {label}
      {canFlip && (
        <span className="absolute bottom-0.5 right-0.5 text-[8px] opacity-60">
          ⟳
        </span>
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
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TileDisplay tile={tile} size={size} onFlip={onFlip} />
    </div>
  );
}
