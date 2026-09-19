// @ts-nocheck
import { jest } from "@jest/globals";

const webSocketMock = jest.fn(() => ({
  on: jest.fn(),
  send: jest.fn(),
}));

jest.unstable_mockModule("ws", () => ({
  default: webSocketMock,
}));

const { createOpenAiSession, getSessionUpdatePayload } = await import("./gptServices.js");

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

  test("derive les plages outils depuis horairesOuverture", () => {
    const payload = getSessionUpdatePayload("ballad", "instructions", {
      samedi: {
        ouvert: true,
        midi: { ouverture: "12:00", fermeture: "15:00" },
        soir: { ouverture: "18:00", fermeture: "22:30" },
      },
      dimanche: { ouvert: false },
    });
    const toolsText = JSON.stringify(payload.tools);

    expect(toolsText).toContain("12:00-15:00");
    expect(toolsText).toContain("18:00-22:30");
    expect(toolsText).toContain("Dimanche: ferme");
    expect(toolsText).not.toContain("11h-15h");
    expect(toolsText).not.toContain("18h-00h");
    expect(toolsText).not.toContain("14h59");
    expect(toolsText).not.toContain("23h59");
  });

  test("le prompt STT transcrit l heure dite sans inferer le soir", () => {
    const payload = getSessionUpdatePayload("ballad", "instructions");
    const sttPrompt = payload.audio.input.transcription.prompt;

    expect(sttPrompt).toContain("huit heures");
    expect(sttPrompt).toContain("8h");
    expect(sttPrompt).toContain("vingt heures");
    expect(sttPrompt).toContain("20h");
    expect(sttPrompt).not.toMatch(/8h[' ]*\(matin\)\s+ou\s+'20h'/);
    expect(sttPrompt).not.toContain("20h (soir)");
    expect(sttPrompt.length).toBeLessThanOrEqual(1024);
  });

  test("attend 400 ms de silence avant de couper le tour", () => {
    const payload = getSessionUpdatePayload("ballad", "instructions");
    expect(payload.audio.input.turn_detection.silence_duration_ms).toBe(400);
  });
});

