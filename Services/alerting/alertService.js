/**
 * Alertes critiques : seuils sur extraction, circuit breaker, échecs consécutifs.
 * Canal actuel : logs structurés + tampon mémoire (pas d'email / Slack).
 */

import { getAllMetrics, getErrorRates } from "../monitoring/extractionMetrics.js";
import { callLogger } from "../logging/logger.js";
import circuitBreaker from "../gptServices/circuitBreaker.js";

const ALERT_THRESHOLDS = {
  errorRate: 5.0,
  consecutiveFailures: 10,
};

const ALERT_COOLDOWN_MS = {
  errorRate: 300000,
  circuitBreaker: 600000,
  consecutiveFailures: 300000,
};

const MAX_RECENT_ALERTS = 50;

const lastAlertsAt = {
  errorRate: 0,
  circuitBreaker: 0,
  consecutiveFailures: 0,
};

const recentAlerts = [];
let monitoringInterval = null;

function canSendAlert(alertType) {
  const now = Date.now();
  const lastAlert = lastAlertsAt[alertType] || 0;
  const cooldown = ALERT_COOLDOWN_MS[alertType] || 300000;
  if (now - lastAlert < cooldown) {
    return false;
  }
  lastAlertsAt[alertType] = now;
  return true;
}

function pushRecentAlert(entry) {
  recentAlerts.unshift(entry);
  if (recentAlerts.length > MAX_RECENT_ALERTS) {
    recentAlerts.length = MAX_RECENT_ALERTS;
  }
}

async function sendAlert(type, message, details = {}) {
  const entry = {
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  pushRecentAlert(entry);

  callLogger.error("SYSTEM", new Error(`ALERTE: ${message}`), {
    source: "alertService",
    alertType: type,
    ...details,
    event: "critical_alert",
  });
}

export async function checkErrorRate() {
  const rates = getErrorRates();
  if (rates.totalCalls === 0) return;

  if (rates.errorRate > ALERT_THRESHOLDS.errorRate && canSendAlert("errorRate")) {
    await sendAlert(
      "errorRate",
      `Taux d'erreur eleve: ${rates.errorRate}% (seuil: ${ALERT_THRESHOLDS.errorRate}%)`,
      {
        errorRate: rates.errorRate,
        threshold: ALERT_THRESHOLDS.errorRate,
        metrics: rates,
      }
    );
  }
}

export async function checkCircuitBreaker() {
  const state = circuitBreaker.getState();
  if (state.state === "OPEN" && canSendAlert("circuitBreaker")) {
    await sendAlert(
      "circuitBreaker",
      "Circuit breaker ouvert - OpenAI semble indisponible",
      {
        circuitState: state,
        failures: state.failures,
        nextAttempt: state.nextAttempt,
      }
    );
  }
}

export async function checkConsecutiveFailures() {
  const metrics = getAllMetrics();
  const failures = metrics.consecutiveFailures || 0;
  if (failures > ALERT_THRESHOLDS.consecutiveFailures && canSendAlert("consecutiveFailures")) {
    await sendAlert(
      "consecutiveFailures",
      `Nombre eleve d'echecs consecutifs: ${failures}`,
      {
        failures,
        totalCalls: metrics.totalCalls,
        successRate: metrics.rates?.successRate,
      }
    );
  }
}

export async function checkAllAlerts() {
  try {
    await Promise.all([
      checkErrorRate(),
      checkCircuitBreaker(),
      checkConsecutiveFailures(),
    ]);
  } catch (error) {
    callLogger.error("SYSTEM", error, {
      source: "alertService",
      context: "check_all_alerts",
    });
  }
}

export function startAlertMonitoring(interval = 60000) {
  if (monitoringInterval) return;

  checkAllAlerts();
  monitoringInterval = setInterval(() => {
    checkAllAlerts();
  }, interval);
  if (typeof monitoringInterval.unref === "function") {
    monitoringInterval.unref();
  }

  callLogger.info("SYSTEM", "Monitoring d'alertes demarre", {
    interval: `${interval}ms`,
    event: "alert_monitoring_started",
  });
}

export function stopAlertMonitoring() {
  if (!monitoringInterval) return;
  clearInterval(monitoringInterval);
  monitoringInterval = null;
}

export function isAlertMonitoringActive() {
  return monitoringInterval != null;
}

export function getRecentAlerts(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_RECENT_ALERTS);
  return recentAlerts.slice(0, safeLimit);
}

export function resetAlertState() {
  lastAlertsAt.errorRate = 0;
  lastAlertsAt.circuitBreaker = 0;
  lastAlertsAt.consecutiveFailures = 0;
  recentAlerts.length = 0;
}
