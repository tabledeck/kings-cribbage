// Shared WebSocket message types — validated with Zod on both sides
import { z } from "zod";

// ---- Client → Server ----

export const PlaceTilesMsg = z.object({
  type: z.literal("place_tiles"),
  placements: z.array(
    z.object({
      row: z.number().int().min(0).max(12),
      col: z.number().int().min(0).max(12),
      tileId: z.number().int(),
      flipped: z.boolean().default(false),
    }),
  ),
});

export const PassTurnMsg = z.object({ type: z.literal("pass_turn") });

export const ExchangeTilesMsg = z.object({
  type: z.literal("exchange_tiles"),
  tileIds: z.array(z.number().int()).min(1).max(5),
});

export const ChatMsg = z.object({
  type: z.literal("chat"),
  presetId: z.number().int().min(0).max(17),
});

export const JoinGameMsg = z.object({
  type: z.literal("join_game"),
  name: z.string().min(1).max(20),
  seat: z.number().int().min(0).max(3).optional(),
});

export const ClientMessage = z.discriminatedUnion("type", [
  PlaceTilesMsg,
  PassTurnMsg,
  ExchangeTilesMsg,
  ChatMsg,
  JoinGameMsg,
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessageType = z.infer<typeof ClientMessage>;

// ---- Server → Client ----
// These are not Zod-validated (we control the server), just typed interfaces.

export interface GameStateMsg {
  type: "game_state";
  state: unknown; // serialized GameState
  yourSeat: number;
  yourRack: unknown[]; // Tile[]
}

export interface MoveMadeMsg {
  type: "move_made";
  move: unknown; // MoveRecord
  scores: number[]; // indexed by seat
  nextTurn: number;
  bagCount: number;
}

export interface TilesDrawnMsg {
  type: "tiles_drawn";
  tiles: unknown[]; // Tile[] — sent only to the drawing player
}

export interface PlayerJoinedMsg {
  type: "player_joined";
  seat: number;
  name: string;
}

export interface PlayerDisconnectedMsg {
  type: "player_disconnected";
  seat: number;
}

export interface ChatBroadcastMsg {
  type: "chat_broadcast";
  seat: number;
  presetId: number;
  playerName: string;
}

export interface GameOverMsg {
  type: "game_over";
  finalScores: number[];
  winner: number;
}

export interface ErrorMsg {
  type: "error";
  message: string;
}

export interface PongMsg {
  type: "pong";
}

export type ServerMessage =
  | GameStateMsg
  | MoveMadeMsg
  | TilesDrawnMsg
  | PlayerJoinedMsg
  | PlayerDisconnectedMsg
  | ChatBroadcastMsg
  | GameOverMsg
  | ErrorMsg
  | PongMsg;
