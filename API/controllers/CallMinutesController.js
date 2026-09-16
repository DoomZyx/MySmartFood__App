import {
  getActiveCallsWithElapsed,
  getClientQuota,
  listCallMonitoring
} from "../../Services/callMinutes/callMinutesService.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";

/**
 * Controller suivi des minutes d'appel et monitoring.
 */
export class CallMinutesController {
  /**
   * Compteur temps réel : appels en cours avec durée écoulée (secondes, minutes).
   * Un seul appel : même forme qu'avant (callSid, startedAt, ...). Plusieurs : active + calls[].
   * GET /api/call-minutes/active?clientId= (clientId optionnel)
   */
  static async getActiveWithElapsed(request, reply) {
    try {
      const clientId = request.query.clientId ?? undefined;
      const instanceId = resolveRuntimeTenantId(request.instanceId);
      const calls = await getActiveCallsWithElapsed(clientId, instanceId);
      if (calls.length === 0) {
        return reply.send({ active: false, elapsedSeconds: 0, elapsedMinutes: 0 });
      }
      const payload = {
        active: true,
        callSid: calls[0].callSid,
        startedAt: calls[0].startedAt,
        elapsedSeconds: calls[0].elapsedSeconds,
        elapsedMinutes: calls[0].elapsedMinutes,
        callerNumber: calls[0].callerNumber ?? null
      };
      if (calls.length > 1) {
        payload.calls = calls.map((c) => ({
          callSid: c.callSid,
          startedAt: c.startedAt,
          elapsedSeconds: c.elapsedSeconds,
          elapsedMinutes: c.elapsedMinutes,
          callerNumber: c.callerNumber ?? null
        }));
      }
      return reply.send(payload);
    } catch (error) {
      request.log?.error?.(error);
      return reply.code(500).send({ error: true, message: error.message });
    }
  }

  /**
   * Quota du client (abonnement, minutes utilisées, max).
   * GET /api/call-minutes/quota?clientId= (clientId optionnel)
   */
  static async getQuota(request, reply) {
    try {
      const clientId = request.query.clientId ?? undefined;
      const instanceId = resolveRuntimeTenantId(request.instanceId);
      const quota = await getClientQuota(clientId, null, instanceId);
      return reply.send(quota);
    } catch (error) {
      request.log?.error?.(error);
      return reply.code(500).send({ error: true, message: error.message });
    }
  }

  /**
   * Liste des appels (monitoring) : durée, numéro appelant, dates.
   * GET /api/call-minutes/monitoring?clientId=&limit=50&skip=0
   */
  static async getMonitoring(request, reply) {
    try {
      const clientId = request.query.clientId ?? undefined;
      const instanceId = resolveRuntimeTenantId(request.instanceId);
      const limit = request.query.limit ?? 50;
      const skip = request.query.skip ?? 0;
      const list = await listCallMonitoring(clientId, { limit, skip }, instanceId);
      return reply.send({ calls: list });
    } catch (error) {
      request.log?.error?.(error);
      return reply.code(500).send({ error: true, message: error.message });
    }
  }
}
