// @ts-nocheck
import { jest } from "@jest/globals";

const webSocketMock = jest.fn(() => ({
  on: jest.fn(),
  send: jest.fn(),
}));

jest.unstable_mockModule("ws", () => ({
  default: webSocketMock,
}));

const { createOpenAiSession } = await import("./gptServices.js");

describe("gptService", () => {
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

    expect(webSocketMock).toHaveBeenCalledWith(
      expect.stringContaining("wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake-api-key",
        }),
      })
    );
    const [, options] = webSocketMock.mock.calls[0];
    expect(options.headers["OpenAI-Beta"]).toBeUndefined();
  });
});
