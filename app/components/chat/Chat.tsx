import { useState } from "react";

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

const SEAT_COLORS = ["text-emerald-400", "text-blue-400", "text-orange-400", "text-purple-400"];

export function Chat({ messages, yourSeat, onSend, isOpen, onToggle }: ChatProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

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
                  <span className="text-gray-300">{m.text}</span>
                </div>
              ))
            )}
          </div>

          {yourSeat >= 0 && (
            <div className="flex gap-1 p-2 border-t border-gray-800">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs rounded-lg px-2 py-1.5 transition-colors"
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
