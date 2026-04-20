import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface PopupEntry {
  id: number;
  points: number;
  row: number;
  col: number;
}

interface ScorePopupLayerProps {
  popups: PopupEntry[];
  cellSize: number; // px — size of one board cell
  boardOffset: { top: number; left: number };
}

// Shown as an overlay on top of the board
export function ScorePopupLayer({ popups, cellSize, boardOffset }: ScorePopupLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -48, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: boardOffset.top + p.row * cellSize - 10,
              left: boardOffset.left + p.col * cellSize,
            }}
            className="score-popup-text drop-shadow-lg whitespace-nowrap"
          >
            +{p.points}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook to manage score popup queue
let _nextId = 0;
export function useScorePopups() {
  const [popups, setPopups] = useState<PopupEntry[]>([]);

  const addPopup = (points: number, row: number, col: number) => {
    if (points <= 0) return;
    const id = _nextId++;
    setPopups((prev) => [...prev, { id, points, row, col }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  };

  return { popups, addPopup };
}
