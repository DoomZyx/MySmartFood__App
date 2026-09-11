import { centsToEuros, eurosToCents, mapOrderStatusToFr, mapReservationStatusToFr } from "./legacyStatus.js";
import { splitInTimeZone } from "../../utils/timeZone.js";

function optionsToLegacy(options) {
  if (!options || !options.length) return {};
  const out = {};
  for (const option of options) {
    if (!out[option.groupName]) out[option.groupName] = option.optionName;
    else if (Array.isArray(out[option.groupName])) out[option.groupName].push(option.optionName);
    else out[option.groupName] = [out[option.groupName], option.optionName];
  }
  return out;
}

export function orderToLegacy(order, timeZone = "Europe/Paris") {
  const split = order.pickupAt ? splitInTimeZone(order.pickupAt, timeZone) : { date: null, heure: null };
  return {
    _id: order.id,
    instanceId: order.tenantId,
    nom: order.guestName,
    telephone: order.guestPhone,
    date: split.date,
    heure: split.heure,
    commandes: (order.items || []).map((item) => ({
      produitId: item.menuItemId,
      nom: item.label,
      categorie: item.category,
      quantite: item.quantity,
      prixUnitaire: centsToEuros(item.unitPriceCents),
      composition: item.composition || "",
      options: optionsToLegacy(item.options),
    })),
    statut: mapOrderStatusToFr(order.status, order.legacyStatus),
    createdBy: order.createdBy,
    rappel_envoye: {
      email: order.reminderEmailSent,
      sms: order.reminderSmsSent,
    },
    related_call: order.relatedCall,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    total: centsToEuros(
      order.totalCents ??
        (order.items || []).reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    ),
  };
}

export function reservationToLegacy(reservation, timeZone = "Europe/Paris") {
  const split = reservation.reservedAt
    ? splitInTimeZone(reservation.reservedAt, timeZone)
    : { date: null, heure: null };
  return {
    _id: reservation.id,
    instanceId: reservation.tenantId,
    nom: reservation.guestName,
    telephone: reservation.guestPhone,
    date: split.date,
    heure: split.heure,
    description: reservation.description || "",
    nombrePersonnes: reservation.partySize,
    notes_internes: reservation.internalNotes || "",
    statut: mapReservationStatusToFr(reservation.status, reservation.legacyStatus),
    createdBy: reservation.createdBy,
    rappel_envoye: {
      email: reservation.reminderEmailSent,
      sms: reservation.reminderSmsSent,
    },
    related_call: reservation.relatedCall,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

export function clientToLegacy(client) {
  return {
    _id: client.id,
    prenom: client.firstName || "-",
    nom: client.lastName || client.name || "-",
    telephone: client.phone,
    email: client.email,
    adresse: client.address,
    entrepriseName: client.company,
    type: client.clientType || "client",
    nomComplet: [client.firstName, client.lastName || client.name].filter(Boolean).join(" "),
  };
}

export function commandesToItems(commandes) {
  return (commandes || []).map((line) => ({
    menuItemId: line.menuItemId || line.produitId || null,
    label: line.nom || line.label,
    category: line.categorie || line.category || null,
    quantity: Number(line.quantite || line.quantity) || 1,
    unitPriceCents: line.unitPriceCents ?? eurosToCents(line.prixUnitaire),
    composition: line.composition || "",
    options: line.options || {},
    legacyPayload: line,
  }));
}

export { eurosToCents };
