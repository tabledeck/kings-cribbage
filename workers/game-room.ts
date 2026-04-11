import {
  initializeGame,
  applyMove,
  serializeGameState,
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

export class GameRoomDO {
  private state: DurableObjectState;
  private env: Env;
  private gameState: GameState | null = null;
  private settings: GameSettings | null = null;
  private nextSequence = 0;
  private gameId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/ws" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const seatParam = url.searchParams.get("seat");
      const name = url.searchParams.get("name") ?? "Guest";
      const seat = seatParam !== null ? parseInt(seatParam) : -1;

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Store seat and name as tags for hibernation
      this.state.acceptWebSocket(server, [String(seat), name]);

      // Lazy-init game state from storage
      await this.ensureState();

      // Send current state to connecting player
      if (this.gameState) {
        const msg = {
          type: "game_state",
          state: serializeGameState(this.gameState),
          yourSeat: seat,
          yourRack:
            seat >= 0 && this.gameState.players[seat]
              ? this.gameState.players[seat].rack
              : [],
        };
        server.send(JSON.stringify(msg));

        // Announce (re)connection to all OTHER connected clients
        if (seat >= 0 && this.gameState.players[seat]) {
          const playerName = this.gameState.players[seat].name ?? name;
          const joinMsg = JSON.stringify({ type: "player_joined", seat, name: playerName });
          for (const ws of this.state.getWebSockets()) {
            if (ws === server) continue;
            try { ws.send(joinMsg); } catch {}
          }
        }
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/create" && request.method === "POST") {
      const body = (await request.json()) as {
        settings: GameSettings;
        gameId: string;
      };
      this.settings = body.settings;
      this.gameId = body.gameId;
      this.gameState = initializeGame(body.settings);
      await this.state.storage.put("gameState", serializeGameState(this.gameState));
      await this.state.storage.put("settings", this.settings);
      await this.state.storage.put("gameId", this.gameId);
      await this.state.storage.put("nextSequence", 0);
      return new Response(JSON.stringify({ ok: true }));
    }

    if (url.pathname === "/state" && request.method === "GET") {
      await this.ensureState();
      if (!this.gameState) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          state: serializeGameState(this.gameState),
          settings: this.settings,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Register a player join from the HTTP action (authoritative, server-initiated)
    if (url.pathname === "/join" && request.method === "POST") {
      const body = (await request.json()) as { seat: number; name: string };
      await this.ensureState();
      if (!this.gameState || !this.settings) {
        return new Response("Not initialized", { status: 500 });
      }
      await this.handleJoin(null, body.seat, body.name);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const result = ClientMessage.safeParse(parsed);
    if (!result.success) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }

    const msg = result.data;
    const tags = this.state.getTags(ws);
    const seat = parseInt(tags[0] ?? "-1");
    const playerName = tags[1] ?? "Guest";

    await this.ensureState();
    if (!this.gameState || !this.settings) return;

    switch (msg.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      case "join_game":
        await this.handleJoin(ws, seat, msg.name ?? playerName);
        break;

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
        this.broadcast(
          JSON.stringify({
            type: "chat_broadcast",
            seat,
            presetId: msg.presetId,
            playerName:
              this.gameState.players[seat]?.name ?? playerName,
          }),
        );
        break;
    }
  }

  webSocketClose(ws: WebSocket) {
    const tags = this.state.getTags(ws);
    const seat = parseInt(tags[0] ?? "-1");
    if (seat >= 0 && this.gameState?.players[seat]) {
      this.gameState.players[seat].connected = false;
      this.broadcast(
        JSON.stringify({ type: "player_disconnected", seat }),
      );
    }
    ws.close();
  }

  webSocketError(ws: WebSocket) {
    ws.close();
  }

  private async handleJoin(ws: WebSocket | null, seat: number, name: string) {
    if (!this.gameState || !this.settings) return;

    const availableSeat =
      seat >= 0 && seat < this.settings.maxPlayers ? seat : this.findOpenSeat();
    if (availableSeat === -1) {
      ws?.send(JSON.stringify({ type: "error", message: "Game is full" }));
      return;
    }

    // Idempotent: if player already in state, just re-broadcast their presence
    if (this.gameState.players[availableSeat]) {
      this.broadcast(
        JSON.stringify({ type: "player_joined", seat: availableSeat, name }),
      );
      return;
    }

    const joinMove: MoveRecord = {
      seat: availableSeat,
      sequence: this.nextSequence++,
      moveType: "join",
      data: { type: "join", seat: availableSeat, name },
      scoreEarned: 0,
    };

    this.gameState = applyMove(this.gameState, joinMove);
    await this.persistState();

    this.broadcast(
      JSON.stringify({ type: "player_joined", seat: availableSeat, name }),
    );

    // If all seats filled, start the game
    const activePlayers = this.gameState.players.filter(Boolean);
    if (activePlayers.length === this.settings.maxPlayers) {
      await this.startGame();
    }
  }

  private async startGame() {
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
    await this.syncStatusToDB(); // status → active

    // Broadcast game state (without racks) to all
    const stateMsg = {
      type: "game_state",
      state: serializeGameState(this.gameState),
      yourSeat: -1,
      yourRack: [],
    };

    // Send each player their own rack privately
    for (const ws of this.state.getWebSockets()) {
      const tags = this.state.getTags(ws);
      const seat = parseInt(tags[0] ?? "-1");
      const rack =
        seat >= 0 && this.gameState.players[seat]
          ? this.gameState.players[seat].rack
          : [];
      ws.send(
        JSON.stringify({ ...stateMsg, yourSeat: seat, yourRack: rack }),
      );
    }
  }

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

    // Map tile IDs to actual Tile objects from the player's rack
    const placements = rawPlacements.map((p) => {
      const tile = player.rack.find((t) => t.id === p.tileId);
      if (!tile) throw new Error(`Tile ${p.tileId} not in rack`);
      return { row: p.row, col: p.col, tile: { ...tile, flipped: p.flipped } };
    });

    // Validate
    const validation = validateMove(
      this.gameState.board,
      placements,
      player.rack,
      !this.gameState.firstMoveMade,
    );

    if (!validation.valid) {
      ws.send(
        JSON.stringify({ type: "error", message: validation.reason }),
      );
      return;
    }

    // Score
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

    // Persist move to D1 via the worker (we call back to the app)
    await this.persistMoveToDB(moveRecord);

    const moveMadeMsg = {
      type: "move_made",
      move: moveRecord,
      scores: this.gameState.players.map((p) => p.score),
      nextTurn: this.gameState.currentTurn,
      bagCount: this.gameState.bag.length,
    };

    // Broadcast move to all (without the drawer's new tiles)
    this.broadcast(JSON.stringify(moveMadeMsg));

    // Send the placing player their new rack privately
    const newRack = this.gameState.players[seat]?.rack ?? [];
    ws.send(JSON.stringify({ type: "tiles_drawn", tiles: newRack }));

    if (this.gameState.status === "finished") {
      await this.syncStatusToDB(); // status → finished, scores saved
      this.broadcast(
        JSON.stringify({
          type: "game_over",
          finalScores: this.gameState.players.map((p) => p.score),
          winner: this.gameState.winner,
        }),
      );
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

    this.broadcast(
      JSON.stringify({
        type: "move_made",
        move: moveRecord,
        scores: this.gameState.players.map((p) => p.score),
        nextTurn: this.gameState.currentTurn,
        bagCount: this.gameState.bag.length,
      }),
    );

    if (this.gameState.status === "finished") {
      await this.syncStatusToDB();
      this.broadcast(
        JSON.stringify({
          type: "game_over",
          finalScores: this.gameState.players.map((p) => p.score),
          winner: this.gameState.winner,
        }),
      );
    }
  }

  private async handleExchange(
    ws: WebSocket,
    seat: number,
    tileIds: number[],
  ) {
    if (!this.gameState) return;

    if (this.gameState.currentTurn !== seat) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    if (this.gameState.bag.length < tileIds.length) {
      ws.send(
        JSON.stringify({ type: "error", message: "Not enough tiles in bag to exchange" }),
      );
      return;
    }

    // Draw replacement tiles from bag (first N)
    const drawnTileIds = this.gameState.bag
      .slice(0, tileIds.length)
      .map((t) => t.id);

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

    this.broadcast(
      JSON.stringify({
        type: "move_made",
        move: moveRecord,
        scores: this.gameState.players.map((p) => p.score),
        nextTurn: this.gameState.currentTurn,
        bagCount: this.gameState.bag.length,
      }),
    );

    // Send new rack to the exchanging player privately
    const newRack = this.gameState.players[seat]?.rack ?? [];
    ws.send(JSON.stringify({ type: "tiles_drawn", tiles: newRack }));
  }

  private findOpenSeat(): number {
    if (!this.gameState || !this.settings) return -1;
    for (let i = 0; i < this.settings.maxPlayers; i++) {
      if (!this.gameState.players[i]) return i;
    }
    return -1;
  }

  private broadcast(message: string) {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // Socket closed; skip
      }
    }
  }

  private async ensureState() {
    if (this.gameState) return;

    const stored = await this.state.storage.get<ReturnType<typeof serializeGameState>>("gameState");
    const settings = await this.state.storage.get<GameSettings>("settings");
    const seq = await this.state.storage.get<number>("nextSequence");

    if (stored && settings) {
      const { deserializeGameState } = await import("../app/domain/game-logic");
      this.gameState = deserializeGameState(stored as any);
      this.settings = settings;
      this.nextSequence = seq ?? 0;
      this.gameId = await this.state.storage.get<string>("gameId") ?? null;
    }
  }

  private async persistState() {
    if (!this.gameState) return;
    await this.state.storage.put("gameState", serializeGameState(this.gameState));
    await this.state.storage.put("nextSequence", this.nextSequence);
  }

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
        // Update final scores on GamePlayer rows
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
