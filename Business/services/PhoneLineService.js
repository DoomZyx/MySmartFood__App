import { withTenant } from "../../database/transaction.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";

function normalizePhoneE164(phone) {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+33${digits.slice(1)}`;
  }
  if (digits.length === 9 && !digits.startsWith("0")) {
    return `+33${digits}`;
  }
  if (digits.length >= 11 && digits.startsWith("33")) {
    return `+${digits}`;
  }
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PhoneLineService {
  static async getTransferNumber(instanceId) {
    const id = String(instanceId || "").trim();
    if (!UUID_PATTERN.test(id)) return null;
    return withTenant(id, async (client) => {
      const settings = await TenantSettings.find(client, id);
      const profile = await EstablishmentProfile.findByTenantId(id, client);
      const phone = settings?.transferPhone || profile?.phone;
      if (!phone) return null;
      return normalizePhoneE164(String(phone).trim());
    });
  }
}
