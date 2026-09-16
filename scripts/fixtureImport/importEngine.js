import * as Client from "../../models/pg/Client.js";
import * as Order from "../../models/pg/Order.js";
import * as Reservation from "../../models/pg/Reservation.js";
import * as MongoImport from "../../models/pg/MongoImport.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { persistPricing } from "../../Business/services/MenuCatalogService.js";
import { commandesToItems } from "../../Business/mappers/orderMapper.js";
import {
  mapOrderStatusToPg,
  mapReservationStatusToPg,
  sourceFromCreatedBy,
} from "../../Business/mappers/legacyStatus.js";
import { toYmd, zonedTimeToUtc } from "../../utils/timeZone.js";

function mongoId(doc) {
  return doc?._id?.toString?.() || doc?._id || doc?.id || null;
}

function serialize(doc) {
  return JSON.parse(
    JSON.stringify(doc, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
}

export function parseArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const fixtures = argv.find((arg) => arg.startsWith("--fixtures="));
  return {
    apply,
    dryRun: !apply,
    fixturesPath: fixtures ? fixtures.slice("--fixtures=".length) : process.env.MONGO_FIXTURES_PATH || null,
  };
}

export function parseTenantMap(raw = process.env.TENANT_MAP || "") {
  const map = new Map();
  for (const pair of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [instanceId, tenantId] = pair.split(":");
    if (instanceId && tenantId) map.set(instanceId, tenantId);
  }
  return map;
}

export function emptyReport(tenantId, instanceId) {
  return {
    tenantId,
    instanceId,
    mongo: {},
    pg: {},
    imported: {},
    rejected: [],
    samples: [],
    totals: { mongoOrderLines: 0, pgOrderLines: 0, mongoOrderSumCents: 0, pgOrderSumCents: 0 },
    ok: true,
  };
}

function pushReject(report, collection, doc, reason) {
  report.rejected.push({ collection, mongoId: mongoId(doc), reason });
  report.ok = false;
}

export async function importTenantDocuments(client, tenantId, docs, { apply }) {
  const report = emptyReport(tenantId, docs.instanceId);
  if (docs.source) report.source = docs.source;
  const settings = await TenantSettings.find(client, tenantId);
  const timeZone = settings?.timezone || "Europe/Paris";

  report.mongo = {
    pricing: docs.pricing ? 1 : 0,
    clients: docs.clients.length,
    orders: docs.orders.length,
    reservations: docs.reservations.length,
    quotas: docs.quotas.length,
    calls: docs.calls.length,
    failedExtractions: docs.failedExtractions.length,
  };

  if (docs.pricing) {
    if (apply) {
      const pid = mongoId(docs.pricing);
      const existing = pid ? await MongoImport.findRef(client, tenantId, "pricings", pid) : null;
      if (!existing) {
        await persistPricing(client, tenantId, {
          restaurantInfo: docs.pricing.restaurantInfo,
          menuPricing: docs.pricing.menuPricing,
          phoneLineEnabled: docs.pricing.phoneLineEnabled !== false,
          legacyPayload: serialize(docs.pricing),
        });
        if (pid) await MongoImport.saveRef(client, tenantId, "pricings", pid, tenantId);
      }
    }
    report.imported.pricing = 1;
  }

  const phoneToClient = new Map();
  for (const doc of docs.clients) {
    if (!doc.telephone) {
      pushReject(report, "clients", doc, "téléphone manquant");
      if (apply) {
        await MongoImport.reject(client, tenantId, {
          collection: "clients",
          mongoId: mongoId(doc),
          reason: "téléphone manquant",
          payload: serialize(doc),
        });
      }
      continue;
    }
    const name = [doc.prenom, doc.nom].filter((part) => part && part !== "-").join(" ").trim();
    if (apply) {
      const created = await Client.upsertByPhone(client, tenantId, {
        phone: String(doc.telephone),
        name: name || doc.nom || null,
        firstName: doc.prenom,
        lastName: doc.nom,
        email: doc.email,
        address: doc.adresse,
        company: doc.entrepriseName,
        clientType: doc.type || "client",
        legacyPayload: serialize(doc),
      });
      await MongoImport.saveRef(client, tenantId, "clients", mongoId(doc), created.id);
      phoneToClient.set(String(doc.telephone), created.id);
      report.samples.push({ collection: "clients", mongoId: mongoId(doc), pgId: created.id });
    } else {
      phoneToClient.set(String(doc.telephone), `dry-${mongoId(doc)}`);
    }
    report.imported.clients = (report.imported.clients || 0) + 1;
  }

  for (const doc of docs.orders) {
    const lines = Array.isArray(doc.commandes) ? doc.commandes : [];
    report.totals.mongoOrderLines += lines.length;
    const items = commandesToItems(lines);
    const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    report.totals.mongoOrderSumCents += totalCents;
    const ymd = toYmd(doc.date);
    if (!ymd || !doc.heure) {
      pushReject(report, "orders", doc, "date ou heure manquante");
      if (apply) {
        await MongoImport.reject(client, tenantId, {
          collection: "orders",
          mongoId: mongoId(doc),
          reason: "date ou heure manquante",
          payload: serialize(doc),
        });
      }
      continue;
    }
    if (apply) {
      const existing = await MongoImport.findRef(client, tenantId, "orders", mongoId(doc));
      if (existing) {
        report.imported.orders = (report.imported.orders || 0) + 1;
        report.totals.pgOrderLines += items.length;
        report.totals.pgOrderSumCents += totalCents;
        continue;
      }
      const created = await Order.create(client, tenantId, {
        clientId: doc.telephone ? phoneToClient.get(String(doc.telephone)) || null : null,
        status: mapOrderStatusToPg(doc.statut),
        source: sourceFromCreatedBy(doc.createdBy),
        totalCents,
        pickupAt: zonedTimeToUtc(ymd, String(doc.heure).slice(0, 5), timeZone),
        notes: doc.description || null,
        guestName: doc.nom || null,
        guestPhone: doc.telephone || null,
        legacyStatus: doc.statut || "confirme",
        createdBy: doc.createdBy || "manual",
        reminderEmailSent: Boolean(doc.rappel_envoye?.email),
        reminderSmsSent: Boolean(doc.rappel_envoye?.sms),
        relatedCall: doc.related_call ? String(doc.related_call) : null,
        items,
        legacyPayload: serialize(doc),
      });
      await MongoImport.saveRef(client, tenantId, "orders", mongoId(doc), created.id);
      report.samples.push({ collection: "orders", mongoId: mongoId(doc), pgId: created.id });
      report.totals.pgOrderLines += created.items.length;
      report.totals.pgOrderSumCents += created.totalCents;
    } else {
      report.totals.pgOrderLines += items.length;
      report.totals.pgOrderSumCents += totalCents;
    }
    report.imported.orders = (report.imported.orders || 0) + 1;
  }

  for (const doc of docs.reservations) {
    const ymd = toYmd(doc.date);
    if (!ymd || !doc.heure) {
      pushReject(report, "reservations", doc, "date ou heure manquante");
      if (apply) {
        await MongoImport.reject(client, tenantId, {
          collection: "reservations",
          mongoId: mongoId(doc),
          reason: "date ou heure manquante",
          payload: serialize(doc),
        });
      }
      continue;
    }
    if (apply) {
      const existing = await MongoImport.findRef(client, tenantId, "reservations", mongoId(doc));
      if (existing) {
        report.imported.reservations = (report.imported.reservations || 0) + 1;
        continue;
      }
      const created = await Reservation.create(client, tenantId, {
        clientId: doc.telephone ? phoneToClient.get(String(doc.telephone)) || null : null,
        partySize: doc.nombrePersonnes || 1,
        reservedAt: zonedTimeToUtc(ymd, String(doc.heure).slice(0, 5), timeZone),
        status: mapReservationStatusToPg(doc.statut),
        source: sourceFromCreatedBy(doc.createdBy),
        notes: doc.description || null,
        guestName: doc.nom || null,
        guestPhone: doc.telephone || null,
        description: doc.description || "",
        internalNotes: doc.notes_internes || "",
        legacyStatus: doc.statut || "confirme",
        createdBy: doc.createdBy || "manual",
        reminderEmailSent: Boolean(doc.rappel_envoye?.email),
        reminderSmsSent: Boolean(doc.rappel_envoye?.sms),
        relatedCall: doc.related_call ? String(doc.related_call) : null,
        legacyPayload: serialize(doc),
      });
      await MongoImport.saveRef(client, tenantId, "reservations", mongoId(doc), created.id);
      report.samples.push({ collection: "reservations", mongoId: mongoId(doc), pgId: created.id });
    }
    report.imported.reservations = (report.imported.reservations || 0) + 1;
  }

  for (const doc of docs.quotas) {
    if (apply) {
      const existing = await MongoImport.findRef(client, tenantId, "clientquotas", mongoId(doc));
      if (existing) {
        report.imported.quotas = (report.imported.quotas || 0) + 1;
        continue;
      }
      const inserted = await client.query(
        `INSERT INTO call_quotas (
            tenant_id, period_start, period_end, minutes_included, seconds_used,
            client_ref, subscription_key, legacy_payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         RETURNING id`,
        [
          tenantId,
          doc.periodeDebut || new Date(),
          doc.periodeFin || new Date(Date.now() + 30 * 24 * 3600 * 1000),
          Number(doc.quotaMax) || 0,
          Math.round((Number(doc.minutesUtilisees) || 0) * 60),
          doc.clientId || null,
          doc.abonnement || null,
          JSON.stringify(serialize(doc)),
        ]
      );
      await MongoImport.saveRef(client, tenantId, "clientquotas", mongoId(doc), inserted.rows[0].id);
    }
    report.imported.quotas = (report.imported.quotas || 0) + 1;
  }

  for (const doc of docs.calls) {
    if (!doc.callSid) {
      pushReject(report, "callmonitors", doc, "callSid manquant");
      if (apply) {
        await MongoImport.reject(client, tenantId, {
          collection: "callmonitors",
          mongoId: mongoId(doc),
          reason: "callSid manquant",
          payload: serialize(doc),
        });
      }
      continue;
    }
    if (apply) {
      const existing = await MongoImport.findRef(client, tenantId, "callmonitors", mongoId(doc));
      if (existing) {
        report.imported.calls = (report.imported.calls || 0) + 1;
        continue;
      }
      const inserted = await client.query(
        `INSERT INTO call_sessions (
            tenant_id, call_sid, from_number, status, started_at, ended_at,
            duration_seconds, client_ref, legacy_payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         ON CONFLICT (tenant_id, call_sid) DO UPDATE SET
            ended_at = COALESCE(EXCLUDED.ended_at, call_sessions.ended_at)
         RETURNING id`,
        [
          tenantId,
          doc.callSid,
          doc.callerNumber || null,
          doc.endedAt ? "completed" : "in_progress",
          doc.startedAt || new Date(),
          doc.endedAt || null,
          doc.durationSeconds ?? null,
          doc.clientId || null,
          JSON.stringify(serialize(doc)),
        ]
      );
      await MongoImport.saveRef(client, tenantId, "callmonitors", mongoId(doc), inserted.rows[0].id);
    }
    report.imported.calls = (report.imported.calls || 0) + 1;
  }

  for (const doc of docs.failedExtractions) {
    if (apply) {
      const existing = await MongoImport.findRef(client, tenantId, "failedextractions", mongoId(doc));
      if (existing) {
        report.imported.failedExtractions = (report.imported.failedExtractions || 0) + 1;
        continue;
      }
      const inserted = await client.query(
        `INSERT INTO failed_extractions (
            tenant_id, call_sid, stream_sid, transcript, error_message, status,
            attempts, error_stack, notes, treated_at, legacy_payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
         RETURNING id`,
        [
          tenantId,
          doc.callSid || null,
          doc.streamSid || null,
          doc.transcription || null,
          doc.error?.message || null,
          doc.statut || "extraction_echouee",
          doc.tentatives_extraction || 0,
          doc.error?.stack || null,
          doc.notes || null,
          doc.traiteAt || null,
          JSON.stringify(serialize(doc)),
        ]
      );
      await MongoImport.saveRef(
        client,
        tenantId,
        "failedextractions",
        mongoId(doc),
        inserted.rows[0].id
      );
    }
    report.imported.failedExtractions = (report.imported.failedExtractions || 0) + 1;
  }

  if (apply) {
    report.pg = {
      clients: await MongoImport.countByCollection(client, tenantId, "clients"),
      orders: await MongoImport.countByCollection(client, tenantId, "orders"),
      orderItems: await MongoImport.countByCollection(client, tenantId, "order_items"),
      reservations: await MongoImport.countByCollection(client, tenantId, "reservations"),
      menuItems: await MongoImport.countByCollection(client, tenantId, "menu_items"),
      rejections: await MongoImport.countByCollection(client, tenantId, "migration_rejections"),
    };
    if (report.totals.mongoOrderLines !== report.totals.pgOrderLines) {
      report.ok = false;
    }
    if (report.totals.mongoOrderSumCents !== report.totals.pgOrderSumCents) {
      report.ok = false;
    }
  }

  return report;
}

const COLLECTION_ALIASES = {
  pricing: ["pricings", "pricing"],
  clients: ["clients", "client"],
  orders: ["orders", "order"],
  reservations: ["reservations", "reservation"],
  quotas: ["clientquotas", "clientquota"],
  calls: ["callmonitors", "callmonitor"],
  failedExtractions: ["failedextractions", "failedextraction"],
};

async function firstExistingCollection(db, names) {
  const existing = new Set((await db.listCollections().toArray()).map((item) => item.name));
  return names.find((name) => existing.has(name)) || names[0];
}

function instanceFilter(instanceId) {
  if (instanceId === "inst_default") {
    return {
      $or: [
        { instanceId },
        { instanceId: { $exists: false } },
        { instanceId: null },
        { instanceId: "" },
      ],
    };
  }
  return { instanceId };
}

export async function loadMongoDocuments(db, instanceId) {
  const names = {
    pricing: await firstExistingCollection(db, COLLECTION_ALIASES.pricing),
    clients: await firstExistingCollection(db, COLLECTION_ALIASES.clients),
    orders: await firstExistingCollection(db, COLLECTION_ALIASES.orders),
    reservations: await firstExistingCollection(db, COLLECTION_ALIASES.reservations),
    quotas: await firstExistingCollection(db, COLLECTION_ALIASES.quotas),
    calls: await firstExistingCollection(db, COLLECTION_ALIASES.calls),
    failedExtractions: await firstExistingCollection(db, COLLECTION_ALIASES.failedExtractions),
  };
  const filter = instanceFilter(instanceId);
  const [
    pricing,
    clients,
    orders,
    reservations,
    quotas,
    calls,
    failedExtractions,
    sourceCollections,
  ] = await Promise.all([
    db.collection(names.pricing).findOne(filter),
    db.collection(names.clients).find(filter).toArray(),
    db.collection(names.orders).find(filter).toArray(),
    db.collection(names.reservations).find(filter).toArray(),
    db.collection(names.quotas).find(filter).toArray(),
    db.collection(names.calls).find(filter).toArray(),
    db.collection(names.failedExtractions).find(filter).toArray(),
    db.listCollections().toArray(),
  ]);
  return {
    instanceId,
    pricing,
    clients,
    orders,
    reservations,
    quotas,
    calls,
    failedExtractions,
    source: {
      database: db.databaseName,
      collections: sourceCollections.map((item) => item.name).sort(),
    },
  };
}

export function hasBlockingDelta(reports) {
  return reports.some((report) => !report.ok || report.rejected.length > 0);
}
