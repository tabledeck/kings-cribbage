import { useState } from "react";
import type { Placement } from "~/domain/scoring";
import { scoreMove } from "~/domain/scoring";
import type { BoardState } from "~/domain/board";
import { TileDisplay } from "~/components/board/Tile";
import type { Tile } from "~/domain/tiles";
import { CheckmarkIcon } from "~/components/icons/CheckmarkIcon";
import { BtnPrimary } from "~/components/tabledeck/BtnPrimary";
import { BtnSecondary } from "~/components/tabledeck/BtnSecondary";

interface GameControlsProps {
  stagedPlacements: Placement[];
  board: BoardState;
  isMyTurn: boolean;
  isFirstMove: boolean;
  myRack: Tile[];
  onConfirm: () => void;
  onReset: () => void;
  onPass: () => void;
  onExchange: (tileIds: number[]) => void;
}

interface ScoreBreakdown {
  fifteens: number;
  pairs: number;
  runs: number;
  flush: number;
  nobs: number;
  total: number;
}

function getScoreBreakdown(
  board: BoardState,
  stagedPlacements: Placement[],
  isFirstMove: boolean,
): ScoreBreakdown | null {
  if (stagedPlacements.length === 0) return null;
  try {
    const scored = scoreMove(board, stagedPlacements, isFirstMove, stagedPlacements.length);
    return {
      fifteens: 0,
      pairs: 0,
      runs: 0,
      flush: 0,
      nobs: 0,
      total: scored.total,
    };
  } catch {
    return null;
  }
}

export function GameControls({
  stagedPlacements,
  board,
  isMyTurn,
  isFirstMove,
  myRack,
  onConfirm,
  onReset,
  onPass,
  onExchange,
}: GameControlsProps) {
  const [exchangeMode, setExchangeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const hasStaged = stagedPlacements.length > 0;

  let previewScore = 0;
  if (hasStaged) {
    try {
      const scored = scoreMove(board, stagedPlacements, isFirstMove, stagedPlacements.length);
      previewScore = scored.total;
    } catch {
      // Invalid placement
    }
  }

  function toggleTile(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmExchange() {
    onExchange([...selectedIds]);
    setExchangeMode(false);
    setSelectedIds(new Set());
  }

  function cancelExchange() {
    setExchangeMode(false);
    setSelectedIds(new Set());
  }

  if (!isMyTurn) {
    return (
      <div className="td-panel">
        <p
          className="text-center font-serif"
          style={{ color: "var(--ink-faint)", fontStyle: "italic", fontSize: 14 }}
        >
          Awaiting your turn…
        </p>
      </div>
    );
  }

  if (exchangeMode) {
    return (
      <div className="td-panel">
        <h3>Exchange Tiles</h3>
        <p className="font-sans mb-3" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          Select tiles to exchange ({selectedIds.size} selected):
        </p>
        <div className="flex gap-2 flex-wrap mb-4">
          {myRack.map((tile) => (
            <button
              key={tile.id}
              onClick={() => toggleTile(tile.id)}
              className={`rounded transition-transform ${
                selectedIds.has(tile.id)
                  ? "ring-2 scale-110"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={selectedIds.has(tile.id) ? { outlineColor: "var(--gold)", boxShadow: `0 0 0 2px var(--gold)` } : {}}
            >
              <TileDisplay tile={tile} size="md" />
            </button>
          ))}
        </div>
        <BtnPrimary
          onClick={confirmExchange}
          disabled={selectedIds.size === 0}
        >
          <CheckmarkIcon />
          Exchange ({selectedIds.size})
        </BtnPrimary>
        <BtnSecondary onClick={cancelExchange}>
          Cancel
        </BtnSecondary>
      </div>
    );
  }

  return (
    <div className="td-panel">
      <h3>This Play</h3>

      {hasStaged ? (
        <>
          <dl className="score-preview">
            <dt>Tiles placed</dt>
            <dd>+{stagedPlacements.length}</dd>
            <dt className="total">Score</dt>
            <dd className="total">{previewScore > 0 ? `+${previewScore}` : "—"}</dd>
          </dl>

          <div style={{ height: 10 }} />

          <BtnPrimary onClick={onConfirm}>
            <CheckmarkIcon />
            {previewScore > 0 ? `Confirm · +${previewScore}` : "Confirm"}
          </BtnPrimary>
          <BtnSecondary onClick={onReset}>
            Reset placement
          </BtnSecondary>
        </>
      ) : (
        <>
          <p className="font-sans mb-3" style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>
            Drag a tile to the board
          </p>
          <BtnSecondary onClick={() => setExchangeMode(true)}>
            Exchange tiles
          </BtnSecondary>
          <BtnSecondary ghost onClick={onPass}>
            Pass turn
          </BtnSecondary>
        </>
      )}
    </div>
  );
}
