import { useEffect, useRef, useCallback } from "react";
import { useRevalidator } from "react-router";
import type { ServerMessage } from "~/domain/messages";

export function useGameWebSocket({
  gameId,
  seat,
  name,
  onMessage,
}: {
  gameId: string;
  seat: number;
  name: string;
  onMessage: (msg: ServerMessage) => void;
}) {
  const revalidator = useRevalidator();
  const reconnectDelay = useRef(1000);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({
        seat: String(seat),
        name,
      });
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/game/${gameId}/ws?${params}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerMessage;
          onMessageRef.current(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        revalidator.revalidate();
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 30000);
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      wsRef.current?.close();
    };
  }, [gameId, seat, name]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
