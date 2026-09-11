import { deriveOverallStatus } from "./monitoringService.js";

const baseInput = {
  mongo: { status: "ok" },
  http: { errorRate: 0 },
  extraction: { consecutiveFailures: 0 },
  circuit: { state: "CLOSED" },
  services: {
    backend: { configured: true, status: "healthy" },
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

  it("retourne unhealthy si MongoDB est indisponible", () => {
    expect(
      deriveOverallStatus({
        ...baseInput,
        mongo: { status: "error" },
      }),
    ).toBe("unhealthy");
  });
});
