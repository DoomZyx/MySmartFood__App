// Routes/Ws/notifications.js
import notificationService from "../../Services/notificationService.js";
import { callLogger } from "../../Services/logging/logger.js";
import { notifDebugLog } from "../../Services/logging/notifDebugLog.js";
import { requireAuth } from "../../middleware/sessionAuth.js";
import { buildCorsOrigin } from "../../plugins/security.js";

export async function requireAllowedNotificationOrigin(request, reply) {
  const origin = request.headers.origin;
  if (!origin) {
    return reply.code(403).send({ error: "Origine WebSocket manquante" });
  }

  const originValidator = buildCorsOrigin();
  if (originValidator === true) return;

  const isAllowed = await new Promise((resolve, reject) => {
    originValidator(origin, (error, allowedOrigin) => {
      if (error) reject(error);
      else resolve(Boolean(allowedOrigin));
    });
  });

  if (!isAllowed) {
    return reply.code(403).send({ error: "Origine WebSocket refusée" });
  }
}

export function notificationWebSocketOptions() {
  return {
    websocket: true,
    preValidation: [requireAllowedNotificationOrigin, requireAuth],
  };
}

function requireApiKey(request, reply, done) {
  notifDebugLog("requireApiKey: requete recue x-api-key=" + (request.headers["x-api-key"] ? "present" : "absent"));
  const apiKey = String(request.headers["x-api-key"] ?? "").trim();
  if (!apiKey || apiKey !== process.env.X_API_KEY) {
    notifDebugLog("requireApiKey: rejet 401");
    return reply.code(401).send({ error: "Clé API manquante ou invalide" });
  }
  done();
}

function attachNotificationWebSocket(connection, req, routeLabel) {
  const socket = connection?.socket ?? connection;

  const readyState = socket?.readyState;
  const hasSend = typeof socket?.send === "function";
  notifDebugLog(
    "WS connexion entrante " +
      routeLabel +
      " readyState=" +
      readyState +
      " hasSend=" +
      hasSend +
      " totalAvant=" +
      notificationService.connections.size
  );
  callLogger.info(null, "WebSocket " + routeLabel + ": connexion entrante", {
    readyState,
    hasSend,
    totalConnectionsAvant: notificationService.connections.size,
  });
  notificationService.addConnection(connection);

  connection.on("error", (err) => {
    callLogger.error(null, err, { context: "ws_notifications_error" });
    notificationService.removeConnection(connection);
  });

  connection.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "ping") {
        connection.send(
          JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      callLogger.error(null, "Erreur parsing message notification", {
        error: error.message,
      });
    }
  });

  connection.on("close", () => {
    notificationService.removeConnection(connection);
  });

  connection.send(
    JSON.stringify({
      type: "connected",
      message: "Connexion notification établie",
      timestamp: new Date().toISOString(),
    })
  );

  callLogger.info(null, "Connexion notification WebSocket établie", {
    clientIp: req.socket?.remoteAddress,
    userAgent: req.headers?.["user-agent"],
  });
}

export default async function notificationRoutes(fastify, options) {
  // Deux chemins : /api/ws/... pour reverse proxy qui ne forward que /api/* ; /ws/... rétrocompat.
  const wsOpts = notificationWebSocketOptions();
  fastify.get("/ws/notifications", wsOpts, (connection, req) =>
    attachNotificationWebSocket(connection, req, "/ws/notifications")
  );
  fastify.get("/api/ws/notifications", wsOpts, (connection, req) =>
    attachNotificationWebSocket(connection, req, "/api/ws/notifications")
  );

  fastify.post("/api/notifications/test", { preHandler: requireApiKey }, async (request, reply) => {
    notifDebugLog("POST /api/notifications/test recu type=" + (request.body?.type || "call_completed"));
    try {
      const { type = "call_completed", data = {} } = request.body;

      let sentCount = 0;
      switch (type) {
        case "call_completed":
          sentCount = notificationService.notifyCallCompleted(data);
          break;
        case "call_error":
          sentCount = notificationService.notifyCallError(
            new Error(data.error || "Erreur de test"),
            data
          );
          break;
        case "new_client":
          sentCount = notificationService.notifyNewClient(data);
          break;
        case "status_update":
          sentCount = notificationService.notifyStatusUpdate(data);
          break;
        default:
          sentCount = notificationService.sendNotification(type, data);
      }

      return reply.send({
        success: true,
        message: "Notification de test envoyée",
        sentCount,
        type,
      });
    } catch (error) {
      callLogger.error(null, "Erreur envoi notification test", {
        error: error.message,
      });

      return reply.code(500).send({
        success: false,
        error: "Erreur lors de l'envoi de la notification",
        details: error.message,
      });
    }
  });

  fastify.get("/api/notifications/status", { preHandler: requireApiKey }, async (request, reply) => {
    return reply.send({
      success: true,
      connections: notificationService.connections.size,
      message: `Connexions actives: ${notificationService.connections.size}`,
    });
  });
}
