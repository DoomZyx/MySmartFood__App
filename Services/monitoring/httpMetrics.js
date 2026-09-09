/**
 * Compteurs HTTP in-memory pour le process courant.
 * Les sondes (/ping, /health, /status) sont comptées à part pour ne pas fausser la latence.
 */

const LATENCY_SAMPLE_SIZE = 200;
const PROBE_PATHS = new Set(["/api/ping", "/api/health", "/api/status"]);

const metrics = {
  inFlight: 0,
  total: 0,
  probes: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
  latencySamples: [],
  maxLatencyMs: 0,
};

function normalizePath(url) {
  if (!url || typeof url !== "string") return "";
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

export function isProbePath(url) {
  return PROBE_PATHS.has(normalizePath(url));
}

export function beginHttpRequest() {
  metrics.inFlight += 1;
}

export function recordHttpRequest({ statusCode, durationMs, path, isProbe } = {}) {
  metrics.inFlight = Math.max(0, metrics.inFlight - 1);
  metrics.total += 1;

  const probe = isProbe === true || isProbePath(path);
  if (probe) {
    metrics.probes += 1;
    return;
  }

  const code = Number(statusCode) || 0;
  if (code >= 500) metrics.status5xx += 1;
  else if (code >= 400) metrics.status4xx += 1;
  else if (code >= 200) metrics.status2xx += 1;

  const duration = Math.max(0, Number(durationMs) || 0);
  if (duration > metrics.maxLatencyMs) metrics.maxLatencyMs = duration;
  metrics.latencySamples.push(duration);
  if (metrics.latencySamples.length > LATENCY_SAMPLE_SIZE) {
    metrics.latencySamples.shift();
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export function getHttpMetrics() {
  const samples = [...metrics.latencySamples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, n) => acc + n, 0);
  const nonProbe = metrics.total - metrics.probes;

  return {
    inFlight: metrics.inFlight,
    total: metrics.total,
    probes: metrics.probes,
    status2xx: metrics.status2xx,
    status4xx: metrics.status4xx,
    status5xx: metrics.status5xx,
    errorRate:
      nonProbe === 0 ? 0 : Number(((metrics.status5xx / nonProbe) * 100).toFixed(2)),
    latencyMs: {
      avg: samples.length === 0 ? 0 : Math.round(sum / samples.length),
      p95: percentile(samples, 95),
      max: metrics.maxLatencyMs,
    },
  };
}

export function resetHttpMetrics() {
  metrics.inFlight = 0;
  metrics.total = 0;
  metrics.probes = 0;
  metrics.status2xx = 0;
  metrics.status4xx = 0;
  metrics.status5xx = 0;
  metrics.latencySamples = [];
  metrics.maxLatencyMs = 0;
}
