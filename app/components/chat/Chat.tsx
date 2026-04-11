import { useState } from "react";
import { CHAT_PRESETS, getChatPreset } from "~/domain/chat";

interface ChatMessage {
  seat: number;
  presetId: number;
  playerName: string;
  timestamp: number;
}

interface ChatProps {
  messages: ChatMessage[];
  yourSeat: number;
  onSend: (presetId: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SEAT_COLORS = ["text-emerald-400", "text-blue-400", "text-orange-400", "text-purple-400"];

export function Chat({ messages, yourSeat, onSend, isOpen, onToggle }: ChatProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm transition-colors border border-gray-700"
      >
        💬 Chat {messages.length > 0 && !isOpen && (
          <span className="ml-1 bg-emerald-600 text-white text-xs rounded-full px-1">
            {messages.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 w-72 bg-gray-900 rounded-xl border border-gray-700 shadow-xl z-10">
          {/* Message history */}
          <div className="h-36 overflow-y-auto p-3 space-y-1">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center pt-4">
                No messages yet
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={`font-medium ${SEAT_COLORS[m.seat]}`}>
                    {m.playerName}:
                  </span>{" "}
                  <span className="text-gray-300">{getChatPreset(m.presetId)}</span>
                </div>
              ))
            )}
          </div>

          {/* Quick send buttons */}
          <div className="p-2 border-t border-gray-800">
            <p className="text-gray-600 text-xs mb-2">Quick messages:</p>
            <div className="grid grid-cols-3 gap-1">
              {CHAT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onSend(preset.id)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 transition-colors text-left truncate"
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
