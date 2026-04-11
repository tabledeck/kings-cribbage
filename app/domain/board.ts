import type { Tile } from "./tiles";

export type Position = { row: number; col: number };

export interface CellState {
  tile: Tile;
  seat: number;
  turnPlaced: number;
}

// Map key: "row,col"
export type BoardState = Map<string, CellState>;

export function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseKey(key: string): Position {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

// The board is 13x13 with 3x2 corner patches removed.
// Removed corners: top-left (rows 0-1, cols 0-2), top-right (rows 0-1, cols 10-12),
//                  bottom-left (rows 11-12, cols 0-2), bottom-right (rows 11-12, cols 10-12)
export function isValidCell(row: number, col: number): boolean {
  if (row < 0 || row > 12 || col < 0 || col > 12) return false;
  if (row <= 1 && col <= 2) return false;
  if (row <= 1 && col >= 10) return false;
  if (row >= 11 && col <= 2) return false;
  if (row >= 11 && col >= 10) return false;
  return true;
}

// Center cell — first player must place here
export const CENTER: Position = { row: 6, col: 6 };

// Get the full contiguous run of tiles along a line that includes (startRow, startCol)
export function getContiguousLine(
  board: BoardState,
  startRow: number,
  startCol: number,
  direction: "row" | "col",
): Tile[] {
  const dr = direction === "col" ? 1 : 0;
  const dc = direction === "row" ? 1 : 0;

  // Walk backward to find start of contiguous group
  let r = startRow;
  let c = startCol;
  while (true) {
    const nr = r - dr;
    const nc = c - dc;
    if (!isValidCell(nr, nc)) break;
    if (!board.has(posKey(nr, nc))) break;
    r = nr;
    c = nc;
  }

  // Walk forward collecting tiles
  const tiles: Tile[] = [];
  while (isValidCell(r, c) && board.has(posKey(r, c))) {
    tiles.push(board.get(posKey(r, c))!.tile);
    r += dr;
    c += dc;
  }
  return tiles;
}

// Check if a position is adjacent (orthogonally) to any occupied cell
export function isAdjacentToOccupied(
  board: BoardState,
  row: number,
  col: number,
): boolean {
  const neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  for (const [r, c] of neighbors) {
    if (board.has(posKey(r, c))) return true;
  }
  return false;
}

// Serialize board to a JSON-safe structure
export function serializeBoard(
  board: BoardState,
): Array<{ key: string; cell: CellState }> {
  return Array.from(board.entries()).map(([key, cell]) => ({ key, cell }));
}

export function deserializeBoard(
  data: Array<{ key: string; cell: CellState }>,
): BoardState {
  const board: BoardState = new Map();
  for (const { key, cell } of data) {
    board.set(key, cell);
  }
  return board;
}
