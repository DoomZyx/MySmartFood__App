import { withTenant } from "../../database/transaction.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as Menu from "../../models/pg/Menu.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import * as CallSession from "../../models/pg/CallSession.js";
import {
  catalogToMenuPricing,
  hoursFromLegacy,
  hoursToLegacy,
} from "../mappers/pricingMapper.js";
import { eurosToCents } from "../mappers/legacyStatus.js";
import { invalidateVoiceContextCache } from "../../utils/voiceContextCache.js";
import { requireTenantForDocuments } from "./platformTenantDocuments.js";

const TWILIO_USD_PER_MINUTE = 0.008;
const USD_TO_EUR = 0.92;

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function usageFromSummary(summary) {
  const billedMinutes = Number(summary?.billedMinutes) || 0;
  const costUsd = roundMoney(billedMinutes * TWILIO_USD_PER_MINUTE);
  return {
    seconds: Number(summary?.seconds) || 0,
    billedMinutes,
    callCount: Number(summary?.callCount) || 0,
    usdPerMinute: TWILIO_USD_PER_MINUTE,
    usdToEur: USD_TO_EUR,
    costUsd,
    costEur: roundMoney(costUsd * USD_TO_EUR),
  };
}

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

async function assertOpenTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  requireTenantForDocuments(tenant);
  if (tenant.status === "closed") {
    httpError("Établissement fermé", 409);
  }
  return tenant;
}

export async function getTenantOps(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  requireTenantForDocuments(tenant);
  return withTenant(tenantId, async (client) => {
    const hours = await OpeningHours.list(client, tenantId);
    const catalog = await Menu.loadCatalog(client, tenantId);
    const calls = await CallSession.listRecent(client, tenantId, { limit: 50 });
    const totalUsage = await CallSession.summarizeUsage(client, tenantId);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodUsage = await CallSession.summarizeUsage(client, tenantId, {
      since: monthStart,
    });
    return {
      hours: hoursToLegacy(hours),
      menus: catalogToMenuPricing(catalog),
      calls,
      usage: {
        total: usageFromSummary(totalUsage),
        period: usageFromSummary(periodUsage),
      },
    };
  });
}

export async function updateTenantHours(tenantId, horairesOuverture) {
  await assertOpenTenant(tenantId);
  if (!horairesOuverture || typeof horairesOuverture !== "object") {
    httpError("Horaires invalides", 400);
  }
  await withTenant(tenantId, async (client) => {
    await OpeningHours.replaceAll(
      client,
      tenantId,
      hoursFromLegacy(horairesOuverture)
    );
  });
  invalidateVoiceContextCache(tenantId);
  return getTenantOps(tenantId);
}

export async function updateTenantMenuItem(tenantId, itemId, body = {}) {
  await assertOpenTenant(tenantId);
  await withTenant(tenantId, async (client) => {
    const existing = await Menu.findItemById(client, tenantId, itemId);
    if (!existing) httpError("Produit introuvable", 404);
    const name =
      body.name !== undefined ? String(body.name || "").trim() : existing.name;
    if (!name) httpError("Nom du produit requis", 400);
    let priceCents = existing.priceCents;
    if (body.prixBase !== undefined) {
      priceCents = eurosToCents(body.prixBase);
    }
    const isAvailable =
      body.disponible !== undefined
        ? Boolean(body.disponible)
        : existing.isAvailable;
    await Menu.updateItem(client, tenantId, itemId, {
      name,
      description: existing.description,
      priceCents,
      isAvailable,
      sizeLabel: existing.sizeLabel,
      isCustomizable: existing.isCustomizable,
      maxMeats: existing.maxMeats,
      includedIngredients: existing.includedIngredients,
      availableIngredients: existing.availableIngredients,
    });
  });
  invalidateVoiceContextCache(tenantId);
  return getTenantOps(tenantId);
}
