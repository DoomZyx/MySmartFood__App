/**
 * Métriques in-memory du pipeline STT + extraction GPT.
 * Perdues au redémarrage ; suffisantes pour un process unique.
 */

const startedAt = Date.now();

const metrics = {
  totalCalls: 0,
  sttErrors: 0,
  parsingErrors: 0,
  invalidPhones: 0,
  invalidTimes: 0,
  successfulExtractions: 0,
};

let consecutiveFailures = 0;

function increment(metricName, value = 1) {
  if (Object.prototype.hasOwnProperty.call(metrics, metricName)) {
    metrics[metricName] += value;
  }
}

/** @deprecated préférer les helpers typés */
export function recordMetric(metricName, value = 1) {
  increment(metricName, value);
}

export function recordSTTError() {
  increment("sttErrors");
  increment("totalCalls");
  consecutiveFailures += 1;
}

export function recordParsingError() {
  increment("parsingErrors");
  increment("totalCalls");
  consecutiveFailures += 1;
}

export function recordInvalidPhone() {
  increment("invalidPhones");
}

export function recordInvalidTime() {
  increment("invalidTimes");
}

export function recordSuccessfulExtraction() {
  increment("successfulExtractions");
  increment("totalCalls");
  consecutiveFailures = 0;
}

function rate(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

export function getErrorRates() {
  const total = metrics.totalCalls;
  const failures = metrics.sttErrors + metrics.parsingErrors;

  return {
    sttErrorRate: rate(metrics.sttErrors, total),
    parsingErrorRate: rate(metrics.parsingErrors, total),
    invalidPhoneRate: rate(metrics.invalidPhones, total),
    invalidTimeRate: rate(metrics.invalidTimes, total),
    successRate: rate(metrics.successfulExtractions, total),
    errorRate: rate(failures, total),
    totalCalls: total,
    consecutiveFailures,
    collectedSince: new Date(startedAt).toISOString(),
  };
}

export function getAllMetrics() {
  return {
    ...metrics,
    consecutiveFailures,
    collectedSince: new Date(startedAt).toISOString(),
    rates: getErrorRates(),
  };
}

export function getConsecutiveFailures() {
  return consecutiveFailures;
}

export function resetMetrics() {
  Object.keys(metrics).forEach((key) => {
    metrics[key] = 0;
  });
  consecutiveFailures = 0;
}
