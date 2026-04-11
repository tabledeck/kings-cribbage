export const CHAT_PRESETS = [
  { id: 0, text: "Good move!" },
  { id: 1, text: "Nice score!" },
  { id: 2, text: "Wow!" },
  { id: 3, text: "Oops..." },
  { id: 4, text: "Good game!" },
  { id: 5, text: "Your turn" },
  { id: 6, text: "Thinking..." },
  { id: 7, text: "Well played" },
  { id: 8, text: "Rematch?" },
  { id: 9, text: "Lucky!" },
  { id: 10, text: "👍" },
  { id: 11, text: "👎" },
  { id: 12, text: "😂" },
  { id: 13, text: "😱" },
  { id: 14, text: "🔥" },
  { id: 15, text: "💀" },
  { id: 16, text: "🎉" },
  { id: 17, text: "🤔" },
] as const;

export type ChatPresetId = (typeof CHAT_PRESETS)[number]["id"];

export function getChatPreset(id: number): string {
  return CHAT_PRESETS.find((p) => p.id === id)?.text ?? "?";
}
