/**
 * Sondage des endpoints publics de sante.
 * Usage : pnpm run monitor
 */
import "../Config/env.js";

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.MONITOR_HOST || "127.0.0.1";
const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS) || 5000;
const BASE = `http://${HOST}:${PORT}`;

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function formatLine(health, status) {
  const ts = new Date().toISOString();
  const db = health.body?.db ?? "unknown";
  const mem = status.body?.memory;
  const uptime = status.body?.uptime ?? "-";
  const heap = mem ? `${mem.used}/${mem.total}` : "-";
  const rss = mem?.rss ?? "-";
  return `${ts} http=${health.status} db=${db} uptime=${uptime}s heap=${heap}MB rss=${rss}MB`;
}

async function tick() {
  try {
    const [health, status] = await Promise.all([
      fetchJson("/api/health"),
      fetchJson("/api/status"),
    ]);
    console.log(formatLine(health, status));
    if (health.status !== 200) {
      console.error("Backend degrade", health.body);
    }
  } catch (err) {
    console.error(`${new Date().toISOString()} monitoring unreachable: ${err.message}`);
  }
}

console.log(`Monitoring ${BASE} toutes les ${INTERVAL_MS}ms`);
await tick();
setInterval(tick, INTERVAL_MS);
