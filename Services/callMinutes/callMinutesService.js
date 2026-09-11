/**
 * Service de suivi des minutes d'appel par client et abonnement.
 * Persistance MongoDB (quota + monitoring). Mois civil UTC (adapté FR/LU/BE).
 * Abonnement et clientId : variables d'environnement CALL_MINUTES_SUBSCRIPTION, CALL_MINUTES_CLIENT_ID.
 */

import path from "path";
import { fileURLToPath } from "url";
import CallMonitorModel from "../../models/callMonitor.js";
import ClientQuotaModel from "../../models/clientQuota.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Variables d'environnement (abonnement acheté, client par défaut)
// ---------------------------------------------------------------------------

/** Id abonnement : echauffement | mise_en_place | coup_de_feu | service_continu | carte_blanche */
export function getSubscriptionKeyFromEnv() {
  const raw = (process.env.CALL_MINUTES_SUBSCRIPTION || "echauffement").trim().toLowerCase();
  const key = raw.replace(/\s+/g, "_");
  return SUBSCRIPTION_KEYS.includes(key) ? key : "echauffement";
}

/** clientId utilisé par défaut (une instance = un client). */
export function getDefaultClientId() {
  return (process.env.CALL_MINUTES_CLIENT_ID || "default").trim() || "default";
}

const DEFAULT_INSTANCE_ID = "inst_default";

function resolveInstanceId(instanceId) {
  return instanceId != null && String(instanceId).trim() !== "" ? String(instanceId).trim() : DEFAULT_INSTANCE_ID;
}

// ---------------------------------------------------------------------------
// Constantes abonnements (nom, prix €, quota minutes/mois)
// ---------------------------------------------------------------------------

export const SUBSCRIPTIONS = {
  echauffement: { nom: "L'Echauffement", prix: 60, quotaMax: 180 },
  mise_en_place: { nom: "La Mise en Place", prix: 180, quotaMax: 500 },
  coup_de_feu: { nom: "Le Coup de Feu", prix: 260, quotaMax: 800 },
  service_continu: { nom: "Le Service Continu", prix: 380, quotaMax: 1250 },
  carte_blanche: { nom: "La Carte Blanche", prix: 570, quotaMax: 2000 },
  developpeur: { nom: "Développeur", prix: 0, quotaMax: 999999 }
};

const SUBSCRIPTION_KEYS = Object.keys(SUBSCRIPTIONS);

// ---------------------------------------------------------------------------
// Config (chemins indépendants de process.cwd() – pour éventuel fallback JSON)
// ---------------------------------------------------------------------------

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "..", "data");
let dataFilePath = path.join(DEFAULT_DATA_DIR, "callMinutesQuota.json");
let activeFilePath = path.join(DEFAULT_DATA_DIR, "callMinutesActive.json");

export function configurePaths(options = {}) {
  if (options.dataPath) dataFilePath = options.dataPath;
  if (options.activePath) activeFilePath = options.activePath;
}

/**
 * Mois civil (UTC). Adapté pour France, Luxembourg, Belgique.
 * @param {Date} d
 * @returns {string} YYYY-MM-DD
 */
function getMonthStart(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

// ---------------------------------------------------------------------------
// Quota client (MongoDB, opérations atomiques)
// ---------------------------------------------------------------------------

/**
 * Récupère le quota d'un client. Crée l'entrée si absente (abonnement depuis env ou param).
 * @param {string} [clientId]
 * @param {string} [defaultSubscriptionKey]
 * @param {string} [instanceId]
 */
export async function getClientQuota(clientId, defaultSubscriptionKey, instanceId) {
  const iid = resolveInstanceId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const subKey = defaultSubscriptionKey != null ? defaultSubscriptionKey : getSubscriptionKeyFromEnv();
  const thisMonth = getMonthStart(new Date());

  let doc = await ClientQuotaModel.findOne({ instanceId: iid, clientId: cid }).lean();
  if (!doc) {
    const sub = SUBSCRIPTIONS[subKey] || SUBSCRIPTIONS.echauffement;
    doc = await ClientQuotaModel.create({
      instanceId: iid,
      clientId: cid,
      abonnement: subKey,
      quotaMax: sub.quotaMax,
      minutesUtilisees: 0,
      periodeDebut: thisMonth
    });
    return { clientId: doc.clientId, abonnement: doc.abonnement, quotaMax: doc.quotaMax, minutesUtilisees: doc.minutesUtilisees, periodeDebut: doc.periodeDebut };
  }

  if (doc.periodeDebut !== thisMonth) {
    const sub = SUBSCRIPTIONS[doc.abonnement] || SUBSCRIPTIONS.echauffement;
    await ClientQuotaModel.updateOne(
      { instanceId: iid, clientId: cid },
      { $set: { minutesUtilisees: 0, periodeDebut: thisMonth, quotaMax: sub.quotaMax } }
    );
    return { clientId: cid, abonnement: doc.abonnement, quotaMax: sub.quotaMax, minutesUtilisees: 0, periodeDebut: thisMonth };
  }

  return { clientId: doc.clientId, abonnement: doc.abonnement, quotaMax: doc.quotaMax, minutesUtilisees: doc.minutesUtilisees, periodeDebut: doc.periodeDebut };
}

/**
 * Assigne un abonnement à un client (création ou mise à jour).
 */
export async function setClientSubscription(clientId, subscriptionKey, instanceId) {
  if (!SUBSCRIPTION_KEYS.includes(subscriptionKey)) {
    throw new Error(`Abonnement inconnu: ${subscriptionKey}`);
  }
  const iid = resolveInstanceId(instanceId);
  const cid = (clientId != null && clientId !== "") ? clientId : getDefaultClientId();
  const thisMonth = getMonthStart(new Date());
  const sub = SUBSCRIPTIONS[subscriptionKey];
  const existing = await ClientQuotaModel.findOne({ instanceId: iid, clientId: cid }).lean();
  const payload = {
    instanceId: iid,
    abonnement: subscriptionKey,
    quotaMax: sub.quotaMax,
    minutesUtilisees: existing ? existing.minutesUtilisees : 0,
    periodeDebut: existing && existing.periodeDebut === thisMonth ? existing.periodeDebut : thisMonth
  };
  if (!existing) payload.clientId = cid;
  await ClientQuotaModel.findOneAndUpdate(
    { instanceId: iid, clientId: cid },
    { $set: payload },
    { upsert: true, new: true }
  );
  return { clientId: cid, ...payload };
}

// ---------------------------------------------------------------------------
// Vérification avant appel
// ---------------------------------------------------------------------------

export async function canStartCall(clientId, instanceId) {
  const iid = resolveInstanceId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const quota = await getClientQuota(cid, null, iid);
  if (quota.minutesUtilisees >= quota.quotaMax) {
    return { allowed: false, reason: "Quota mensuel atteint. Renouvellement au prochain mois.", quota };
  }
  return { allowed: true, quota };
}

// ---------------------------------------------------------------------------
// Appels actifs : CallMonitor (endedAt: null) + nettoyage orphelins > 4h
// Plusieurs appels simultanés par client autorisés.
// ---------------------------------------------------------------------------

const STALE_ACTIVE_MS = 4 * 60 * 60 * 1000;

/**
 * Récupère tous les appels en cours pour un client. Nettoie les orphelins > 4h (lazy).
 * @returns {Promise<Array<{ callSid: string, startedAt: string, callerNumber?: string }>>}
 */
export async function getActiveCalls(clientId, instanceId) {
  const iid = resolveInstanceId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const docs = await CallMonitorModel.find({ instanceId: iid, clientId: cid, endedAt: null }).sort({ startedAt: 1 }).lean();
  const now = Date.now();
  const result = [];
  for (const doc of docs) {
    const startedMs = new Date(doc.startedAt).getTime();
    if (now - startedMs > STALE_ACTIVE_MS) {
      await CallMonitorModel.updateOne(
        { _id: doc._id },
        { $set: { endedAt: doc.startedAt, durationSeconds: 0 } }
      );
      continue;
    }
    result.push({
      callSid: doc.callSid,
      startedAt: doc.startedAt instanceof Date ? doc.startedAt.toISOString() : doc.startedAt,
      callerNumber: doc.callerNumber ?? undefined
    });
  }
  return result;
}

/**
 * Récupère un seul appel en cours (le plus ancien). Rétrocompatibilité.
 */
export async function getActiveCall(clientId, instanceId) {
  const calls = await getActiveCalls(clientId, instanceId);
  return calls.length > 0 ? calls[0] : null;
}

/**
 * Compteur temps réel : tous les appels en cours avec durée écoulée.
 * @returns {Promise<Array<{ callSid: string, startedAt: string, elapsedSeconds: number, elapsedMinutes: number, callerNumber?: string }>>}
 */
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
      callerNumber: a.callerNumber
    };
  });
}

/**
 * Un seul appel avec elapsed (rétrocompat). Retourne le premier actif ou null.
 */
export async function getActiveCallWithElapsed(clientId, instanceId) {
  const calls = await getActiveCallsWithElapsed(clientId, instanceId);
  return calls.length > 0 ? calls[0] : null;
}

// ---------------------------------------------------------------------------
// Démarrer / terminer un appel
// ---------------------------------------------------------------------------

/**
 * Enregistre le début d'un appel (CallMonitor). Appels simultanés par client autorisés.
 */
export async function startCall(callSid, options = {}) {
  const iid = resolveInstanceId(options.instanceId);
  const cid = (options.clientId != null && options.clientId !== "") ? options.clientId : getDefaultClientId();
  const check = await canStartCall(cid, iid);
  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }
  try {
    await CallMonitorModel.create({
      instanceId: iid,
      clientId: cid,
      callSid,
      callerNumber: options.callerNumber != null ? String(options.callerNumber) : null,
      startedAt: new Date()
    });
  } catch (err) {
    if (err.code === 11000) return { success: false, reason: "Doublon callSid." };
    throw err;
  }
  return { success: true };
}

/**
 * Termine un appel. clientId déduit depuis CallMonitor (callSid) pour cohérence.
 * Mise à jour quota atomique (MongoDB pipeline).
 */
export async function endCall(callSid, durationMinutes, clientId, instanceId) {
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const durationSeconds = Math.round(duration * 60);

  let cid = null;
  let iid = resolveInstanceId(instanceId);
  const monitorDoc = await CallMonitorModel.findOne({ callSid }).lean();
  if (monitorDoc) {
    cid = monitorDoc.clientId;
    if (monitorDoc.instanceId) iid = monitorDoc.instanceId;
  }
  if (cid == null || cid === "") cid = (clientId != null && clientId !== "") ? clientId : getDefaultClientId();

  await CallMonitorModel.updateOne(
    { callSid },
    { $set: { endedAt: new Date(), durationSeconds } }
  );

  const thisMonth = getMonthStart(new Date());
  const updated = await ClientQuotaModel.findOneAndUpdate(
    { instanceId: iid, clientId: cid },
    [
      {
        $set: {
          minutesUtilisees: {
            $cond: [
              { $ne: ["$periodeDebut", thisMonth] },
              duration,
              { $add: ["$minutesUtilisees", duration] }
            ]
          },
          periodeDebut: {
            $cond: [{ $ne: ["$periodeDebut", thisMonth] }, thisMonth, "$periodeDebut"]
          }
        }
      }
    ],
    { new: true }
  );

  if (!updated) {
    await getClientQuota(cid, null, iid);
    await ClientQuotaModel.updateOne({ instanceId: iid, clientId: cid }, { $inc: { minutesUtilisees: duration } });
    const again = await ClientQuotaModel.findOne({ instanceId: iid, clientId: cid }).lean();
    return { success: true, quotaExceeded: (again?.minutesUtilisees ?? 0) >= (again?.quotaMax ?? 0) };
  }

  const quotaExceeded = updated.minutesUtilisees >= updated.quotaMax;
  return { success: true, quotaExceeded };
}

/**
 * Vérifie si le quota est dépassé en cours d'appel (somme de tous les appels actifs).
 */
export async function checkQuotaExceededDuringCall(clientId, instanceId) {
  const iid = resolveInstanceId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const quota = await getClientQuota(cid, null, iid);
  const actives = await getActiveCalls(cid, iid);
  if (actives.length === 0) {
    return {
      exceeded: quota.minutesUtilisees >= quota.quotaMax,
      callSids: [],
      currentTotalMinutes: quota.minutesUtilisees,
      quotaMax: quota.quotaMax
    };
  }
  const now = Date.now();
  let currentCallMinutes = 0;
  for (const a of actives) {
    currentCallMinutes += (now - new Date(a.startedAt).getTime()) / (60 * 1000);
  }
  const currentTotalMinutes = (quota.minutesUtilisees || 0) + currentCallMinutes;
  const exceeded = currentTotalMinutes >= quota.quotaMax;
  return {
    exceeded,
    callSids: actives.map((a) => a.callSid),
    currentTotalMinutes: Math.round(currentTotalMinutes * 100) / 100,
    quotaMax: quota.quotaMax
  };
}

/**
 * Marque tous les appels en cours du client comme terminés (base).
 */
export async function clearActiveCall(clientId, instanceId) {
  const iid = resolveInstanceId(instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  await CallMonitorModel.updateMany(
    { instanceId: iid, clientId: cid, endedAt: null },
    { $set: { endedAt: new Date(), durationSeconds: 0 } }
  );
}

// ---------------------------------------------------------------------------
// Monitoring (liste des appels)
// ---------------------------------------------------------------------------

export async function listCallMonitoring(clientId, options = {}, instanceId) {
  const iid = resolveInstanceId(instanceId ?? options.instanceId);
  const cid = clientId != null && clientId !== "" ? clientId : getDefaultClientId();
  const limit = Math.min(Math.max(1, Number(options.limit) || 50), 200);
  const skip = Math.max(0, Number(options.skip) || 0);
  const docs = await CallMonitorModel.find({ instanceId: iid, clientId: cid })
    .sort({ startedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return docs.map((d) => ({
    clientId: d.clientId,
    callSid: d.callSid,
    callerNumber: d.callerNumber ?? null,
    startedAt: d.startedAt,
    endedAt: d.endedAt ?? null,
    durationSeconds: d.durationSeconds ?? null
  }));
}
