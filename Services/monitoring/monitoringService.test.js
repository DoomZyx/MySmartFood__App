import { deriveOverallStatus, toRestaurantSnapshot } from "./monitoringService.js";

const baseInput = {
  database: { status: "ok" },
  http: { errorRate: 0 },
  extraction: { consecutiveFailures: 0 },
  circuit: { state: "CLOSED" },
  services: {
    backend: { configured: true, status: "healthy" },
    postgres: { configured: true, status: "healthy" },
    voiceServer: { configured: true, status: "healthy" },
    gateway: { configured: false, status: "disabled" },
  },
};

describe("deriveOverallStatus", () => {
  it("retourne healthy quand toutes les dépendances configurées répondent", () => {
    expect(deriveOverallStatus(baseInput)).toBe("healthy");
  });

  it("retourne degraded si un service vocal configuré tombe", () => {
    expect(
      deriveOverallStatus({
        ...baseInput,
        services: {
          ...baseInput.services,
          voiceServer: { configured: true, status: "unhealthy" },
        },
      }),
    ).toBe("degraded");
  });

  it("retourne unhealthy si PostgreSQL est indisponible", () => {
    expect(
      deriveOverallStatus({
        ...baseInput,
        database: { status: "error" },
      }),
    ).toBe("unhealthy");
  });
});

describe("toRestaurantSnapshot", () => {
  it("filtre les appels des autres restaurants et retire les internals", () => {
    const view = toRestaurantSnapshot(
      {
        status: "healthy",
        timestamp: "2026-09-11T00:00:00.000Z",
        services: { postgres: { status: "healthy" } },
        engines: { llm: { ready: true } },
        fallbackOpenAI: false,
        latencies: {
          gpuStt: { last: 120, average: 110, count: 2 },
          postgres: { last: 4 },
        },
        process: { pid: 1, memory: { heapUsedMb: 80 } },
        http: { errorRate: 0 },
        runtime: {
          activeCalls: [
            { streamSid: "A", instanceId: "tenant-1", route: "voice-server" },
            { streamSid: "B", instanceId: "tenant-2", route: "voice-server" },
          ],
        },
        alerts: { recent: [] },
      },
      "tenant-1",
    );

    expect(view.process).toBeUndefined();
    expect(view.http).toBeUndefined();
    expect(view.runtime.activeCalls).toEqual([
      {
        streamSid: "A",
        startedAt: undefined,
        elapsedSeconds: undefined,
        route: "voice-server",
        stage: undefined,
        provider: undefined,
        lastError: undefined,
      },
    ]);
    expect(view.services.postgres.status).toBe("healthy");
    expect(view.latencies.gpuStt.last).toBe(120);
    expect(view.latencies.postgres.last).toBe(4);
    expect(view.callFlow).toEqual([]);
  });

  it("filtre le flux d'appels du restaurant", () => {
    const view = toRestaurantSnapshot(
      {
        status: "healthy",
        timestamp: "2026-09-11T00:00:00.000Z",
        services: {},
        engines: {},
        runtime: { activeCalls: [] },
        callFlow: [
          { id: "1", tenantId: "tenant-1", outcome: "hangup", detail: "ligne off" },
          { id: "2", tenantId: "tenant-2", outcome: "ok", detail: "twiml" },
          { id: "3", tenantId: null, outcome: "hangup", detail: "signature" },
        ],
      },
      "tenant-1",
    );
    expect(view.callFlow).toEqual([
      { id: "1", tenantId: "tenant-1", outcome: "hangup", detail: "ligne off" },
    ]);
  });
});
