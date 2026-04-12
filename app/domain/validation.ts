import {
  isValidCell,
  posKey,
  isAdjacentToOccupied,
  CENTER,
  getContiguousLine,
  type BoardState,
} from "./board";
import { type Tile } from "./tiles";
import { moveSatisfiesScoring, type Placement } from "./scoring";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateMove(
  board: BoardState,
  placements: Placement[],
  playerRack: Tile[],
  isFirstMove: boolean,
): ValidationResult {
  if (placements.length === 0) {
    return { valid: false, reason: "Must place at least one tile" };
  }
  if (placements.length > 5) {
    return { valid: false, reason: "Cannot place more than 5 tiles" };
  }

  // All positions must be valid cells
  for (const p of placements) {
    if (!isValidCell(p.row, p.col)) {
      return { valid: false, reason: `Position (${p.row},${p.col}) is not a valid board cell` };
    }
  }

  // No duplicate positions within this placement
  const posSet = new Set(placements.map((p) => posKey(p.row, p.col)));
  if (posSet.size !== placements.length) {
    return { valid: false, reason: "Duplicate positions in placement" };
  }

  // All positions must be empty on the current board
  for (const p of placements) {
    if (board.has(posKey(p.row, p.col))) {
      return { valid: false, reason: `Position (${p.row},${p.col}) is already occupied` };
    }
  }

  // All tiles must be in the player's rack (by tile id)
  const rackIds = new Set(playerRack.map((t) => t.id));
  for (const p of placements) {
    if (!rackIds.has(p.tile.id)) {
      return { valid: false, reason: `Tile ${p.tile.rank} is not in your rack` };
    }
  }
  // No duplicate tile ids
  const placedIds = new Set(placements.map((p) => p.tile.id));
  if (placedIds.size !== placements.length) {
    return { valid: false, reason: "Cannot place the same tile twice" };
  }

  // 6-tile flip validation: only rank-6 tiles can be flipped
  for (const p of placements) {
    if (p.tile.flipped && p.tile.rank !== "6") {
      return { valid: false, reason: "Only 6-tiles can be flipped to play as 9" };
    }
  }

  // All placed tiles must be in a single straight line
  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  if (rows.size > 1 && cols.size > 1) {
    return { valid: false, reason: "Tiles must all be in the same row or column" };
  }

  // The line must be contiguous (no gaps between placed tiles, gaps can be filled by existing board tiles)
  const tempBoard: BoardState = new Map(board);
  for (const p of placements) {
    tempBoard.set(posKey(p.row, p.col), {
      tile: p.tile,
      seat: -1,
      turnPlaced: -1,
    });
  }

  const direction: "row" | "col" = rows.size === 1 ? "row" : "col";
  if (placements.length > 1) {
    const sorted = [...placements].sort((a, b) =>
      direction === "row" ? a.col - b.col : a.row - b.row,
    );
    const start = direction === "row" ? sorted[0].col : sorted[0].row;
    const end =
      direction === "row"
        ? sorted[sorted.length - 1].col
        : sorted[sorted.length - 1].row;
    const fixedAxis = direction === "row" ? sorted[0].row : sorted[0].col;

    for (let i = start; i <= end; i++) {
      const r = direction === "row" ? fixedAxis : i;
      const c = direction === "row" ? i : fixedAxis;
      if (!tempBoard.has(posKey(r, c))) {
        return { valid: false, reason: "Tiles must form a contiguous line (no empty gaps)" };
      }
    }
  }

  // Primary line must not exceed 5 tiles total (placed + existing)
  const primaryLine = getContiguousLine(tempBoard, placements[0].row, placements[0].col, direction);
  if (primaryLine.length > 5) {
    return { valid: false, reason: "A line cannot contain more than 5 tiles" };
  }

  // Each cross-line must also not exceed 5 tiles
  const crossDir: "row" | "col" = direction === "row" ? "col" : "row";
  for (const p of placements) {
    const crossLine = getContiguousLine(tempBoard, p.row, p.col, crossDir);
    if (crossLine.length > 5) {
      return { valid: false, reason: "A line cannot contain more than 5 tiles" };
    }
  }

  // First move: must include the center cell
  if (isFirstMove) {
    const touchesCenter = placements.some(
      (p) => p.row === CENTER.row && p.col === CENTER.col,
    );
    if (!touchesCenter) {
      return { valid: false, reason: "First move must include the center cell" };
    }
    if (placements.length < 2) {
      return { valid: false, reason: "First move must place at least 2 tiles" };
    }
  } else {
    // Subsequent moves: must connect to at least one existing tile
    const connects = placements.some((p) =>
      isAdjacentToOccupied(board, p.row, p.col),
    );
    // Or if a placed tile is filling a gap between existing tiles in the line,
    // that also counts as connecting (handled by the contiguity check above which
    // requires the run to already include existing tiles)
    if (!connects) {
      // Check if any placed tile shares its line with existing tiles
      const shareLineWithExisting = placements.some((p) => {
        const key = posKey(p.row, p.col);
        // Check same row
        for (const [k] of board) {
          const [kr, kc] = k.split(",").map(Number);
          if (kr === p.row || kc === p.col) return true;
        }
        return false;
      });

      if (!shareLineWithExisting && !connects) {
        return { valid: false, reason: "Tiles must connect to the existing board" };
      }
    }
  }

  // All tiles must participate in valid cribbage scoring combinations
  if (!moveSatisfiesScoring(board, placements)) {
    return { valid: false, reason: "Placement does not form a valid scoring combination" };
  }

  return { valid: true };
}
