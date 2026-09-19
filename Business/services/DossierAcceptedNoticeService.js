import logger from "../../Services/logging/logger.js";
import * as User from "../../models/pg/User.js";
import { sendDossierAcceptedEmail } from "../../utils/emailService.js";
import { dashboardUrl, siteUrl } from "../../utils/publicUrls.js";

export async function notifyOwnerDossierAccepted({
  ownerUserId,
  businessName,
} = {}) {
  if (!ownerUserId) return { emailed: false };
  const owner = await User.findById(ownerUserId);
  if (!owner) return { emailed: false };
  await User.markDossierNoticePending(owner.id);
  try {
    const emailed = await sendDossierAcceptedEmail({
      email: owner.email,
      name: owner.name,
      businessName,
      siteUrl: `${siteUrl()}/mon-espace`,
      dashboardUrl: dashboardUrl(),
    });
    return { emailed };
  } catch (error) {
    logger.error(
      { err: error.message, userId: owner.id },
      "E-mail d'acceptation de dossier en échec"
    );
    return { emailed: false };
  }
}

export async function acknowledgeDossierNotice(user) {
  await User.clearDossierNoticePending(user.id);
  return User.findById(user.id);
}
