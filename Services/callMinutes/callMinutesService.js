/**
 * Suivi des minutes d'appel par établissement.
 * Persistance PostgreSQL (call_quotas + call_sessions). Mois civil UTC.
 */

import { withTenant } from "../../database/transaction.js";
import * as CallQuota from "../../models/pg/CallQuota.js";
import * as CallSession from "../../models/pg/CallSession.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getSubscriptionKeyFromEnv() {
  const raw = (process.env.CALL_MINUTES_SUBSCRIPTION || "echauffement").trim().toLowerCase();
  const key = raw.replace(/\s+/g, "_");
  return SUBSCRIPTION_KEYS.includes(key) ? key : "echauffement";
}

export function getDefaultClientId() {
  return (process.env.CALL_MINUTES_CLIENT_ID || "default").trim() || "default";
}

function requireTenantId(instanceId) {
  const id = resolveRuntimeTenantId(instanceId);
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Identifiant d'établissement invalide");
  }
  return id;
}

export const SUBSCRIPTIONS = {
  echauffement: { nom: "L'Echauffement", prix: 60, quotaMax: 180 },
  mise_en_place: { nom: "La Mise en Place", prix: 180, quotaMax: 500 },
  coup_de_feu: { nom: "Le Coup de Feu", prix: 260, quotaMax: 800 },
  service_continu: { nom: "Le Service Continu", prix: 380, quotaMax: 1250 },
  carte_blanche: { nom: "La Carte Blanche", prix: 570, quotaMax: 2000 },
  developpeur: { nom: "Développeur", prix: 0, quotaMax: 999999 },
};

const SUBSCRIPTION_KEYS = Object.keys(SUBSCRIPTIONS);

export function configurePaths() {
  // Conservé pour compatibilité des anciens appels ; plus de fichiers JSON.
}

function getMonthStart(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function monthBounds(ymd) {
  const [year, month] = ymd.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  return { periodStart, periodEnd };
}

function quotaToLegacy(row, clientId) {
  return {
    clientId: row.clientRef || clientId,
    abonnement: row.subscriptionKey,
    quotaMax: row.minutesIncluded,
    minutesUtilisees: Math.round(((row.secondsUsed || 0) / 60) * 100) / 100,
    periodeDebut: getMonthStart(new Date(row.periodStart)),
  };
}

export async function getClientQuota(clientId, defaultSubscriptionKey, instanceId) {
  const tenantId = requireTenantId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const subKey = defaultSubscriptionKey != null ? defaultSubscriptionKey : getSubscriptionKeyFromEnv();
  const thisMonth = getMonthStart(new Date());
  const { periodStart, periodEnd } = monthBounds(thisMonth);
  const sub = SUBSCRIPTIONS[subKey] || SUBSCRIPTIONS.echauffement;

  return withTenant(tenantId, async (client) => {
    let row = await CallQuota.findByPeriod(client, tenantId, periodStart);
    if (!row) {
      row = await CallQuota.upsertPeriod(client, tenantId, {
        periodStart,
        periodEnd,
        minutesIncluded: sub.quotaMax,
        secondsUsed: 0,
        clientRef: cid,
        subscriptionKey: subKey,
      });
    }
    return quotaToLegacy(row, cid);
  });
}

export async function setClientSubscription(clientId, subscriptionKey, instanceId) {
  if (!SUBSCRIPTION_KEYS.includes(subscriptionKey)) {
    throw new Error(`Abonnement inconnu: ${subscriptionKey}`);
  }
  const tenantId = requireTenantId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const thisMonth = getMonthStart(new Date());
  const { periodStart, periodEnd } = monthBounds(thisMonth);
  const sub = SUBSCRIPTIONS[subscriptionKey];

  return withTenant(tenantId, async (client) => {
    const row = await CallQuota.upsertPeriod(client, tenantId, {
      periodStart,
      periodEnd,
      minutesIncluded: sub.quotaMax,
      secondsUsed: 0,
      clientRef: cid,
      subscriptionKey,
    });
    return quotaToLegacy(row, cid);
  });
}

export async function canStartCall(clientId, instanceId) {
  const quota = await getClientQuota(clientId, null, instanceId);
  if (quota.minutesUtilisees >= quota.quotaMax) {
    return { allowed: false, reason: "Quota mensuel atteint. Renouvellement au prochain mois.", quota };
  }
  return { allowed: true, quota };
}

const STALE_ACTIVE_MS = 4 * 60 * 60 * 1000;

export async function getActiveCalls(clientId, instanceId) {
  const tenantId = requireTenantId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  return withTenant(tenantId, async (client) => {
    const docs = await CallSession.listActive(client, tenantId, cid);
    const now = Date.now();
    const result = [];
    for (const doc of docs) {
      const startedMs = new Date(doc.startedAt).getTime();
      if (now - startedMs > STALE_ACTIVE_MS) {
        await CallSession.completeStale(client, tenantId, cid, doc.startedAt);
        continue;
      }
      result.push({
        callSid: doc.callSid,
        startedAt: doc.startedAt instanceof Date ? doc.startedAt.toISOString() : doc.startedAt,
        callerNumber: doc.fromNumber ?? undefined,
      });
    }
    return result;
  });
}

export async function getActiveCall(clientId, instanceId) {
  const calls = await getActiveCalls(clientId, instanceId);
  return calls.length > 0 ? calls[0] : null;
}

export async function getActiveCallsWithElapsed(clientId, instanceId) {
  const actives = await getActiveCalls(clientId, instanceId);
  const now = Date.now();
  return actives.map((a) => {
    const startedMs = new Date(a.startedAt).getTime();
    const elapsedSeconds = Math.floor((now - startedMs) / 1000);
    const elapsedMinutes = Math.round((elapsedSeconds / 60) * 100) / 100;
    return {
      callSid: a.callSid,
      startedAt: a.startedAt,
      elapsedSeconds,
      elapsedMinutes,
      callerNumber: a.callerNumber,
    };
  });
}

export async function getActiveCallWithElapsed(clientId, instanceId) {
  const calls = await getActiveCallsWithElapsed(clientId, instanceId);
  return calls.length > 0 ? calls[0] : null;
}

export async function startCall(callSid, options = {}) {
  const tenantId = requireTenantId(options.instanceId);
  const cid = options.clientId != null && options.clientId !== "" ? options.clientId : getDefaultClientId();
  const check = await canStartCall(cid, tenantId);
  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }
  try {
    await withTenant(tenantId, (client) =>
      CallSession.create(client, tenantId, {
        callSid,
        fromNumber: options.callerNumber != null ? String(options.callerNumber) : null,
        clientRef: cid,
        startedAt: new Date(),
      })
    );
  } catch (err) {
    if (err.code === "23505") return { success: false, reason: "Doublon callSid." };
    throw err;
  }
  return { success: true };
}

export async function endCall(callSid, durationMinutes, clientId, instanceId) {
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const durationSeconds = Math.round(duration * 60);
  const tenantId = requireTenantId(instanceId);
  const fallbackCid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const thisMonth = getMonthStart(new Date());
  const { periodStart, periodEnd } = monthBounds(thisMonth);
  const subKey = getSubscriptionKeyFromEnv();
  const sub = SUBSCRIPTIONS[subKey] || SUBSCRIPTIONS.echauffement;

  return withTenant(tenantId, async (client) => {
    const session = await CallSession.findByCallSid(client, tenantId, callSid);
    const cid = session?.clientRef || fallbackCid;
    await CallSession.complete(client, tenantId, callSid, {
      endedAt: new Date(),
      durationSeconds,
    });
    const updated = await CallQuota.addSeconds(client, tenantId, periodStart, durationSeconds, {
      periodEnd,
      minutesIncluded: sub.quotaMax,
      clientRef: cid,
      subscriptionKey: subKey,
    });
    const minutesUtilisees = (updated.secondsUsed || 0) / 60;
    return { success: true, quotaExceeded: minutesUtilisees >= updated.minutesIncluded };
  });
}

export async function checkQuotaExceededDuringCall(clientId, instanceId) {
  const quota = await getClientQuota(clientId, null, instanceId);
  const actives = await getActiveCalls(clientId, instanceId);
  if (actives.length === 0) {
    return {
      exceeded: quota.minutesUtilisees >= quota.quotaMax,
      callSids: [],
      currentTotalMinutes: quota.minutesUtilisees,
      quotaMax: quota.quotaMax,
    };
  }
  const now = Date.now();
  let currentCallMinutes = 0;
  for (const a of actives) {
    currentCallMinutes += (now - new Date(a.startedAt).getTime()) / (60 * 1000);
  }
  const currentTotalMinutes = (quota.minutesUtilisees || 0) + currentCallMinutes;
  return {
    exceeded: currentTotalMinutes >= quota.quotaMax,
    callSids: actives.map((a) => a.callSid),
    currentTotalMinutes: Math.round(currentTotalMinutes * 100) / 100,
    quotaMax: quota.quotaMax,
  };
}

export async function clearActiveCall(clientId, instanceId) {
  const tenantId = requireTenantId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  await withTenant(tenantId, (client) => CallSession.completeAllActive(client, tenantId, cid));
}

export async function listCallMonitoring(clientId, options = {}, instanceId) {
  const tenantId = requireTenantId(instanceId ?? options.instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const limit = Math.min(Math.max(1, Number(options.limit) || 50), 200);
  const skip = Math.max(0, Number(options.skip) || 0);
  const docs = await withTenant(tenantId, (client) =>
    CallSession.listForClient(client, tenantId, cid, { limit, offset: skip })
  );
  return docs.map((d) => ({
    clientId: d.clientRef,
    callSid: d.callSid,
    callerNumber: d.fromNumber ?? null,
    startedAt: d.startedAt,
    endedAt: d.endedAt ?? null,
    durationSeconds: d.durationSeconds ?? null,
  }));
}
