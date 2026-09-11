import {
  getExternalHealthSnapshot,
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

  it("laisse le gateway désactivé quand son URL est absente", async () => {
    delete process.env.GATEWAY_HEALTH_URL;

    const snapshot = await getExternalHealthSnapshot({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "healthy", engines: { ready: true } }),
      }),
    });

    expect(snapshot.gateway.service).toEqual({
      configured: false,
      status: "disabled",
      reachable: false,
    });
  });
});
