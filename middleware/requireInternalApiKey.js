import { timingSafeEqual } from "node:crypto";

function keysMatch(providedKey, configuredKey) {
  const provided = Buffer.from(providedKey);
  const configured = Buffer.from(configuredKey);
  return (
    provided.length === configured.length &&
    timingSafeEqual(provided, configured)
  );
}

/**
 * Protège les échanges internes entre le Voice Service et Fastify.
 */
export function requireInternalApiKey(request, reply, done) {
  const configuredKey = String(process.env.X_API_KEY || "").trim();
  if (!configuredKey) {
    return reply.code(503).send({ error: "Service interne non configuré" });
  }

  const providedKey = String(request.headers["x-api-key"] || "").trim();
  if (!providedKey || !keysMatch(providedKey, configuredKey)) {
    return reply.code(401).send({ error: "Clé API interne invalide" });
  }

  done();
}
