/**
 * Queue de retry asynchrone pour transcriptions en échec
 * Permet de retry les transcriptions qui ont échoué sans bloquer le flux principal
 */

import { callLogger } from "../logging/logger.js";
import fetch from "node-fetch";

/**
 * Queue en mémoire (en production, utiliser Redis ou Bull)
 */
const queue = [];
const processing = new Set(); // IDs en cours de traitement
const maxRetries = 3;
const processingInterval = 30000; // Traiter la queue toutes les 30 secondes

/**
 * Structure d'un item de queue
 * @typedef {Object} QueueItem
 * @property {string} streamSid - ID du stream
 * @property {string} transcription - Transcription à traiter
 * @property {number} retries - Nombre de tentatives déjà effectuées
 * @property {Date} createdAt - Date de création
 * @property {Date} nextRetry - Prochaine tentative
 */

/**
 * Ajoute une transcription à la queue pour retry
 * @param {string} streamSid - ID du stream
 * @param {string} transcription - Transcription à traiter
 * @param {number} retries - Nombre de tentatives déjà effectuées (défaut: 0)
 */
export function enqueueTranscription(streamSid, transcription, retries = 0, instanceId = null) {
  const now = Date.now();
  const backoffDelay = Math.min(1000 * Math.pow(2, retries), 300000); // Max 5 minutes
  const nextRetry = new Date(now + backoffDelay);

  const item = {
    streamSid,
    transcription,
    retries,
    instanceId,
    createdAt: new Date(now),
    nextRetry,
  };

  queue.push(item);

  callLogger.info(streamSid, "Transcription ajoutée à la queue de retry", {
    retries,
    nextRetry: nextRetry.toISOString(),
    queueSize: queue.length,
    event: "transcription_queued",
  });
}

/**
 * Traite un item de la queue
 * @param {QueueItem} item - Item à traiter
 */
async function processQueueItem(item) {
  const { streamSid, transcription, retries, instanceId } = item;

  // Vérifier si c'est le moment de retry
  if (Date.now() < item.nextRetry.getTime()) {
    return; // Pas encore le moment
  }

  // Vérifier si on a dépassé le max de retry
  if (retries >= maxRetries) {
    // Retirer de la queue et logger
    const index = queue.findIndex(q => q.streamSid === streamSid);
    if (index !== -1) {
      queue.splice(index, 1);
    }
    processing.delete(streamSid);

    callLogger.error(streamSid, new Error("Max retries atteint pour transcription en queue"), {
      source: "transcriptionQueue",
      retries,
      event: "max_retries_reached",
    });
    return;
  }

  // Marquer comme en cours de traitement
  if (processing.has(streamSid)) {
    return; // Déjà en cours
  }
  processing.add(streamSid);

  try {
    callLogger.info(streamSid, `Traitement transcription en queue (tentative ${retries + 1}/${maxRetries})`, {
      event: "queue_item_processing",
    });

    const apiUrl = `http://localhost:${process.env.PORT || 8080}/api/process-call`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.X_API_KEY,
        "x-internal-secret":
          process.env.SMARTCRM_INTERNAL_SECRET ||
          process.env.WEBSITE_INTERNAL_SECRET ||
          process.env.X_API_KEY,
        "x-stream-sid": streamSid || "",
        "x-tenant-id": instanceId || "",
      },
      body: JSON.stringify({ transcription, instanceId }),
    });

    if (response.ok) {
      // Succès - retirer de la queue
      const index = queue.findIndex(q => q.streamSid === streamSid);
      if (index !== -1) {
        queue.splice(index, 1);
      }
      processing.delete(streamSid);

      callLogger.info(streamSid, "Transcription en queue traitée avec succès", {
        retries: retries + 1,
        event: "queue_item_success",
      });
    } else {
      // Échec - réajouter à la queue avec retry + 1
      processing.delete(streamSid);
      enqueueTranscription(streamSid, transcription, retries + 1, instanceId);

      callLogger.warn(streamSid, "Échec sauvegarde transcription en queue, réajoutée", {
        status: response.status,
        retries: retries + 1,
        event: "queue_item_retry",
      });
    }
  } catch (error) {
    // Erreur - réajouter à la queue avec retry + 1
    processing.delete(streamSid);
    enqueueTranscription(streamSid, transcription, retries + 1, instanceId);

    callLogger.error(streamSid, error, {
      source: "transcriptionQueue",
      context: "process_queue_item",
      retries: retries + 1,
      event: "queue_item_error",
    });
  }
}

/**
 * Traite la queue périodiquement
 */
async function processQueue() {
  if (queue.length === 0) {
    return;
  }

  // Traiter les items prêts (nextRetry <= now)
  const now = Date.now();
  const readyItems = queue.filter(item => item.nextRetry.getTime() <= now);

  // Traiter en parallèle (max 5 à la fois)
  const batch = readyItems.slice(0, 5);
  await Promise.all(batch.map(item => processQueueItem(item)));
}

/**
 * Démarre le worker de queue
 */
export function startQueueWorker() {
  // Traiter immédiatement
  processQueue();

  // Puis traiter périodiquement
  setInterval(() => {
    processQueue();
  }, processingInterval);

  callLogger.info("SYSTEM", "Worker de queue de transcriptions démarré", {
    interval: `${processingInterval}ms`,
    event: "queue_worker_started",
  });
}

/**
 * Récupère l'état de la queue
 * @returns {Object} - État de la queue
 */
export function getQueueStatus() {
  return {
    queueSize: queue.length,
    processing: processing.size,
    items: queue.map(item => ({
      streamSid: item.streamSid,
      retries: item.retries,
      createdAt: item.createdAt,
      nextRetry: item.nextRetry,
    })),
  };
}




