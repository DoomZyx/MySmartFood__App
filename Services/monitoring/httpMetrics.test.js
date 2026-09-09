import {
  beginHttpRequest,
  getHttpMetrics,
  recordHttpRequest,
  resetHttpMetrics,
} from "./httpMetrics.js";

describe("httpMetrics", () => {
  beforeEach(() => {
    resetHttpMetrics();
  });

  it("ignore les sondes dans la latence et les codes HTTP", () => {
    beginHttpRequest();
    recordHttpRequest({
      statusCode: 200,
      durationMs: 12,
      path: "/api/health",
    });

    const metrics = getHttpMetrics();
    expect(metrics.total).toBe(1);
    expect(metrics.probes).toBe(1);
    expect(metrics.status2xx).toBe(0);
    expect(metrics.latencyMs.avg).toBe(0);
    expect(metrics.inFlight).toBe(0);
  });

  it("compte les 5xx et calcule une latence", () => {
    beginHttpRequest();
    recordHttpRequest({
      statusCode: 500,
      durationMs: 40,
      path: "/api/orders",
    });
    beginHttpRequest();
    recordHttpRequest({
      statusCode: 200,
      durationMs: 10,
      path: "/api/orders",
    });

    const metrics = getHttpMetrics();
    expect(metrics.status5xx).toBe(1);
    expect(metrics.status2xx).toBe(1);
    expect(metrics.errorRate).toBe(50);
    expect(metrics.latencyMs.avg).toBe(25);
    expect(metrics.latencyMs.max).toBe(40);
  });
});
