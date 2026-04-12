import { BaseGameRoomDO } from "@tabledeck/game-room/server";
import {
  initializeGame,
  applyMove,
  serializeGameState,
  deserializeGameState,
  type GameState,
  type GameSettings,
  type MoveRecord,
  type PlaceMoveData,
  type ExchangeMoveData,
} from "../app/domain/game-logic";
import { validateMove } from "../app/domain/validation";
import { scoreMove } from "../app/domain/scoring";
import { ClientMessage } from "../app/domain/messages";
import type { Tile } from "../app/domain/tiles";

export class GameRoomDO extends BaseGameRoomDO<GameState, GameSettings, Env> {
  // ── Abstract implementations ─────────────────────────────────────────────

  protected initializeState(settings: GameSettings): GameState {
    return initializeGame(settings);
  }

  protected serializeState(state: GameState): Record<string, unknown> {
    // Preserve full player racks in storage. serializeGameState strips them
    // (designed for network privacy), but we need them to survive DO eviction.
    const base = serializeGameState(state) as any;
    base.players = state.players.filter(Boolean).map((p) => ({ ...p! }));
    return base as Record<string, unknown>;
  }

  protected deserializeState(data: Record<string, unknown>): GameState {
    return deserializeGameState(data as any);
  }

  protected isPlayerSeated(state: GameState, seat: number): boolean {
    return !!state.players[seat];
  }

  protected getPlayerName(state: GameState, seat: number): string | null {
    return state.players[seat]?.name ?? null;
  }

  protected seatPlayer(state: GameState, seat: number, name: string): GameState {
    const newState: GameState = {
      ...state,
      board: new Map(state.board),
      bag: [...state.bag],
      players: state.players.map((p) => (p ? { ...p, rack: [...p.rack] } : p)),
    };
    newState.players[seat] = { seat, rack: [], score: 0, connected: true, name };
    return newState;
  }

  protected getSeatedCount(state: GameState): number {
    return state.players.filter(Boolean).length;
  }

  protected async onAllPlayersSeated(): Promise<void> {
    if (!this.gameState || !this.settings) return;

    // Deal 5 tiles to each player
    const bag = [...this.gameState.bag];
    const initialDraws: Array<{ seat: number; tiles: Tile[] }> = [];
    for (let seat = 0; seat < this.settings.maxPlayers; seat++) {
      const tiles = bag.splice(0, 5);
      initialDraws.push({ seat, tiles });
    }

    const startMove: MoveRecord = {
      seat: 0,
      sequence: this.nextSequence++,
      moveType: "start",
      data: { type: "start", initialDraws },
      scoreEarned: 0,
    };

    this.gameState = applyMove(this.gameState, startMove);
    await this.persistState();
    await this.syncStatusToDB();

    // Send each player their own rack privately
    const publicState = serializeGameState(this.gameState);
    for (const ws of this.state.getWebSockets()) {
      const tags = this.state.getTags(ws);
      const seat = parseInt(tags[0] ?? "-1");
      const rack = seat >= 0 && this.gameState.players[seat]
        ? this.gameState.players[seat].rack
        : [];
      try {
        ws.send(JSON.stringify({
          type: "game_state",
          state: publicState,
          yourSeat: seat,
          yourRack: rack,
        }));
      } catch {
        // Socket closed
      }
    }
  }

  protected async onGameMessage(
    ws: WebSocket,
    rawMsg: unknown,
    seat: number,
    playerName: string,
  ): Promise<void> {
    if (!this.gameState || !this.settings) return;

    const result = ClientMessage.safeParse(rawMsg);
    if (!result.success) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }

    const msg = result.data;

    switch (msg.type) {
      case "place_tiles":
        await this.handlePlaceTiles(ws, seat, msg.placements);
        break;
      case "pass_turn":
        await this.handlePass(ws, seat);
        break;
      case "exchange_tiles":
        await this.handleExchange(ws, seat, msg.tileIds);
        break;
      case "chat":
        this.broadcast(JSON.stringify({
          type: "chat_broadcast",
          seat,
          presetId: msg.presetId,
          playerName: this.gameState.players[seat]?.name ?? playerName,
        }));
        break;
    }
  }

  protected getPrivateStateForSeat(seat: number): Record<string, unknown> {
    return {
      yourSeat: seat,
      yourRack: seat >= 0 && this.gameState?.players[seat]
        ? this.gameState.players[seat].rack
        : [],
    };
  }

  protected onPlayerDisconnected(seat: number): void {
    if (this.gameState?.players[seat]) {
      this.gameState.players[seat].connected = false;
    }
  }

  // ── Game message handlers ────────────────────────────────────────────────

  private async handlePlaceTiles(
    ws: WebSocket,
    seat: number,
    rawPlacements: Array<{ row: number; col: number; tileId: number; flipped: boolean }>,
  ) {
    if (!this.gameState) return;

    if (this.gameState.currentTurn !== seat) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const player = this.gameState.players[seat];
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
      return;
    }

    let placements: { row: number; col: number; tile: Tile }[];
    try {
      placements = rawPlacements.map((p) => {
        const tile = player.rack.find((t) => t.id === p.tileId);
        if (!tile) throw new Error(`Tile ${p.tileId} not in rack — rack may be stale, try refreshing`);
        return { row: p.row, col: p.col, tile: { ...tile, flipped: p.flipped } };
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      return;
    }

    const validation = validateMove(
      this.gameState.board,
      placements,
      player.rack,
      !this.gameState.firstMoveMade,
    );

    if (!validation.valid) {
      ws.send(JSON.stringify({ type: "error", message: validation.reason }));
      return;
    }

    const scored = scoreMove(
      this.gameState.board,
      placements,
      !this.gameState.firstMoveMade,
      placements.length,
    );

    const moveRecord: MoveRecord = {
      seat,
      sequence: this.nextSequence++,
      moveType: "place",
      data: { type: "place", placements } satisfies PlaceMoveData,
      scoreEarned: scored.total,
    };

    this.gameState = applyMove(this.gameState, moveRecord);
    await this.persistState();
    await this.persistMoveToDB(moveRecord);

    this.broadcast(JSON.stringify({
      type: "move_made",
      move: moveRecord,
      scores: this.gameState.players.map((p) => p.score),
      nextTurn: this.gameState.currentTurn,
      bagCount: this.gameState.bag.length,
    }));

    // Send the placing player their new rack privately
    const newRack = this.gameState.players[seat]?.rack ?? [];
    ws.send(JSON.stringify({ type: "tiles_drawn", tiles: newRack }));

    if (this.gameState.status === "finished") {
      await this.syncStatusToDB();
      this.broadcast(JSON.stringify({
        type: "game_over",
        finalScores: this.gameState.players.map((p) => p.score),
        winner: this.gameState.winner,
      }));
    }
  }

  private async handlePass(ws: WebSocket, seat: number) {
    if (!this.gameState) return;

    if (this.gameState.currentTurn !== seat) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const moveRecord: MoveRecord = {
      seat,
      sequence: this.nextSequence++,
      moveType: "pass",
      data: { type: "pass" },
      scoreEarned: 0,
    };

    this.gameState = applyMove(this.gameState, moveRecord);
    await this.persistState();
    await this.persistMoveToDB(moveRecord);

    this.broadcast(JSON.stringify({
      type: "move_made",
      move: moveRecord,
      scores: this.gameState.players.map((p) => p.score),
      nextTurn: this.gameState.currentTurn,
      bagCount: this.gameState.bag.length,
    }));

    if (this.gameState.status === "finished") {
      await this.syncStatusToDB();
      this.broadcast(JSON.stringify({
        type: "game_over",
        finalScores: this.gameState.players.map((p) => p.score),
        winner: this.gameState.winner,
      }));
    }
  }

  private async handleExchange(ws: WebSocket, seat: number, tileIds: number[]) {
    if (!this.gameState) return;

    if (this.gameState.currentTurn !== seat) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    if (this.gameState.bag.length < tileIds.length) {
      ws.send(JSON.stringify({ type: "error", message: "Not enough tiles in bag to exchange" }));
      return;
    }

    const drawnTileIds = this.gameState.bag.slice(0, tileIds.length).map((t) => t.id);

    const moveRecord: MoveRecord = {
      seat,
      sequence: this.nextSequence++,
      moveType: "exchange",
      data: {
        type: "exchange",
        returnedTileIds: tileIds,
        drawnTileIds,
      } satisfies ExchangeMoveData,
      scoreEarned: 0,
    };

    this.gameState = applyMove(this.gameState, moveRecord);
    await this.persistState();
    await this.persistMoveToDB(moveRecord);

    this.broadcast(JSON.stringify({
      type: "move_made",
      move: moveRecord,
      scores: this.gameState.players.map((p) => p.score),
      nextTurn: this.gameState.currentTurn,
      bagCount: this.gameState.bag.length,
    }));

    const newRack = this.gameState.players[seat]?.rack ?? [];
    ws.send(JSON.stringify({ type: "tiles_drawn", tiles: newRack }));
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private async persistMoveToDB(move: MoveRecord) {
    if (!this.gameId) return;
    try {
      const db = this.env.D1_DATABASE;
      await db
        .prepare(
          `INSERT INTO Move (id, gameId, seat, sequence, moveType, data, scoreEarned, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT (gameId, sequence) DO NOTHING`,
        )
        .bind(
          crypto.randomUUID(),
          this.gameId,
          move.seat,
          move.sequence,
          move.moveType,
          JSON.stringify(move.data),
          move.scoreEarned,
        )
        .run();
    } catch {
      // Non-fatal — DO is authoritative
    }
  }

  private async syncStatusToDB() {
    if (!this.gameId || !this.gameState) return;
    try {
      const db = this.env.D1_DATABASE;
      const { status, players } = this.gameState;

      if (status === "active") {
        await db
          .prepare(`UPDATE Game SET status = 'active' WHERE id = ? AND status = 'waiting'`)
          .bind(this.gameId)
          .run();
      } else if (status === "finished") {
        await db
          .prepare(`UPDATE Game SET status = 'finished', finishedAt = datetime('now') WHERE id = ?`)
          .bind(this.gameId)
          .run();
        for (const p of players) {
          if (!p) continue;
          await db
            .prepare(`UPDATE GamePlayer SET score = ? WHERE gameId = ? AND seat = ?`)
            .bind(p.score, this.gameId, p.seat)
            .run();
        }
      }
    } catch {
      // Non-fatal
    }
  }
}
