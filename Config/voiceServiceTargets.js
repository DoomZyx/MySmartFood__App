function targetFromBaseUrl(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return {
    healthUrl: `${normalizedBaseUrl}/health`,
    monitoringUrl: `${normalizedBaseUrl}/monitoring`,
    wsUrl: `${normalizedBaseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")}/media-stream`,
  };
}

/**
 * Retourne les réplicas Voice Server configurés.
 * VOICE_SERVICE_URLS prend la priorité sur les variables historiques.
 */
export function getVoiceServiceTargets() {
  const configuredBases = String(process.env.VOICE_SERVICE_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredBases.length > 0) {
    return configuredBases.map(targetFromBaseUrl);
  }

  const healthUrl = (
    process.env.VOICE_HEALTH_URL || "http://127.0.0.1:8090/health"
  ).trim();
  return [
    {
      healthUrl,
      monitoringUrl: (
        process.env.VOICE_MONITORING_URL ||
        healthUrl.replace(/\/health\/?$/, "/monitoring")
      ).trim(),
      wsUrl: (
        process.env.VOICE_WS_URL || "ws://127.0.0.1:8090/media-stream"
      ).trim(),
    },
  ];
}
