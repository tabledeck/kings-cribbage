import { createTileBag, type Tile } from "./tiles";
import {
  posKey,
  deserializeBoard,
  serializeBoard,
  type BoardState,
  type CellState,
} from "./board";
import { scoreMove, tilePointValue, type Placement } from "./scoring";
import { canPlayerMakeAnyMove } from "./validation";

export interface PlayerState {
  seat: number;
  rack: Tile[];
  score: number;
  connected: boolean;
  name: string;
}

export interface GameSettings {
  seed: number;
  maxPlayers: number;
  timePerTurn?: number; // seconds, 0 = unlimited
}

export interface GameState {
  status: "waiting" | "guessing" | "active" | "finished";
  board: BoardState;
  bag: Tile[];
  players: PlayerState[];
  currentTurn: number; // seat index
  moveCount: number;
  consecutivePasses: number;
  firstMoveMade: boolean;
  winner: number | null; // seat index
  guesses: (number | null)[]; // indexed by seat, null = not guessed yet
  guessTarget: number | null; // server-only: the secret target for the guess game
}

export type MoveType = "place" | "pass" | "exchange" | "start" | "join" | "guess";

export interface MoveRecord {
  seat: number;
  sequence: number;
  moveType: MoveType;
  data: PlaceMoveData | ExchangeMoveData | PassMoveData | StartMoveData | JoinMoveData | GuessMoveData;
  scoreEarned: number;
}

export interface PlaceMoveData {
  type: "place";
  placements: Array<{ row: number; col: number; tile: Tile }>;
}

export interface ExchangeMoveData {
  type: "exchange";
  returnedTileIds: number[];
  drawnTileIds: number[];
}

export interface PassMoveData {
  type: "pass";
}

export interface StartMoveData {
  type: "start";
  // initial tile draws for all players
  initialDraws: Array<{ seat: number; tiles: Tile[] }>;
  firstSeat: number; // who goes first (winner of guess game)
  guessTarget: number; // the target number (1-10)
  guesses: (number | null)[]; // each player's guess, indexed by seat
}

export interface GuessMoveData {
  type: "guess";
  seat: number;
  number: number; // 1-10
}

export interface JoinMoveData {
  type: "join";
  seat: number;
  name: string;
}

export function initializeGame(settings: GameSettings): GameState {
  return {
    status: "waiting",
    board: new Map(),
    bag: createTileBag(settings.seed),
    players: [],
    currentTurn: 0,
    moveCount: 0,
    consecutivePasses: 0,
    firstMoveMade: false,
    winner: null,
    guesses: [],
    guessTarget: null,
  };
}

// Draw N tiles from the bag. Mutates bag array (pops from front).
function drawFromBag(bag: Tile[], count: number): Tile[] {
  return bag.splice(0, count);
}

// Refill a player's rack up to 5 tiles
function refillRack(player: PlayerState, bag: Tile[]): void {
  const needed = 5 - player.rack.length;
  if (needed > 0 && bag.length > 0) {
    const drawn = drawFromBag(bag, Math.min(needed, bag.length));
    player.rack.push(...drawn);
  }
}

export function applyMove(state: GameState, move: MoveRecord): GameState {
  // Deep clone state (board is a Map, need to clone it)
  const newState: GameState = {
    ...state,
    board: new Map(state.board),
    bag: [...state.bag],
    players: state.players.map((p) => ({
      ...p,
      rack: [...p.rack],
    })),
  };

  const player = newState.players[move.seat];

  switch (move.moveType) {
    case "join": {
      const d = move.data as JoinMoveData;
      // Add player if not already present
      if (!newState.players[d.seat]) {
        newState.players[d.seat] = {
          seat: d.seat,
          rack: [],
          score: 0,
          connected: true,
          name: d.name,
        };
      } else {
        newState.players[d.seat].name = d.name;
        newState.players[d.seat].connected = true;
      }
      break;
    }

    case "guess": {
      const d = move.data as GuessMoveData;
      const newGuesses = [...(newState.guesses ?? [])];
      newGuesses[d.seat] = d.number;
      newState.guesses = newGuesses;
      break;
    }

    case "start": {
      const d = move.data as StartMoveData;
      newState.status = "active";
      // firstSeat may be absent in old replayed games — default to 0
      newState.currentTurn = d.firstSeat ?? 0;
      newState.guesses = d.guesses ?? [];
      // Apply initial draws
      for (const draw of d.initialDraws) {
        if (newState.players[draw.seat]) {
          newState.players[draw.seat].rack = draw.tiles;
        }
      }
      // Remove drawn tiles from bag
      const drawnIds = new Set(
        d.initialDraws.flatMap((dr) => dr.tiles.map((t) => t.id)),
      );
      newState.bag = newState.bag.filter((t) => !drawnIds.has(t.id));
      break;
    }

    case "place": {
      const d = move.data as PlaceMoveData;
      const placements: Placement[] = d.placements;

      // Place tiles on board
      for (const p of placements) {
        newState.board.set(posKey(p.row, p.col), {
          tile: p.tile,
          seat: move.seat,
          turnPlaced: newState.moveCount,
        });
      }

      // Remove placed tiles from rack
      const placedIds = new Set(placements.map((p) => p.tile.id));
      player.rack = player.rack.filter((t) => !placedIds.has(t.id));

      // Score the move
      const scored = scoreMove(
        state.board, // use original board for scoring
        placements,
        !state.firstMoveMade,
        placements.length,
      );
      player.score += scored.total;
      newState.firstMoveMade = true;
      newState.consecutivePasses = 0;

      // Refill rack
      refillRack(player, newState.bag);

      // Check if player emptied their rack AND bag is empty → game over
      if (player.rack.length === 0 && newState.bag.length === 0) {
        newState.status = "finished";
        // Subtract remaining tile values from other players
        for (const p of newState.players) {
          if (p.seat !== move.seat) {
            const penalty = p.rack.reduce((s, t) => s + tilePointValue(t), 0);
            p.score -= penalty;
          }
        }
        newState.winner = findWinner(newState.players);
      }

      newState.currentTurn = nextTurn(newState);
      newState.moveCount++;
      break;
    }

    case "pass": {
      newState.consecutivePasses++;
      newState.currentTurn = nextTurn(newState);
      newState.moveCount++;

      // If all players passed in a row, game ends
      if (newState.consecutivePasses >= newState.players.length) {
        newState.status = "finished";
        // Subtract remaining tile values from all players
        for (const p of newState.players) {
          const penalty = p.rack.reduce((s, t) => s + tilePointValue(t), 0);
          p.score -= penalty;
        }
        newState.winner = findWinner(newState.players);
      }
      break;
    }

    case "exchange": {
      const d = move.data as ExchangeMoveData;
      // Remove returned tiles from rack, put them at end of bag
      const returnedIds = new Set(d.returnedTileIds);
      const returned = player.rack.filter((t) => returnedIds.has(t.id));
      player.rack = player.rack.filter((t) => !returnedIds.has(t.id));

      // Draw the same number from the bag (they were pre-determined in drawnTileIds)
      const drawnIds = new Set(d.drawnTileIds);
      const drawn = newState.bag.filter((t) => drawnIds.has(t.id));
      newState.bag = newState.bag.filter((t) => !drawnIds.has(t.id));
      player.rack.push(...drawn);

      // Return tiles to end of bag
      newState.bag.push(...returned);

      // Exchange is a productive action — it interrupts a run of passes.
      newState.consecutivePasses = 0;
      newState.currentTurn = nextTurn(newState);
      newState.moveCount++;
      break;
    }
  }

  return newState;
}

// Apply a move and then auto-pass any subsequent players who have no legal
// move. Only meaningful once the bag is empty — while tiles remain, a stuck
// player can always exchange instead of pass.
//
// Returns the new state plus the synthetic pass MoveRecords generated for the
// auto-passes, so the caller can persist and broadcast them like normal moves.
// Replay (`replayMoves`) does not need to call this function: the synthetic
// passes are persisted as real records and replay through `applyMove`.
export function applyMoveWithAutoPasses(
  state: GameState,
  move: MoveRecord,
  nextSequence: () => number,
): { state: GameState; autoPasses: MoveRecord[] } {
  let current = applyMove(state, move);
  const autoPasses: MoveRecord[] = [];

  while (
    current.status === "active" &&
    current.bag.length === 0 &&
    current.players[current.currentTurn] &&
    !canPlayerMakeAnyMove(
      current.board,
      current.players[current.currentTurn].rack,
      !current.firstMoveMade,
    )
  ) {
    const passMove: MoveRecord = {
      seat: current.currentTurn,
      sequence: nextSequence(),
      moveType: "pass",
      data: { type: "pass" },
      scoreEarned: 0,
    };
    current = applyMove(current, passMove);
    autoPasses.push(passMove);
  }

  return { state: current, autoPasses };
}

function nextTurn(state: GameState): number {
  return (state.currentTurn + 1) % state.players.length;
}

function findWinner(players: PlayerState[]): number {
  let best = -Infinity;
  let winner = 0;
  for (const p of players) {
    if (p.score > best) {
      best = p.score;
      winner = p.seat;
    }
  }
  return winner;
}

// Reconstruct game state from a list of moves (deterministic via seeded PRNG)
export function replayMoves(
  moves: MoveRecord[],
  settings: GameSettings,
): GameState {
  let state = initializeGame(settings);
  for (const move of moves) {
    state = applyMove(state, move);
  }
  return state;
}

// Serialize GameState to a plain object for JSON/WebSocket transport
export function serializeGameState(state: GameState) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { guessTarget: _hidden, ...rest } = state;
  return {
    ...rest,
    board: serializeBoard(state.board),
    // Don't send other players' racks — filter nulls from sparse array
    players: state.players.filter(Boolean).map((p) => ({ ...p!, rack: [] })),
    guesses: state.guesses ?? [],
  };
}

export function deserializeGameState(
  data: ReturnType<typeof serializeGameState> & { board: Parameters<typeof deserializeBoard>[0]; guessTarget?: number | null },
): GameState {
  return {
    ...data,
    board: deserializeBoard(data.board),
    guessTarget: data.guessTarget ?? null,
  };
}
