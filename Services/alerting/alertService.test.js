import circuitBreaker from "../gptServices/circuitBreaker.js";
import {
  recordParsingError,
  resetMetrics,
} from "../monitoring/extractionMetrics.js";
import {
  checkAllAlerts,
  getRecentAlerts,
  resetAlertState,
} from "./alertService.js";

describe("alertService", () => {
  beforeEach(() => {
    resetMetrics();
    resetAlertState();
    circuitBreaker.reset();
  });

  it("enregistre une alerte quand le circuit breaker est ouvert", async () => {
    circuitBreaker.state = "OPEN";
    circuitBreaker.nextAttempt = Date.now() + 60000;

    await checkAllAlerts();

    const alerts = getRecentAlerts();
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe("circuitBreaker");
  });

  it("alerte sur un taux d'erreur extraction eleve", async () => {
    recordParsingError();
    recordParsingError();
    recordParsingError();

    await checkAllAlerts();

    const types = getRecentAlerts().map((alert) => alert.type);
    expect(types).toContain("errorRate");
  });
});
