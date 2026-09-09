// @ts-nocheck
import { createOpenAiSession } from "./gptServices.js";
import WebSocket from "ws";

//Vérifies que la fonction createOpenAiSession() crée bien une connexion WebSocket avec OpenAI et envoie les bons headers.

jest.mock("ws");

describe("gptService", () => {
  beforeEach(() => {
    WebSocket.mockClear();
  });

  it("devrait créer une connexion WebSocket avec les bons headers", () => {
    createOpenAiSession({
      openAi: {
        apiKey: "fake-api-key",
        model: "gpt-realtime-1.5",
        sessionUpdatePayload: {
          type: "session.update",
          session: { type: "realtime" },
        },
      },
    });

    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringContaining("wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake-api-key",
        }),
      })
    );
    const [, options] = WebSocket.mock.calls[0];
    expect(options.headers["OpenAI-Beta"]).toBeUndefined();
  });
});
