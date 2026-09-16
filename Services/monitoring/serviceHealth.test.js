import {
  estimateNetworkRttMs,
  getExternalHealthSnapshot,
  probeFallbackApi,
  probeHealthService,
} from "./serviceHealth.js";

describe("serviceHealth", () => {
  const originalGatewayHealthUrl = process.env.GATEWAY_HEALTH_URL;

  afterEach(() => {
    if (originalGatewayHealthUrl === undefined) {
      delete process.env.GATEWAY_HEALTH_URL;
    } else {
      process.env.GATEWAY_HEALTH_URL = originalGatewayHealthUrl;
    }
  });

  it("retourne les moteurs et le compteur d'appels d'un service sain", async () => {
    const result = await probeHealthService("http://voice.test/health", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: "healthy",
          engines: { ready: true, stt: "ready", tts: "ready" },
          sessions_active: 3,
          components: {
            llm: { ready: true, provider: "vllm" },
          },
          llm_provider_active: "vllm",
          telemetry: {
            latency_ms: {
              stt: { count: 2, last: 120, average: 110, min: 100, max: 120 },
              llm: { count: 2, last: 400, average: 380, min: 360, max: 400 },
            },
          },
          active_sessions: [
            {
              streamSid: "MZ_test",
              callSid: "CA_test",
              stage: "llm",
              duration_seconds: 12,
              callerNumber: "+33600000000",
            },
          ],
        }),
      }),
    });

    expect(result.service).toMatchObject({
      configured: true,
      status: "healthy",
      reachable: true,
      httpStatus: 200,
      activeCalls: 3,
    });
    expect(result.engines).toEqual({
      ready: true,
      stt: "ready",
      tts: "ready",
    });
    expect(result.components.llm.provider).toBe("vllm");
    expect(result.llmProviderActive).toBe("vllm");
    expect(result.activeSessions[0]).toMatchObject({
      streamSid: "MZ_test",
      callSid: "CA_test",
      stage: "llm",
      elapsedSeconds: 12,
    });
    expect(result.activeSessions[0]).not.toHaveProperty("callerNumber");
    expect(result.telemetry.latency_ms.stt).toEqual({
      count: 2,
      last: 120,
      average: 110,
      min: 100,
      max: 120,
    });
  });

  it("isole une indisponibilité sans lever d'erreur", async () => {
    const result = await probeHealthService("http://voice.test/health", {
      fetchImpl: async () => {
        throw new Error("connection refused");
      },
    });

    expect(result).toMatchObject({
      service: {
        configured: true,
        status: "unhealthy",
        reachable: false,
        error: "unreachable",
      },
      engines: null,
    });
  });

  it("interrompt une sonde qui dépasse le délai", async () => {
    const result = await probeHealthService("http://voice.test/health", {
      timeoutMs: 5,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });

    expect(result.service).toMatchObject({
      status: "unhealthy",
      reachable: false,
      error: "timeout",
    });
  });

  it("laisse le gateway désactivé si l'URL n'est pas forcée et que la sonde locale échoue", async () => {
    delete process.env.GATEWAY_HEALTH_URL;

    const snapshot = await getExternalHealthSnapshot({
      fetchImpl: async () => {
        throw new Error("connection refused");
      },
    });

    expect(snapshot.gateway.service).toEqual({
      configured: false,
      status: "disabled",
      reachable: false,
    });
  });

  it("détecte le gateway local quand la sonde par défaut répond", async () => {
    delete process.env.GATEWAY_HEALTH_URL;

    const snapshot = await getExternalHealthSnapshot({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "healthy", activeCalls: 2 }),
      }),
    });

    expect(snapshot.gateway.service).toMatchObject({
      configured: true,
      status: "healthy",
      reachable: true,
      activeCalls: 2,
    });
  });

  it("convertit un TTFB HTTPS en RTT reseau", () => {
    expect(estimateNetworkRttMs(600)).toBe(200);
    expect(estimateNetworkRttMs(0)).toBe(0);
    expect(estimateNetworkRttMs(-1)).toBeNull();
  });

  it("mesure la latence de l'API de fallback", async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    try {
      const result = await probeFallbackApi({
        fetchImpl: async () => ({ ok: true, status: 200 }),
      });
      expect(result).toMatchObject({
        configured: true,
        reachable: true,
      });
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });
});
