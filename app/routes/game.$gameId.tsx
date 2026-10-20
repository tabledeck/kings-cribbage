import { useState, useCallback, useEffect, useRef } from "react";
import { WIN_SCORE_THRESHOLD } from "~/domain/game-logic";
import { data, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/game.$gameId";
import { getPrisma } from "~/db.server";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { deserializeBoard, posKey } from "~/domain/board";
import { validateMove } from "~/domain/validation";
import type { Placement } from "~/domain/scoring";
import { getInvalidPlacements } from "~/domain/scoring";
import type { Tile } from "~/domain/tiles";
import type { ServerMessage } from "~/domain/messages";
import { Board } from "~/components/board/Board";
import { TileRack } from "~/components/game/TileRack";
import { ScoreBoard } from "~/components/game/ScoreBoard";
import { GameControls } from "~/components/game/GameControls";
import { Chat } from "~/components/chat/Chat";
import { TileDisplay } from "~/components/board/Tile";
import { MuteIcon } from "~/components/icons/MuteIcon";
import { BtnPrimary } from "~/components/tabledeck/BtnPrimary";
import { useGameWebSocket } from "@tabledeck/game-room/client";
import { useSounds } from "~/hooks/useSounds";
import { useScorePopups } from "~/components/game/ScorePopup";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Game ${params.gameId} — King's Cribbage` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { gameId } = params;
  const db = getPrisma(context);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: { include: { user: true } }, moves: { orderBy: { sequence: "asc" } } },
  });

  if (!game) throw redirect("/");

  const user = getOptionalUserFromContext(context);
  const settings = JSON.parse(game.settings) as { seed: number; maxPlayers: number };

  // Determine this visitor's seat
  let mySeat = -1;
  let myName = "Guest";

  if (user) {
    const myPlayer = game.players.find((p) => p.userId === user.id);
    if (myPlayer) {
      mySeat = myPlayer.seat;
      myName = user.name || user.email;
    } else if (game.players.length < game.maxPlayers && game.status === "waiting") {
      // Auto-assign a seat
      const usedSeats = new Set(game.players.map((p) => p.seat));
      for (let s = 0; s < game.maxPlayers; s++) {
        if (!usedSeats.has(s)) {
          mySeat = s;
          break;
        }
      }
      myName = user.name || user.email;
      if (mySeat >= 0) {
        // Sync user into D1_DATABASE (users live in AUTH_DB; D1 enforces FK constraints)
        await db.user.upsert({
          where: { id: user.id },
          create: { id: user.id, email: user.email, name: user.name || "" },
          update: { name: user.name || "", email: user.email },
        });
        await db.gamePlayer.create({
          data: { gameId, userId: user.id, seat: mySeat },
        });
      }
    }
  } else {
    // Check for a guest session cookie from a previous join
    const cookieHeader = request.headers.get("Cookie") ?? "";
    const cookieName = `kc_${gameId}`;
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`));
    if (match) {
      const [rawSeat, ...nameParts] = match.slice(cookieName.length + 1).split(":");
      const savedSeat = parseInt(rawSeat, 10);
      const savedName = decodeURIComponent(nameParts.join(":"));
      const existing = game.players.find((p) => p.seat === savedSeat && p.guestName === savedName);
      if (existing) {
        mySeat = savedSeat;
        myName = savedName;
      }
    }
  }

  // Get shareable URL
  const url = new URL(request.url);
  const shareUrl = `${url.protocol}//${url.host}/game/${gameId}`;

  // Notify DO about this seated player so it can seat them and trigger onAllPlayersSeated.
  // handleJoin is idempotent — safe to call on every page load / reconnect.
  if (mySeat >= 0) {
    try {
      const env = (context as any).cloudflare?.env as Env | undefined;
      if (env) {
        const doId = env.GAME_ROOM.idFromName(gameId);
        const stub = env.GAME_ROOM.get(doId);
        await stub.fetch(new Request("http://internal/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seat: mySeat, name: myName }),
        }));
      }
    } catch {
      // Non-fatal — WS connect will recover via getPrivateStateForSeat
    }
  }

  // Fetch game state from Durable Object (for SSR)
  let boardData: unknown = null;
  let doPlayers: unknown[] = [];
  try {
    const env = (context as any).cloudflare?.env as Env | undefined;
    if (env) {
      const doId = env.GAME_ROOM.idFromName(gameId);
      const stub = env.GAME_ROOM.get(doId);
      const stateRes = await stub.fetch(
        new Request(`http://internal/state`),
      );
      if (stateRes.ok) {
        const stateData = (await stateRes.json()) as { state: any };
        boardData = stateData.state?.board ?? null;
        doPlayers = stateData.state?.players ?? [];
      }
    }
  } catch {
    // DO not initialized yet
  }

  return data({
    gameId,
    mySeat,
    myName,
    shareUrl,
    settings,
    gameStatus: game.status,
    maxPlayers: game.maxPlayers,
    dbPlayers: game.players.map((p) => ({
      seat: p.seat,
      name: p.user?.name || p.user?.email || p.guestName || "Guest",
      score: p.score,
    })),
    boardData,
    doPlayers,
  });
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { gameId } = params;
  const body = await request.json() as { guestName?: string };

  if (body.guestName) {
    const db = getPrisma(context);
    const game = await db.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) return data({ error: "Game not found" }, { status: 404 });
    if (game.status === "finished") return data({ error: "Game is over" }, { status: 400 });

    const usedSeats = new Set(game.players.map((p) => p.seat));
    let seat = -1;
    for (let s = 0; s < game.maxPlayers; s++) {
      if (!usedSeats.has(s)) { seat = s; break; }
    }
    if (seat === -1) return data({ error: "Game is full" }, { status: 400 });

    await db.gamePlayer.create({
      data: { gameId, guestName: body.guestName, seat },
    });

    // Notify the DO so it can apply the join and broadcast player_joined to all WS clients
    try {
      const env = (context as any).cloudflare?.env as Env | undefined;
      if (env) {
        const doId = env.GAME_ROOM.idFromName(gameId);
        const stub = env.GAME_ROOM.get(doId);
        await stub.fetch(new Request("http://internal/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seat, name: body.guestName }),
        }));
      }
    } catch {
      // Non-fatal — client will still get state on WS connect
    }

    // Set a cookie so the guest can reclaim this seat on refresh
    const cookieName = `kc_${gameId}`;
    const cookieValue = `${seat}:${encodeURIComponent(body.guestName)}`;
    return data(
      { seat, name: body.guestName },
      {
        headers: {
          "Set-Cookie": `${cookieName}=${cookieValue}; Path=/; Max-Age=86400; SameSite=Lax`,
        },
      },
    );
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function GameRoom({ loaderData }: Route.ComponentProps) {
  const {
    gameId,
    mySeat: initialSeat,
    myName: initialName,
    shareUrl,
    settings,
    gameStatus,
    maxPlayers,
    dbPlayers,
    boardData,
  } = loaderData;

  // Detect touch device
  const [isTouchDevice] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  // Guest name state
  const [guestName, setGuestName] = useState("");
  const [showNameModal, setShowNameModal] = useState(
    initialSeat === -1 && gameStatus === "waiting",
  );
  const [mySeat, setMySeat] = useState(initialSeat);
  const [myName, setMyName] = useState(initialName);
  const joinFetcher = useFetcher<typeof action>();

  // Game state (received from WebSocket)
  const [board, setBoard] = useState(() =>
    boardData ? deserializeBoard(boardData as any) : new Map(),
  );
  const [players, setPlayers] = useState(
    dbPlayers.map((p) => ({ ...p, connected: true as boolean })),
  );
  const [currentTurn, setCurrentTurn] = useState(0);
  const [bagCount, setBagCount] = useState(104 - maxPlayers * 5);
  const [status, setStatus] = useState(gameStatus);
  const [myRack, setMyRack] = useState<Tile[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<(number | null)[]>([]);
  const [myGuess, setMyGuess] = useState<number | null>(null);
  const [guessReveal, setGuessReveal] = useState<{
    guesses: (number | null)[];
    guessTarget: number;
    firstSeat: number;
  } | null>(null);

  const { play, muted, toggleMute } = useSounds();
  const { popups, addPopup } = useScorePopups();

  // Merge fresh DB players into state whenever the loader revalidates (e.g. after WS
  // reconnect). Keeps real-time WS updates (player_joined) as the primary path but
  // ensures the player list stays in sync if a broadcast was missed.
  useEffect(() => {
    setPlayers((prev) => {
      const byKey = new Map(prev.map((p) => [p.seat, p]));
      for (const dp of dbPlayers) {
        if (!byKey.has(dp.seat)) byKey.set(dp.seat, { ...dp, connected: true });
      }
      return [...byKey.values()].sort((a, b) => a.seat - b.seat);
    });
  }, [dbPlayers]);

  // Staged placement state
  const [stagedPlacements, setStagedPlacements] = useState<Placement[]>([]);
  const [rackFlips, setRackFlips] = useState<Map<number, boolean>>(new Map());
  const [gameError, setGameError] = useState<string | null>(null);
  const [invalidStagedPositions, setInvalidStagedPositions] = useState<Set<string>>(new Set());

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    Array<{ seat: number; text: string; playerName: string; timestamp: number }>
  >([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creatingRematch, setCreatingRematch] = useState(false);
  const [rematchError, setRematchError] = useState("");
  const [rematchOffer, setRematchOffer] = useState<{ url: string; fromName: string; fromSeat: number } | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [liveShareUrl, setLiveShareUrl] = useState(shareUrl);

  // Selected tile for tap-to-place (works with a mouse or a finger)
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  useEffect(() => {
    setLiveShareUrl(`${window.location.origin}/game/${gameId}`);
  }, [gameId]);

  useEffect(() => {
    if (status === "finished") setShowResults(true);
  }, [status]);

  const { send } = useGameWebSocket({
    gameId,
    seat: mySeat,
    name: myName,
    onMessage: useCallback(
      (rawMsg: unknown) => {
        const msg = rawMsg as ServerMessage;
        switch (msg.type) {
          case "game_state": {
            const s = msg.state as any;
            if (s?.board) setBoard(deserializeBoard(s.board));
            if (s?.players) setPlayers(s.players.map((p: any) => ({
              seat: p.seat,
              name: p.name,
              score: p.score,
              connected: p.connected !== false,
            })));
            if (s?.currentTurn !== undefined) setCurrentTurn(s.currentTurn);
            if (s?.status) setStatus(s.status);
            if (s?.status === "guessing") setGuessReveal(null);
            if (s?.guesses) {
              setGuesses(s.guesses);
              if (mySeat >= 0 && s.guesses[mySeat] !== undefined && s.guesses[mySeat] !== null) {
                setMyGuess(s.guesses[mySeat]);
              }
            }
            if (msg.yourRack) setMyRack(msg.yourRack as Tile[]);
            break;
          }
          case "guess_reveal": {
            const gr = msg as any;
            setGuessReveal({
              guesses: gr.guesses,
              guessTarget: gr.guessTarget,
              firstSeat: gr.firstSeat,
            });
            break;
          }
          case "move_made": {
            const m = msg as any;
            const move = m.move;
            if (move?.moveType === "place") {
              play("place");
              setBoard((prev) => {
                const next = new Map(prev);
                for (const p of move.data.placements) {
                  next.set(`${p.row},${p.col}`, {
                    tile: p.tile,
                    seat: move.seat,
                    turnPlaced: move.sequence,
                  });
                }
                return next;
              });
              // Score pop-up at the centroid of the placement
              if (move.scoreEarned > 0 && move.data.placements?.length > 0) {
                const midIdx = Math.floor(move.data.placements.length / 2);
                const anchor = move.data.placements[midIdx];
                addPopup(move.scoreEarned, anchor.row, anchor.col);
                play("score");
              }
            }
            if (m.scores) {
              setPlayers((prev) =>
                prev.map((p) => ({ ...p, score: m.scores[p.seat] ?? p.score })),
              );
            }
            if (m.nextTurn !== undefined) {
              setCurrentTurn(m.nextTurn);
              // Notify this player it's their turn
              if (m.nextTurn === mySeat) play("yourTurn");
            }
            if (m.bagCount !== undefined) setBagCount(m.bagCount);
            break;
          }
          case "tiles_drawn":
            setMyRack(msg.tiles as Tile[]);
            setStagedPlacements([]);
            setGameError(null);
            break;
          case "error":
            setGameError((msg as any).message ?? "Something went wrong");
            break;
          case "player_joined": {
            const pj = msg as any;
            setPlayers((prev) => {
              const exists = prev.find((p) => p.seat === pj.seat);
              if (exists) return prev.map((p) => p.seat === pj.seat ? { ...p, name: pj.name, connected: true } : p);
              return [...prev, { seat: pj.seat, name: pj.name, score: 0, connected: true }];
            });
            break;
          }
          case "player_disconnected": {
            const pd = msg as any;
            setPlayers((prev) =>
              prev.map((p) => p.seat === pd.seat ? { ...p, connected: false } : p),
            );
            break;
          }
          case "chat_broadcast": {
            const cb = msg as any;
            setChatMessages((prev) => [
              ...prev,
              { seat: cb.seat, text: cb.text, playerName: cb.playerName, timestamp: Date.now() },
            ]);
            play("chat");
            break;
          }
          case "game_over": {
            const go = msg as any;
            setStatus("finished");
            play("gameOver");
            setWinner(go.winner);
            if (go.finalScores) {
              setPlayers((prev) =>
                prev.map((p) => ({ ...p, score: go.finalScores[p.seat] ?? p.score })),
              );
            }
            break;
          }
          case "rematch_offer": {
            const offer = msg as any;
            setRematchOffer({ url: offer.url, fromName: offer.fromName, fromSeat: offer.fromSeat });
            if (offer.fromSeat === mySeat && typeof offer.url === "string") {
              window.location.href = offer.url;
            }
            break;
          }
        }
      },
      [addPopup, mySeat, play],
    ),
  });

  useEffect(() => {
    if (!guessReveal) return;
    const timeoutId = window.setTimeout(() => setGuessReveal(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [guessReveal]);

  // Compute invalid staged positions whenever the scoring error is active
  useEffect(() => {
    const SCORING_ERROR = "Placement does not form a valid scoring combination";
    if (gameError === SCORING_ERROR && stagedPlacements.length > 0) {
      const invalid = getInvalidPlacements(board, stagedPlacements);
      setInvalidStagedPositions(new Set(invalid.map((p) => posKey(p.row, p.col))));
    } else {
      setInvalidStagedPositions(new Set());
    }
  }, [gameError, board, stagedPlacements]);

  // On mount, send join_game
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!joinedRef.current && mySeat >= 0) {
      joinedRef.current = true;
      setTimeout(() => {
        send({ type: "join_game", name: myName, seat: mySeat });
      }, 500);
    }
  }, [mySeat, myName, send]);

  const handleJoinAsGuest = () => {
    if (!guestName.trim() || joinFetcher.state !== "idle") return;
    joinFetcher.submit(
      { guestName: guestName.trim() },
      { method: "POST", encType: "application/json" },
    );
  };

  // Close modal and register seat once the join action succeeds
  useEffect(() => {
    if (joinFetcher.state !== "idle" || !joinFetcher.data) return;
    const result = joinFetcher.data as { seat?: number; name?: string; error?: string };
    if (result.seat !== undefined && result.name) {
      setMySeat(result.seat);
      setMyName(result.name);
      setShowNameModal(false);
      // Optimistically add ourselves to the player list immediately
      setPlayers((prev) => {
        if (prev.find((p) => p.seat === result.seat)) return prev;
        return [...prev, { seat: result.seat!, name: result.name!, score: 0, connected: true }];
      });
    }
  }, [joinFetcher.state, joinFetcher.data]);

  const [activeTile, setActiveTile] = useState<Tile | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const tile = event.active.data.current?.tile as Tile | undefined;
    if (tile) setActiveTile(tile);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTile(null);
      const tile = event.active.data.current?.tile as Tile | undefined;
      const cellData = event.over?.data.current as { row: number; col: number } | undefined;
      if (!tile || !cellData) return;
      if (currentTurn !== mySeat || status !== "active") return;
      setStagedPlacements((prev) => {
        const key = `${cellData.row},${cellData.col}`;
        if (prev.find((p) => `${p.row},${p.col}` === key)) return prev;
        if (prev.find((p) => p.tile.id === tile.id)) return prev;
        return [...prev, { row: cellData.row, col: cellData.col, tile }];
      });
      setSelectedTileId(null);
    },
    [currentTurn, mySeat, status],
  );

  const handleStageTile = useCallback((placement: Placement) => {
    setStagedPlacements((prev) => {
      const key = `${placement.row},${placement.col}`;
      const alreadyThere = prev.find(
        (p) => `${p.row},${p.col}` === key,
      );
      if (alreadyThere) return prev;
      const tileAlreadyPlaced = prev.find((p) => p.tile.id === placement.tile.id);
      if (tileAlreadyPlaced) return prev;
      return [...prev, placement];
    });
    setSelectedTileId(null);
  }, []);

  const handleFlipTile = useCallback((tileId: number) => {
    // Flip in rack
    setMyRack((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, flipped: !t.flipped } : t)),
    );
    // Flip in staged placements
    setStagedPlacements((prev) =>
      prev.map((p) =>
        p.tile.id === tileId ? { ...p, tile: { ...p.tile, flipped: !p.tile.flipped } } : p,
      ),
    );
  }, []);

  const effectiveMyGuess = mySeat >= 0 && guesses[mySeat] !== undefined && guesses[mySeat] !== null
    ? guesses[mySeat]
    : myGuess;

  const handleGuessNumber = useCallback((n: number) => {
    if (effectiveMyGuess !== null || status !== "guessing") return;
    setMyGuess(n);
    send({ type: "guess_number", number: n });
  }, [effectiveMyGuess, status, send]);

  const handleConfirm = useCallback(() => {
    if (stagedPlacements.length === 0) return;
    const validation = validateMove(
      board,
      stagedPlacements,
      myRack,
      board.size === 0,
    );
    if (!validation.valid) {
      setGameError(validation.reason);
      return;
    }
    setGameError(null);
    send({
      type: "place_tiles",
      placements: stagedPlacements.map((p) => ({
        row: p.row,
        col: p.col,
        tileId: p.tile.id,
        flipped: p.tile.flipped,
      })),
    });
  }, [stagedPlacements, board, myRack, send]);

  const handleReset = useCallback(() => {
    setStagedPlacements([]);
    setSelectedTileId(null);
    setGameError(null);
  }, []);

  const handlePass = useCallback(() => {
    send({ type: "pass_turn" });
  }, [send]);

  const handleCopyLink = async () => {
    const url = liveShareUrl;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (isTouchDevice && nav.share) {
      try {
        await nav.share({ title: "King's Cribbage", text: "Join my game", url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRematch = async () => {
    if (creatingRematch) return;
    setCreatingRematch(true);
    setRematchError("");

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rematchOf: gameId }),
      });
      const body = (await response.json()) as { gameId?: string; error?: string };

      if (!response.ok || !body.gameId) {
        setRematchError(body.error ?? "Failed to create rematch.");
        setCreatingRematch(false);
        return;
      }

      const nextUrl = `/game/${body.gameId}`;
      send({ type: "rematch_offer", url: nextUrl });
      // The socket echo navigates us. If it never arrives, go anyway.
      window.setTimeout(() => {
        if (window.location.pathname !== nextUrl) window.location.href = nextUrl;
      }, 700);
    } catch {
      setRematchError("Network error. Please try again.");
      setCreatingRematch(false);
    }
  };

  const isMyTurn = currentTurn === mySeat && status === "active";
  const stagedIds = new Set(stagedPlacements.map((p) => p.tile.id));

  // Sort players by seat
  const sortedPlayers = [...players].sort((a, b) => a.seat - b.seat);
  const displayPlayers = status === "waiting"
    ? Array.from({ length: maxPlayers }, (_, seat) => {
        const seated = sortedPlayers.find((p) => p.seat === seat);
        return seated ?? { seat, name: "Open seat", score: 0, connected: false, empty: true };
      })
    : sortedPlayers;
  const activeName = sortedPlayers.find((p) => p.seat === currentTurn)?.name;
  const turnBanner =
    status === "waiting"
      ? `Waiting for players · ${sortedPlayers.length} of ${maxPlayers}`
      : status === "guessing"
        ? mySeat >= 0 && effectiveMyGuess === null
          ? "Guess a number from 1 to 10. Closest goes first."
          : "Waiting for the other guesses"
        : status === "finished"
          ? "Game over"
          : isMyTurn
            ? board.size === 0
              ? "Your turn — play through the crown"
              : "Your turn"
            : activeName
              ? `Waiting for ${activeName}`
              : "Waiting for the other player";

  return (
    <div className="td-surface game-room">
      {/* Guest name modal */}
      {showNameModal && (
        <div className="td-modal-overlay">
          <div className="td-modal">
            <h2>Join Game</h2>
            <p>
              Enter a name to play as a guest, or{" "}
              <a href="/login" style={{ color: "var(--gold)", textDecoration: "underline" }}>
                sign in
              </a>{" "}
              for a profile.
            </p>
            {(joinFetcher.data as any)?.error && (
              <p className="td-error mb-3">
                {(joinFetcher.data as any).error}
              </p>
            )}
            <input
              autoFocus
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinAsGuest()}
              maxLength={20}
              disabled={joinFetcher.state !== "idle"}
            />
            <BtnPrimary
              onClick={handleJoinAsGuest}
              disabled={joinFetcher.state !== "idle" || !guestName.trim()}
            >
              {joinFetcher.state !== "idle" ? "Joining…" : "Take a seat"}
            </BtnPrimary>
            <a
              href="/"
              className="block w-full text-center font-sans text-sm mt-2 py-2"
              style={{ color: "var(--ink-faint)" }}
            >
              Cancel
            </a>
          </div>
        </div>
      )}

      {/* Leave confirm */}
      {confirmLeave && (
        <div className="td-modal-overlay">
          <div className="td-modal text-center">
            <h2>Leave this table?</h2>
            <p>Your opponent will see that you disconnected. The game stays here if you come back.</p>
            <BtnPrimary onClick={() => { window.location.href = "/"; }}>
              Leave
            </BtnPrimary>
            <button type="button" className="btn-ghost" onClick={() => setConfirmLeave(false)}>
              Keep playing
            </button>
          </div>
        </div>
      )}

      {/* Game over modal */}
      {status === "finished" && showResults && (
        <div className="td-modal-overlay">
          <div className="td-modal text-center">
            <h2 className="font-serif" style={{ color: "var(--walnut)" }}>
              Game Over
            </h2>
            {winner !== null && (
              <p
                className="font-serif mb-4"
                style={{ fontSize: 18, color: "var(--gold)", fontStyle: "italic" }}
              >
                {sortedPlayers.find((p) => p.seat === winner)?.name ?? "Unknown"} wins
              </p>
            )}
            <div className="space-y-2 mb-5">
              {[...sortedPlayers]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <div key={p.seat} className="flex justify-between font-sans" style={{ color: "var(--ink-soft)", fontSize: 15 }}>
                    <span className="font-serif">{p.name}{p.seat === mySeat ? " (you)" : ""}</span>
                    <span className="font-mono font-bold" style={{ color: "var(--walnut)" }}>{p.score} pts</span>
                  </div>
                ))}
            </div>
            {rematchOffer && rematchOffer.fromSeat !== mySeat && (
              <p className="font-sans text-sm mb-3" style={{ color: "var(--forest)" }}>
                {rematchOffer.fromName} opened a rematch.
              </p>
            )}
            {rematchError && (
              <p className="td-error mb-3">
                {rematchError}
              </p>
            )}
            {rematchOffer && rematchOffer.fromSeat !== mySeat ? (
              <BtnPrimary onClick={() => { window.location.href = rematchOffer.url; }}>
                Join rematch
              </BtnPrimary>
            ) : (
              <BtnPrimary onClick={handleRematch} disabled={creatingRematch}>
                {creatingRematch ? "Starting rematch..." : "Rematch"}
              </BtnPrimary>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowResults(false)}
            >
              See the board
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { window.location.href = "/"; }}
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <button
          type="button"
          className="header-action"
          onClick={() => {
            if (status === "active" || status === "guessing") setConfirmLeave(true);
            else window.location.href = "/";
          }}
        >
          Leave
        </button>
        <h1>King&rsquo;s Cribbage</h1>
        <div className="header-actions">
          <button
            onClick={toggleMute}
            className="header-icon"
            title={muted ? "Unmute" : "Mute"}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            <MuteIcon muted={muted} />
          </button>
          <button
            onClick={handleCopyLink}
            className="header-action header-action-gold"
          >
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      </div>

      <div
        className={`turn-banner ${isMyTurn ? "is-you" : ""} ${status === "finished" ? "is-over" : ""}`}
        role="status"
        aria-live="polite"
      >
        <span>{turnBanner}</span>
        {status === "finished" && !showResults && (
          <button type="button" className="banner-link" onClick={() => setShowResults(true)}>
            Results
          </button>
        )}
        {(status === "active" || status === "finished") && (
          <span className="banner-goal"> · to {WIN_SCORE_THRESHOLD}</span>
        )}
      </div>

      {/* Waiting state */}
      {status === "waiting" && (
        <div className="td-status-card w-full max-w-lg">
          <h3>Waiting for players ({sortedPlayers.length}/{maxPlayers})</h3>
          <p className="font-sans text-sm mb-3" style={{ color: "var(--ink-faint)" }}>
            Share this link with your friends:
          </p>
          <BtnPrimary onClick={handleCopyLink} fullWidth={false} className="mx-auto" style={{ width: "auto", display: "inline-flex" }}>
            {copied ? "Copied!" : "Copy invite link"}
          </BtnPrimary>
          <p className="font-mono text-xs mt-2" style={{ color: "var(--ink-soft)", wordBreak: "break-all" }}>
            {liveShareUrl}
          </p>
          <p className="font-sans text-sm mt-3" style={{ color: "var(--ink-soft)" }}>
            The deal starts when every seat is filled.
          </p>
        </div>
      )}

      {/* Guessing phase */}
      {guessReveal ? (
        <div className="td-status-card w-full max-w-lg">
          <h3>
            The number was <span style={{ color: "var(--gold)" }}>{guessReveal.guessTarget}</span>
          </h3>
          <p className="font-sans text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
            {sortedPlayers.find((p) => p.seat === guessReveal.firstSeat)?.name ?? "The closest player"} goes first.
          </p>
          <div className="space-y-1">
            {sortedPlayers.map((p) => {
              const guess = guessReveal.guesses[p.seat];
              const diff = guess === null || guess === undefined
                ? null
                : Math.abs(guess - guessReveal.guessTarget);
              return (
                <p key={p.seat} className="font-sans text-sm" style={{ color: "var(--ink-soft)" }}>
                  {p.name}: {guess ?? "?"}
                  {diff !== null ? ` (off by ${diff})` : ""}
                  {p.seat === guessReveal.firstSeat ? (
                    <span style={{ color: "var(--forest)", fontWeight: 700 }}> - first</span>
                  ) : null}
                </p>
              );
            })}
          </div>
        </div>
      ) : status === "guessing" && (
        <div className="td-status-card w-full max-w-lg">
          <h3>Guess a number 1–10</h3>
          <p className="font-sans text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
            Closest to the secret number goes first!
          </p>
          {mySeat >= 0 && effectiveMyGuess === null ? (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  onClick={() => handleGuessNumber(n)}
                  className="bid-chip guess-chip font-serif font-bold"
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <p className="font-serif font-semibold mb-4" style={{ color: "var(--gold)", fontSize: 16 }}>
              {mySeat >= 0 ? `You guessed ${effectiveMyGuess}` : "Spectating"}
            </p>
          )}
          <div className="space-y-1">
            {sortedPlayers.map((p) => (
              <p key={p.seat} className="font-sans text-sm" style={{ color: "var(--ink-soft)" }}>
                {p.name}: {guesses[p.seat] !== undefined && guesses[p.seat] !== null
                  ? <span style={{ color: "var(--forest)" }}>guessed</span>
                  : "waiting…"}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Score board + Board layout */}
      <div className="game-layout">
        {/* Ledger */}
        <div className="game-layout-ledger">
          <ScoreBoard
            players={displayPlayers}
            currentTurn={currentTurn}
            yourSeat={mySeat}
            bagCount={bagCount}
            status={status}
            winner={winner}
          />
        </div>

        {/* Board + Rack share a DndContext */}
        <div className="game-layout-play flex w-full min-w-0 justify-center">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToWindowEdges]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="game-play-stack">
              <div className="board-slot">
              <Board
                board={board}
                stagedPlacements={stagedPlacements}
                playerRack={myRack}
                isMyTurn={isMyTurn}
                isTouchDevice={isTouchDevice}
                highlightCenter={isMyTurn && board.size === 0}
                selectedTile={myRack.find((t) => t.id === selectedTileId) ?? null}
                onStageTile={handleStageTile}
                onUnstage={(tileId) =>
                  setStagedPlacements((prev) => prev.filter((p) => p.tile.id !== tileId))
                }
                onFlipTile={handleFlipTile}
                onClearSelectedTile={() => setSelectedTileId(null)}
                popups={popups}
                invalidStagedPositions={invalidStagedPositions}
              />
              </div>

              {/* Rack */}
              {mySeat >= 0 && (status === "active" || status === "finished") && (
                <TileRack
                  tiles={myRack}
                  stagedIds={stagedIds}
                  selectedId={selectedTileId}
                  isMyTurn={isMyTurn}
                  onFlipTile={handleFlipTile}
                  onSelectTile={(id) => setSelectedTileId((prev) => prev === id ? null : id)}
                />
              )}
            </div>

            <DragOverlay>
              {activeTile && <TileDisplay tile={activeTile} size="md" />}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Controls panel + Chat */}
        {mySeat >= 0 && status === "active" && (
          <div className="game-layout-controls">
            <GameControls
              stagedPlacements={stagedPlacements}
              board={board}
              isMyTurn={isMyTurn}
              isFirstMove={board.size === 0}
              isTouch={isTouchDevice}
              myRack={myRack}
              onConfirm={handleConfirm}
              onReset={handleReset}
              onPass={handlePass}
              onExchange={(ids) => send({ type: "exchange_tiles", tileIds: ids })}
            />

            {gameError && (
              <p className="td-error">{gameError}</p>
            )}

            <div className="relative">
              <Chat
                messages={chatMessages}
                yourSeat={mySeat}
                onSend={(text) => send({ type: "chat", text })}
                isOpen={chatOpen}
                onToggle={() => setChatOpen((v) => !v)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
