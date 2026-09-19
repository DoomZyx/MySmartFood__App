export const STATUS_LABELS = {
  pending_payment: "Paiement",
  pending_compliance: "Conformité",
  ready: "Prêt à activer",
  active: "Actif",
  suspended: "Suspendu",
  rejected: "Refusé",
  closed: "Fermé",
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traité",
};

export function describeBilling(source) {
  const status = String(source?.subscriptionStatus || "");
  const hasStripe = Boolean(source?.hasStripeCustomer || source?.stripeSubscriptionId);
  const unpaid = Boolean(source?.billingUnpaid) ||
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(status);
  const canceled = Boolean(source?.billingCanceled) || status === "canceled";
  const grant = Boolean(source?.isManualGrant) ||
    (source?.onboardedBy === "platform" && !hasStripe);
  const paid = Boolean(source?.billingOk) && hasStripe;
  let label = "—";
  if (unpaid) label = "Impayé";
  else if (canceled) label = "Annulé";
  else if (paid) label = "Payé Stripe";
  else if (grant && (status === "active" || status === "trialing" || !status)) label = "Grant BO";
  else if (status) label = status;
  return { label, status, unpaid, canceled, paid, grant, hasStripe };
}

export const KIND_LABELS = {
  tenant: "Restaurant",
  contact: "Contact",
  demo: "Démo",
  staff: "Compte",
  user: "Utilisateur",
};

export function formatOpsDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function checklistProgress(tenant) {
  const items = tenant?.checklist?.items || [];
  const total = items.length;
  const done = items.filter((item) => item.ok).length;
  return { done, total, ratio: total ? done / total : 0 };
}

const REVIEWED_PROVISIONING = new Set([
  "completed",
  "bundle_approved",
  "bundle_rejected",
]);

export function isDossierAwaitingReview(tenant) {
  if (!tenant?.documentsSubmittedAt) return false;
  if (tenant.status === "suspended") return false;
  const state = String(tenant.provisioningState || "");
  if (state && REVIEWED_PROVISIONING.has(state)) return false;
  return true;
}

export function restaurantStage(tenant) {
  if (tenant?.status === "pending_payment") return "pending_payment";
  if (tenant?.status === "pending_compliance" || isDossierAwaitingReview(tenant)) {
    return tenant?.checklist?.ready ? "ready" : "pending_compliance";
  }
  if (tenant?.status === "closed") return "closed";
  if (tenant?.status === "active") return "active";
  if (tenant?.status === "suspended") {
    return tenant?.provisioningState === "bundle_rejected" ? "rejected" : "suspended";
  }
  return tenant?.status || "pending_compliance";
}

function documentCount(tenant) {
  if (Array.isArray(tenant?.documents) && tenant.documents.length) {
    return tenant.documents.length;
  }
  if (Array.isArray(tenant?.documentKinds)) return tenant.documentKinds.length;
  return 0;
}

function withPreservedDocuments(base, other) {
  if (documentCount(base) > 0 || documentCount(other) === 0) {
    return base;
  }
  return {
    ...base,
    documents: other.documents,
    documentKinds: other.documentKinds?.length
      ? other.documentKinds
      : base.documentKinds,
    documentsSubmittedAt: base.documentsSubmittedAt || other.documentsSubmittedAt,
  };
}

export function mergeTenantRecords(previous, next) {
  if (!previous) return next;
  if (!next) return previous;
  const previousOpen = previous.status && previous.status !== "closed";
  const nextClosed = next.status === "closed";
  if (previousOpen && nextClosed) {
    return withPreservedDocuments(previous, next);
  }
  return withPreservedDocuments(next, previous);
}

export function mergeRestaurants(...lists) {
  const map = new Map();
  lists.flat().forEach((tenant) => {
    if (!tenant?.id) return;
    map.set(tenant.id, mergeTenantRecords(map.get(tenant.id), tenant));
  });
  return [...map.values()];
}

function sortByDate(left, right) {
  return String(right.date || "").localeCompare(String(left.date || ""));
}

export function toOpsItem(kind, entity) {
  if (kind === "tenant") {
    const stage = restaurantStage(entity);
    return {
      id: entity.id,
      kind,
      title: entity.businessName || entity.name || "Sans nom",
      subtitle: entity.ownerEmail || "Sans e-mail",
      status: STATUS_LABELS[stage] || entity.status,
      statusKey: stage,
      date: entity.createdAt,
      progress: checklistProgress(entity),
      source: entity.onboardedBy === "platform" ? "Back-office" : "Self-service",
      raw: entity,
    };
  }
  if (kind === "contact") {
    return {
      id: entity.id,
      kind,
      title: entity.subject || "Message",
      subtitle: entity.email,
      status: STATUS_LABELS[entity.status] || entity.status,
      statusKey: entity.status,
      date: entity.createdAt,
      raw: entity,
    };
  }
  if (kind === "demo") {
    return {
      id: entity.id,
      kind,
      title: entity.company || "Démo",
      subtitle: entity.email,
      status: STATUS_LABELS[entity.status] || entity.status,
      statusKey: entity.status,
      date: entity.createdAt,
      raw: entity,
    };
  }
  if (kind === "user") {
    const tenants = entity.tenants || [];
    let status = "Sans établissement";
    if (entity.isPlatformOwner) status = "Propriétaire";
    else if (entity.isPlatformAdmin) {
      status =
        entity.platformRole === "support"
          ? "Support"
          : entity.platformRole === "billing"
            ? "Facturation"
            : entity.platformRole === "readonly"
              ? "Lecture"
              : "Exploitation";
    }
    else if (tenants[0]?.status) status = STATUS_LABELS[tenants[0].status] || tenants[0].status;
    return {
      id: entity.id,
      kind,
      title: entity.name || entity.email,
      subtitle: entity.email,
      status,
      statusKey: entity.isPlatformOwner ? "owner" : entity.isPlatformAdmin ? "admin" : tenants[0]?.status || "none",
      date: entity.lastLoginAt || entity.createdAt,
      source: tenants.map((tenant) => tenant.businessName || tenant.name).filter(Boolean).join(", ") || "Aucun restaurant",
      raw: entity,
    };
  }
  return {
    id: entity.id,
    kind: "staff",
    title: entity.name || entity.email,
    subtitle: entity.email,
    status: entity.isPlatformOwner ? "Propriétaire" : "Admin",
    statusKey: entity.isPlatformOwner ? "owner" : "admin",
    date: entity.lastLoginAt,
    raw: entity,
  };
}

export function restaurantsByStage(restaurants) {
  const buckets = {
    pending_payment: [],
    pending_compliance: [],
    ready: [],
    active: [],
    suspended: [],
    rejected: [],
    closed: [],
  };
  restaurants.forEach((tenant) => {
    const stage = restaurantStage(tenant);
    if (buckets[stage]) buckets[stage].push(tenant);
  });
  return buckets;
}

function withCount(id, label, count) {
  return { id, label, count };
}

export function buildOpsGroups({
  restaurants,
  contacts,
  demos,
  staff,
  users = [],
  usersTotal,
  canManageStaff,
  canCreateTenant = true,
}) {
  const stages = restaurantsByStage(restaurants);
  const groups = [];
  if (canCreateTenant) {
    groups.push({
      id: "action",
      title: null,
      lanes: [{ id: "create", label: "Nouveau client", count: null, variant: "primary" }],
    });
  }

  const waiting = [
    withCount("ready", "Prêt à activer", stages.ready.length),
    withCount("pending_compliance", "Dossier à compléter", stages.pending_compliance.length),
    withCount("pending_payment", "Paiement", stages.pending_payment.length),
  ].filter((lane) => lane.count > 0);

  if (waiting.length) {
    groups.push({ id: "waiting", title: "À valider", lanes: waiting });
  }

  const fleetLanes = [withCount("active", "Actifs", stages.active.length)];
  if (stages.suspended.length > 0) {
    fleetLanes.push(withCount("suspended", "Suspendus", stages.suspended.length));
  }
  if (stages.rejected.length > 0) {
    fleetLanes.push(withCount("rejected", "Refusés", stages.rejected.length));
  }
  if (stages.closed.length > 0) {
    fleetLanes.push(withCount("closed", "Fermés", stages.closed.length));
  }
  groups.push({ id: "fleet", title: "Restaurants", lanes: fleetLanes });

  const messages = [
    withCount("contacts", "Contacts", contacts.length),
    withCount("demos", "Démos", demos.length),
  ].filter((lane) => lane.count > 0);

  if (messages.length) {
    groups.push({ id: "messages", title: "Messages", lanes: messages });
  }

  groups.push({
    id: "directory",
    title: "Supervision",
    lanes: [withCount("users", "Utilisateurs", usersTotal ?? users.length)],
  });

  if (canManageStaff) {
    groups.push({
      id: "team",
      title: "Équipe",
      lanes: [withCount("staff", "Comptes", staff.length)],
    });
  }

  return groups;
}

export function firstUsefulLane(groups) {
  const waiting = groups.find((group) => group.id === "waiting");
  if (waiting?.lanes?.length) return waiting.lanes[0].id;
  const messages = groups.find((group) => group.id === "messages");
  if (messages?.lanes?.length) return messages.lanes[0].id;
  return "active";
}

export function laneIdsFromGroups(groups) {
  return groups.flatMap((group) => group.lanes.map((lane) => lane.id));
}

export function itemsForLane(lane, { restaurants, contacts, demos, staff, users }) {
  const stages = restaurantsByStage(restaurants);
  if (lane === "inbox") {
    return [
      ...stages.pending_payment.map((row) => toOpsItem("tenant", row)),
      ...stages.pending_compliance.map((row) => toOpsItem("tenant", row)),
      ...stages.ready.map((row) => toOpsItem("tenant", row)),
      ...contacts.map((row) => toOpsItem("contact", row)),
      ...demos.map((row) => toOpsItem("demo", row)),
    ].sort(sortByDate);
  }
  if (lane === "contacts") return contacts.map((row) => toOpsItem("contact", row)).sort(sortByDate);
  if (lane === "demos") return demos.map((row) => toOpsItem("demo", row)).sort(sortByDate);
  if (lane === "staff") return staff.map((row) => toOpsItem("staff", row));
  if (lane === "users") return (users || []).map((row) => toOpsItem("user", row));
  if (stages[lane]) return stages[lane].map((row) => toOpsItem("tenant", row)).sort(sortByDate);
  return [];
}

export function platformUserDeleteReason(actor, target) {
  if (!target?.id) return "Compte introuvable.";
  if (actor?.id && String(actor.id) === String(target.id)) {
    return "Vous ne pouvez pas supprimer votre propre compte.";
  }
  if (target.isPlatformOwner) {
    return "Le propriétaire de la plateforme ne peut pas être supprimé.";
  }
  if (target.isPlatformAdmin && !actor?.isPlatformOwner) {
    return "Les comptes back-office se gèrent dans Comptes.";
  }
  return null;
}

export function ownedRestaurantNames(target) {
  return (target?.tenants || [])
    .filter((tenant) => tenant.isOwner || tenant.role === "owner")
    .map((tenant) => tenant.businessName || tenant.name)
    .filter(Boolean);
}

export const EMPTY_LABELS = {
  inbox: "Aucune demande en attente.",
  create: "",
  pending_payment: "Aucun dossier en attente de paiement.",
  pending_compliance: "Aucun dossier à compléter.",
  ready: "Aucun dossier prêt à activer.",
  active: "Aucune instance active.",
  suspended: "Aucune instance suspendue.",
  rejected: "Aucun dossier refusé.",
  closed: "Aucun établissement fermé.",
  contacts: "Aucun message de contact à traiter.",
  demos: "Aucune demande de démo à traiter.",
  staff: "Aucun compte back-office listé.",
  users: "Aucun utilisateur trouvé.",
};

export function onboardingSteps(tenant) {
  const items = tenant?.checklist?.items || [];
  const byKey = Object.fromEntries(items.map((item) => [item.key, item.ok]));
  const steps = [
    {
      id: "account",
      label: "Compte",
      done: Boolean(byKey.businessName && byKey.ownerEmail),
    },
    {
      id: "file",
      label: "Dossier",
      done: Boolean(
        byKey.address &&
          byKey.restaurantPhone &&
          byKey.phoneNumberUsage &&
          byKey.documents
      ),
    },
    {
      id: "line",
      label: "Ligne vocale",
      done: Boolean(byKey.inboundNumber),
    },
    {
      id: "live",
      label: "En ligne",
      done: tenant?.status === "active",
    },
  ];
  if (tenant?.status === "active") {
    return steps.map((step) => ({ ...step, done: true }));
  }
  return steps;
}
