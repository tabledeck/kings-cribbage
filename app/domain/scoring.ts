import { tileValue, rankOrdinal, type Tile } from "./tiles";
import {
  posKey,
  isValidCell,
  getContiguousLine,
  type BoardState,
  type Position,
} from "./board";

export interface RunDetail {
  length: number;
  multiplier: number;
}

export interface LineScore {
  direction: "row" | "col";
  tiles: Tile[];
  fifteens: number;
  pairs: number;
  runs: RunDetail[];
  subtotal: number;
}

export interface MoveScore {
  lineScores: LineScore[];
  bonusFirstMove: boolean;
  bonusAllFive: boolean;
  bonusFlush: boolean;
  total: number;
}

// Score a contiguous sequence of tiles using cribbage rules.
export function scoreLine(tiles: Tile[]): Omit<LineScore, "direction"> {
  if (tiles.length < 2) {
    return { tiles, fifteens: 0, pairs: 0, runs: [], subtotal: 0 };
  }

  const values = tiles.map(tileValue);
  const ordinals = tiles.map(rankOrdinal);

  // Fifteens: enumerate all subsets via bitmask
  let fifteens = 0;
  const n = tiles.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += values[i];
    }
    if (sum === 15) fifteens++;
  }

  // Pairs: group by rank ordinal
  const rankCounts = new Map<number, number>();
  for (const ord of ordinals) {
    rankCounts.set(ord, (rankCounts.get(ord) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of rankCounts.values()) {
    if (count >= 2) {
      // C(count, 2) pairs
      pairs += (count * (count - 1)) / 2;
    }
  }

  // Runs: find consecutive sequences of unique ordinals of length >= 3,
  // multiplied by the count of each ordinal in the run.
  const uniqueOrdinals = [...new Set(ordinals)].sort((a, b) => a - b);
  const runs: RunDetail[] = [];

  let runStart = 0;
  for (let i = 1; i <= uniqueOrdinals.length; i++) {
    const isEnd =
      i === uniqueOrdinals.length ||
      uniqueOrdinals[i] !== uniqueOrdinals[i - 1] + 1;
    if (isEnd) {
      const runLength = i - runStart;
      if (runLength >= 3) {
        let multiplier = 1;
        for (let j = runStart; j < i; j++) {
          multiplier *= rankCounts.get(uniqueOrdinals[j])!;
        }
        runs.push({ length: runLength, multiplier });
      }
      runStart = i;
    }
  }

  const subtotal =
    fifteens * 2 +
    pairs * 2 +
    runs.reduce((s, r) => s + r.length * r.multiplier, 0);

  return { tiles, fifteens, pairs, runs, subtotal };
}

export interface Placement {
  row: number;
  col: number;
  tile: Tile;
}

// Score an entire move: primary line + all cross-lines for each placed tile.
export function scoreMove(
  board: BoardState,
  placements: Placement[],
  isFirstMove: boolean,
  tilesUsed: number, // total tiles used this turn (for all-5 bonus)
): MoveScore {
  if (placements.length === 0) {
    return {
      lineScores: [],
      bonusFirstMove: false,
      bonusAllFive: false,
      bonusFlush: false,
      total: 0,
    };
  }

  // Build a temporary board with the new tiles placed
  const tempBoard: BoardState = new Map(board);
  for (const p of placements) {
    tempBoard.set(posKey(p.row, p.col), {
      tile: p.tile,
      seat: -1,
      turnPlaced: -1,
    });
  }

  const lineScores: LineScore[] = [];
  const scoredLines = new Set<string>(); // avoid double-scoring same line

  // Determine primary direction
  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  const primaryDir: "row" | "col" =
    rows.size === 1 ? "row" : cols.size === 1 ? "col" : "row";

  // Score the primary line (the line containing all placed tiles)
  const anchor = placements[0];
  const primaryTiles = getContiguousLine(
    tempBoard,
    anchor.row,
    anchor.col,
    primaryDir,
  );
  if (primaryTiles.length >= 2) {
    const lineKey = `${primaryDir}:${primaryDir === "row" ? anchor.row : anchor.col}`;
    if (!scoredLines.has(lineKey)) {
      scoredLines.add(lineKey);
      const scored = scoreLine(primaryTiles);
      lineScores.push({ direction: primaryDir, ...scored });
    }
  }

  // Score cross-lines for each placed tile
  const crossDir: "row" | "col" = primaryDir === "row" ? "col" : "row";
  for (const p of placements) {
    const crossTiles = getContiguousLine(tempBoard, p.row, p.col, crossDir);
    if (crossTiles.length >= 2) {
      const lineKey = `${crossDir}:${crossDir === "row" ? p.row : p.col}`;
      if (!scoredLines.has(lineKey)) {
        scoredLines.add(lineKey);
        const scored = scoreLine(crossTiles);
        lineScores.push({ direction: crossDir, ...scored });
      }
    }
  }

  // Bonuses
  const bonusFirstMove = isFirstMove;
  const bonusAllFive = tilesUsed === 5;

  // Flush: all 5 tiles placed are same color
  const bonusFlush =
    tilesUsed === 5 &&
    placements.every((p) => p.tile.color === placements[0].tile.color);

  const lineTotal = lineScores.reduce((s, l) => s + l.subtotal, 0);
  const total =
    lineTotal +
    (bonusFirstMove ? 10 : 0) +
    (bonusAllFive ? 10 : 0) +
    (bonusFlush ? 10 : 0);

  return { lineScores, bonusFirstMove, bonusAllFive, bonusFlush, total };
}

// Returns true if `tile` is a member of at least one fifteen, pair, or run in `tiles`.
function tileParticipatesInLine(tile: Tile, tiles: Tile[]): boolean {
  const idx = tiles.findIndex((t) => t.id === tile.id);
  if (idx === -1) return false;

  const values = tiles.map(tileValue);
  const ordinals = tiles.map(rankOrdinal);
  const tv = values[idx];
  const to = ordinals[idx];

  // Fifteen: any subset of the other tiles sums to (15 - tv)
  const otherValues = values.filter((_, i) => i !== idx);
  const target = 15 - tv;
  if (target >= 0 && canSumTo(otherValues, target)) return true;

  // Pair: another tile with the same ordinal
  if (ordinals.some((o, i) => i !== idx && o === to)) return true;

  // Run: tile's ordinal is part of a consecutive sequence of 3+ unique ordinals
  const uniqueSorted = [...new Set(ordinals)].sort((a, b) => a - b);
  let start = 0;
  for (let i = 1; i <= uniqueSorted.length; i++) {
    const isEnd =
      i === uniqueSorted.length || uniqueSorted[i] !== uniqueSorted[i - 1] + 1;
    if (isEnd) {
      const len = i - start;
      if (len >= 3 && uniqueSorted.slice(start, i).includes(to)) return true;
      start = i;
    }
  }

  return false;
}

function canSumTo(values: number[], target: number): boolean {
  if (target === 0) return true;
  if (values.length === 0 || target < 0) return false;
  const [first, ...rest] = values;
  return canSumTo(rest, target - first) || canSumTo(rest, target);
}

// Every placed tile must be a member of at least one scoring combination
// (fifteen, pair, or run) within a valid line it participates in.
export function moveSatisfiesScoring(
  board: BoardState,
  placements: Placement[],
): boolean {
  const tempBoard: BoardState = new Map(board);
  for (const p of placements) {
    tempBoard.set(posKey(p.row, p.col), {
      tile: p.tile,
      seat: -1,
      turnPlaced: -1,
    });
  }

  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  const primaryDir: "row" | "col" =
    rows.size === 1 ? "row" : cols.size === 1 ? "col" : "row";
  const crossDir: "row" | "col" = primaryDir === "row" ? "col" : "row";

  for (const p of placements) {
    const inPrimary = getContiguousLine(tempBoard, p.row, p.col, primaryDir);
    const inCross = getContiguousLine(tempBoard, p.row, p.col, crossDir);

    const primaryValid = inPrimary.length >= 2 && inPrimary.length <= 5;
    const crossValid = inCross.length >= 2 && inCross.length <= 5;

    const participatesInPrimary =
      primaryValid && tileParticipatesInLine(p.tile, inPrimary);
    const participatesInCross =
      crossValid && tileParticipatesInLine(p.tile, inCross);

    if (!participatesInPrimary && !participatesInCross) return false;
  }

  return true;
}

// Remaining tile point values subtracted at game end
export function tilePointValue(tile: Tile): number {
  return tileValue(tile);
}
