export const STATUS_LABELS = {
  pending_payment: "Paiement",
  pending_compliance: "Conformité",
  ready: "Prêt à activer",
  active: "Actif",
  suspended: "Suspendu",
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traité",
};

export const KIND_LABELS = {
  tenant: "Restaurant",
  contact: "Contact",
  demo: "Démo",
  staff: "Compte",
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

export function restaurantStage(tenant) {
  if (tenant?.status === "pending_payment") return "pending_payment";
  if (tenant?.status === "pending_compliance") {
    return tenant?.checklist?.ready ? "ready" : "pending_compliance";
  }
  if (tenant?.status === "active") return "active";
  if (tenant?.status === "suspended") return "suspended";
  return tenant?.status || "pending_compliance";
}

export function mergeRestaurants(tenants, fleet) {
  const map = new Map();
  [...(tenants || []), ...(fleet || [])].forEach((tenant) => {
    if (tenant?.id) map.set(tenant.id, tenant);
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
  };
  restaurants.forEach((tenant) => {
    const stage = restaurantStage(tenant);
    if (buckets[stage]) buckets[stage].push(tenant);
  });
  return buckets;
}

export function buildOpsGroups({
  restaurants,
  contacts,
  demos,
  staff,
  canManageStaff,
}) {
  const stages = restaurantsByStage(restaurants);
  const inboxCount =
    stages.pending_payment.length +
    stages.pending_compliance.length +
    stages.ready.length +
    contacts.length +
    demos.length;

  const groups = [
    {
      title: "Suivi",
      lanes: [{ id: "inbox", label: "À traiter", count: inboxCount }],
    },
    {
      title: "Onboarding",
      lanes: [
        { id: "create", label: "Nouveau client", count: null },
        { id: "pending_payment", label: "Paiement", count: stages.pending_payment.length },
        {
          id: "pending_compliance",
          label: "Conformité",
          count: stages.pending_compliance.length,
        },
        { id: "ready", label: "Prêt à activer", count: stages.ready.length },
        { id: "active", label: "Actifs", count: stages.active.length },
        { id: "suspended", label: "Suspendus", count: stages.suspended.length },
      ],
    },
    {
      title: "Demandes",
      lanes: [
        { id: "contacts", label: "Contacts", count: contacts.length },
        { id: "demos", label: "Démos", count: demos.length },
      ],
    },
  ];

  if (canManageStaff) {
    groups.push({
      title: "Équipe",
      lanes: [{ id: "staff", label: "Comptes", count: staff.length }],
    });
  }

  return groups;
}

export function itemsForLane(lane, { restaurants, contacts, demos, staff }) {
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
  if (stages[lane]) return stages[lane].map((row) => toOpsItem("tenant", row)).sort(sortByDate);
  return [];
}

export const EMPTY_LABELS = {
  inbox: "Aucune demande en attente.",
  create: "",
  pending_payment: "Aucun dossier en attente de paiement.",
  pending_compliance: "Aucun dossier en conformité.",
  ready: "Aucun dossier prêt à activer.",
  active: "Aucune instance active.",
  suspended: "Aucune instance suspendue.",
  contacts: "Aucun message de contact à traiter.",
  demos: "Aucune demande de démo à traiter.",
  staff: "Aucun compte back-office listé.",
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
