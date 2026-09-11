import { decideVoiceRoute, getVoiceTargets } from "./voiceRoute.js";

describe("decideVoiceRoute", () => {
  const originalVoiceServiceUrls = process.env.VOICE_SERVICE_URLS;

  afterEach(() => {
    if (originalVoiceServiceUrls === undefined) {
      delete process.env.VOICE_SERVICE_URLS;
    } else {
      process.env.VOICE_SERVICE_URLS = originalVoiceServiceUrls;
    }
  });

  it("bascule GPT si le Voice Service est injoignable", () => {
    const route = decideVoiceRoute(false, null);
    expect(route.mode).toBe("gpt");
    expect(route.reason).toContain("injoignable");
  });

  it("bascule GPT si les moteurs ne sont pas prets", () => {
    const route = decideVoiceRoute(true, {
      engines: { ready: false, error: "Kokoro en cours" },
    });
    expect(route.mode).toBe("gpt");
    expect(route.reason).toBe("Kokoro en cours");
  });

  it("utilise le Voice Service local si engines.ready", () => {
    const route = decideVoiceRoute(true, { engines: { ready: true } });
    expect(route.mode).toBe("local");
  });

  it("construit les sondes HTTP et WebSocket du pool vocal", () => {
    process.env.VOICE_SERVICE_URLS =
      "http://voice-1:8090,https://voice-2.example.com";

    expect(getVoiceTargets()).toEqual([
      {
        healthUrl: "http://voice-1:8090/health",
        monitoringUrl: "http://voice-1:8090/monitoring",
        wsUrl: "ws://voice-1:8090/media-stream",
      },
      {
        healthUrl: "https://voice-2.example.com/health",
        monitoringUrl: "https://voice-2.example.com/monitoring",
        wsUrl: "wss://voice-2.example.com/media-stream",
      },
    ]);
  });
});
