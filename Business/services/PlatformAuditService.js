import * as PlatformAudit from "../../models/pg/PlatformAudit.js";
import logger from "../../Services/logging/logger.js";

export async function recordPlatformAudit({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
} = {}) {
  if (!action || !targetType) return null;
  try {
    return await PlatformAudit.insert({
      actorId,
      action,
      targetType,
      targetId,
      metadata,
    });
  } catch (error) {
    logger.error(
      { err: error.message, action, targetType, targetId },
      "Audit plateforme"
    );
    return null;
  }
}
