import { useWebSocket } from "../../Context/WebSocketContext";
import { useEffect, useRef } from "react";

/**
 * @deprecated Utiliser WebSocketContext (useWebSocket) comme unique source de connexion.
 * Ce hook ne crée plus de connexion WebSocket : il réutilise le contexte et enregistre
 * les callbacks via subscribe("call" | "order", callback). Ne pas utiliser en parallèle
 * d'autres connexions manuelles au même endpoint.
 *
 * @param {Function} onNewCall - Callback appelé quand un nouvel appel arrive
 * @param {Function} onNewOrder - Callback appelé quand une nouvelle commande arrive
 */
export function useWebSocketNotifications(onNewCall, onNewOrder) {
  const { isConnected, subscribe, reconnect } = useWebSocket();
  const unsubRef = useRef(null);

  useEffect(() => {
    const unsubs = [];
    if (typeof onNewCall === "function") {
      unsubs.push(subscribe("call", onNewCall));
    }
    if (typeof onNewOrder === "function") {
      unsubs.push(subscribe("order", onNewOrder));
    }
    unsubRef.current = () => {
      unsubs.forEach((u) => u());
    };
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [onNewCall, onNewOrder, subscribe]);

  return {
    isConnected,
    reconnect,
  };
}
