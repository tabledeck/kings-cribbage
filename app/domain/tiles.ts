export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type TileColor = "light" | "dark";

export interface Tile {
  id: number; // unique 0-103
  rank: Rank;
  color: TileColor;
  flipped: boolean; // only meaningful for 6s (played as 9)
}

export const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export function tileValue(tile: Tile): number {
  if (tile.rank === "A") return 1;
  if (tile.rank === "J" || tile.rank === "Q" || tile.rank === "K") return 10;
  const num = parseInt(tile.rank);
  if (num === 6 && tile.flipped) return 9;
  return num;
}

// For run detection: A=1, 2-10=face, J=11, Q=12, K=13
// 6 flipped to 9 uses ordinal 9
export function rankOrdinal(tile: Tile): number {
  if (tile.rank === "A") return 1;
  if (tile.rank === "J") return 11;
  if (tile.rank === "Q") return 12;
  if (tile.rank === "K") return 13;
  const num = parseInt(tile.rank);
  if (num === 6 && tile.flipped) return 9;
  return num;
}

// Seeded PRNG (mulberry32) — deterministic given the same seed
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTileBag(seed: number): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const rank of RANKS) {
    for (const color of ["light", "dark"] as TileColor[]) {
      for (let i = 0; i < 4; i++) {
        tiles.push({ id: id++, rank, color, flipped: false });
      }
    }
  }
  // Fisher-Yates shuffle with seeded PRNG
  const rand = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles; // 104 tiles
}

export function tileLabel(tile: Tile): string {
  if (tile.rank === "6" && tile.flipped) return "9*";
  return tile.rank;
}
