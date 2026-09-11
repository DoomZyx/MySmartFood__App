// @ts-nocheck
import { jest } from "@jest/globals";
import { requireAuth } from "../../middleware/sessionAuth.js";
import {
  notificationWebSocketOptions,
  requireAllowedNotificationOrigin,
} from "./notifications.js";

function createReply() {
  const reply = {
    code: jest.fn(() => reply),
    send: jest.fn(() => reply),
  };
  return reply;
}

describe("Sécurité du WebSocket de notifications", () => {
  const initialNodeEnv = process.env.NODE_ENV;
  const initialCorsOrigins = process.env.CORS_ORIGINS;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGINS;
  });

  afterAll(() => {
    if (initialNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = initialNodeEnv;

    if (initialCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = initialCorsOrigins;
  });

  it("applique le contrôle d'origine puis l'authentification", () => {
    const options = notificationWebSocketOptions();

    expect(options.websocket).toBe(true);
    expect(options.preValidation).toEqual([
      requireAllowedNotificationOrigin,
      requireAuth,
    ]);
  });

  it("refuse une connexion sans origine", async () => {
    const reply = createReply();

    await requireAllowedNotificationOrigin({ headers: {} }, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Origine WebSocket manquante",
    });
  });

  it("refuse une origine non autorisée", async () => {
    const reply = createReply();

    await requireAllowedNotificationOrigin(
      { headers: { origin: "https://attacker.example" } },
      reply
    );

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Origine WebSocket refusée",
    });
  });

  it("accepte une origine configurée", async () => {
    process.env.CORS_ORIGINS = "https://dashboard.example.com";
    const reply = createReply();

    await requireAllowedNotificationOrigin(
      { headers: { origin: "https://dashboard.example.com" } },
      reply
    );

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
