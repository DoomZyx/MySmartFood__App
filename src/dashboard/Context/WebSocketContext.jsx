import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { isAuthenticated } from "../API/auth";
import notificationService from "../Services/notificationService.js";

const isDev = import.meta.env.DEV;
const WebSocketContext = createContext(null);

const PING_INTERVAL_MS = 25000;

/**
 * Construit l'URL WebSocket : utilise VITE_WS_URL ou déduit ws/wss depuis VITE_API_URL.
 */
function getWebSocketUrl() {
  const explicit = import.meta.env.VITE_WS_URL;
  let url;
  if (explicit && typeof explicit === "string" && explicit.trim()) {
    url = explicit.trim();
  } else {
    const apiUrl = import.meta.env.VITE_API_URL;
    const base = apiUrl.replace(/\/$/, "");
    // Sous /api pour les reverse proxy qui ne forward que ce préfixe vers Node (ex. api.mysmartfood.fr).
    if (base.startsWith("https://")) {
      url = base.replace(/^https:\/\//, "wss://") + "/api/ws/notifications";
    } else {
      url = base.replace(/^http:\/\//, "ws://") + "/api/ws/notifications";
    }
  }
  return url;
}

/** URL affichable en log (sans clé API en query). */
function websocketUrlForLog(url) {
  if (!url || typeof url !== "string") return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("api_key")) u.searchParams.set("api_key", "[REDACTED]");
    return u.toString();
  } catch {
    const i = url.indexOf("api_key=");
    if (i === -1) return url;
    return `${url.slice(0, i)}api_key=[REDACTED]`;
  }
}

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastOrderNotificationAt, setLastOrderNotificationAt] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);
  const pingIntervalRef = useRef(null);
  const callbacksRef = useRef({
    onNewCall: [],
    onNewOrder: [],
  });

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated()) {
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setLastError(null);

    try {
      isConnectingRef.current = true;
      const wsUrl = getWebSocketUrl();
      if (isDev) console.log("[WS] Connexion:", websocketUrlForLog(wsUrl));
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDev) console.log("[WS] Connecte");
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        notificationService.connectToWebSocket(ws);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
        queueMicrotask(() => {
          setLastError(null);
          setIsConnected(true);
        });
      };

      ws.onmessage = (event) => {
        let data;
        try {
          const raw = typeof event.data === "string" ? event.data : event.data?.toString?.();
          if (!raw) return;
          data = JSON.parse(raw);
        } catch (error) {
          setLastError(error.message || "Erreur traitement message");
          if (isDev) console.warn("[WS] onmessage parse error:", error);
          return;
        }

        if (isDev) console.log("[WS] Message recu type=" + (data.type || "?") + (data.notificationType ? " notificationType=" + data.notificationType : ""));

        if (data.type === "connected") {
          if (isDev) console.log("[WS] Message serveur: connected");
          return;
        }

        if (data.type !== "notification") {
          if (isDev && data.type !== "pong") console.log("[WS] Message ignore (type != notification):", data.type);
          return;
        }

        const notificationType = data.notificationType ?? data.data?.notificationType ?? "call_completed";
        const inner = data.data && typeof data.data === "object" ? data.data : data;
        const notificationData = {
          title: inner.title ?? inner.details?.callTypeLabel ?? "Appel IA",
          message: inner.message ?? inner.details?.type_demande ?? "Nouvelle notification",
          hasOrder: inner.hasOrder === true,
          priority: inner.priority ?? "info",
          details: inner.details && typeof inner.details === "object" ? inner.details : {},
          notificationType,
        };

        const d = notificationData.details;
        const hasLinkId =
          (d?.orderId != null && String(d.orderId).trim() !== "") ||
          (d?.reservationId != null && String(d.reservationId).trim() !== "");
        const hasOrderOrResa = notificationData.hasOrder === true || hasLinkId;
        const callbacks = callbacksRef.current;

        queueMicrotask(() => {
          if (isDev) console.log("[WS] Traitement notification:", notificationType, notificationData.title);
          notificationService.triggerSystemNotification(notificationData).catch((err) => {
            setLastError(err?.message || "Erreur notification");
            if (isDev) console.warn("[WS] triggerSystemNotification error:", err);
          }).then(() => {
            if (notificationType === "call_completed" && hasOrderOrResa) setLastOrderNotificationAt(Date.now());
            else if (notificationType === "new_order" || notificationType === "new_reservation") setLastOrderNotificationAt(Date.now());

            switch (notificationType) {
              case "call_completed":
                callbacks.onNewCall.forEach(cb => cb(notificationData));
                if (hasOrderOrResa) callbacks.onNewOrder.forEach(cb => cb(notificationData));
                break;
              case "new_order":
              case "new_reservation":
                callbacks.onNewOrder.forEach(cb => cb(notificationData));
                break;
              default:
                break;
            }
          });
        });
      };

      ws.onerror = () => {
        if (isDev) console.warn("[WS] Erreur connexion");
        setIsConnected(false);
        isConnectingRef.current = false;
        setLastError("Erreur de connexion WebSocket");
      };

      ws.onclose = (event) => {
        if (isDev) console.log("[WS] Ferme code=" + event.code + " wasClean=" + event.wasClean);
        setIsConnected(false);
        isConnectingRef.current = false;
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (event.code !== 1000 && !event.wasClean) {
          setLastError(`Connexion fermée (code ${event.code})`);
        }

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };
    } catch (error) {
      setIsConnected(false);
      isConnectingRef.current = false;
      setLastError(error.message || "Impossible de se connecter");
      if (isDev) console.warn("[WS] connect error:", error);
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setLastError(null);
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const subscribe = useCallback((type, callback) => {
    if (type === "call" && !callbacksRef.current.onNewCall.includes(callback)) {
      callbacksRef.current.onNewCall.push(callback);
    } else if (type === "order" && !callbacksRef.current.onNewOrder.includes(callback)) {
      callbacksRef.current.onNewOrder.push(callback);
    }
    return () => {
      if (type === "call") {
        callbacksRef.current.onNewCall = callbacksRef.current.onNewCall.filter(cb => cb !== callback);
      } else if (type === "order") {
        callbacksRef.current.onNewOrder = callbacksRef.current.onNewOrder.filter(cb => cb !== callback);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastError, subscribe, reconnect, lastOrderNotificationAt }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket doit être utilisé dans un WebSocketProvider");
  }
  return context;
}
