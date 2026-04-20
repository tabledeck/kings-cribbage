import { useState } from "react";
import { ChatIcon } from "~/components/icons/ChatIcon";
import { Seal } from "~/components/tabledeck/Seal";

interface ChatMessage {
  seat: number;
  text: string;
  playerName: string;
  timestamp: number;
}

interface ChatProps {
  messages: ChatMessage[];
  yourSeat: number;
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SEAT_SERIF_COLORS = [
  "#c9a24a", // gold
  "#c6c3bc", // silver
  "#a3441e", // copper/bronze
  "#8b6a3e", // walnut-gold
];

export function Chat({ messages, yourSeat, onSend, isOpen, onToggle }: ChatProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  const unreadCount = isOpen ? 0 : messages.length;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="td-chat-trigger"
        aria-label="Toggle chat"
      >
        <ChatIcon />
        Chat
        {unreadCount > 0 && <Seal count={unreadCount} />}
      </button>

      {isOpen && (
        <div className="td-chat-popup">
          <div className="td-chat-popup-inner">
            <div
              className="td-chat-messages"
              style={{ fontFamily: "var(--sans)", fontSize: 13 }}
            >
              {messages.length === 0 ? (
                <p
                  className="text-center pt-4"
                  style={{ fontFamily: "var(--script)", fontSize: 15, color: "var(--ink-faint)" }}
                >
                  No messages yet
                </p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="mb-1">
                    <span
                      className="font-semibold"
                      style={{ color: SEAT_SERIF_COLORS[m.seat] ?? SEAT_SERIF_COLORS[0], fontFamily: "var(--serif)" }}
                    >
                      {m.playerName}:
                    </span>{" "}
                    <span style={{ color: "var(--ink-soft)" }}>{m.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {yourSeat >= 0 && (
            <div className="td-chat-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="Type a message…"
                maxLength={200}
                className="td-chat-input"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="td-chat-send"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
