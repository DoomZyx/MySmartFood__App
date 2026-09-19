import React, { useEffect, useMemo, useState } from "react";
import { describeBilling, formatOpsDate, STATUS_LABELS } from "../../utils/platformOpsLanes";
import { UserAccessCard } from "../PlatformTenantEditor/PlatformTenantEditor";
import "../PlatformTenantEditor/PlatformTenantEditor.scss";
import "./PlatformRestaurantSupport.scss";

const TABS = [
  { id: "dossier", label: "Dossier" },
  { id: "users", label: "Équipe" },
  { id: "menu", label: "Carte" },
  { id: "hours", label: "Horaires" },
  { id: "calls", label: "Appels" },
];

const DAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const DAY_LABELS = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

const CALL_STATUS = {
  in_progress: "En cours",
  completed: "Terminé",
  failed: "Échec",
  busy: "Occupé",
  no_answer: "Sans réponse",
};

const EMPTY_SLOT = { ouverture: "12:00", fermeture: "14:00" };
const EMPTY_EVENING = { ouverture: "19:00", fermeture: "22:00" };

function emptyDay() {
  return {
    ouvert: false,
    midi: { ...EMPTY_SLOT },
    soir: { ...EMPTY_EVENING },
  };
}

function mergeHours(hours) {
  const next = {};
  DAYS.forEach((day) => {
    const current = hours?.[day] || {};
    next[day] = {
      ...emptyDay(),
      ...current,
      midi: { ...EMPTY_SLOT, ...(current.midi || {}) },
      soir: { ...EMPTY_EVENING, ...(current.soir || {}) },
    };
  });
  return next;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "—";
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  if (!minutes) return `${rest} s`;
  return `${minutes} min ${rest} s`;
}

function formatEur(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);
}

function formatUsd(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function formatMinutes(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function productCount(menus) {
  return Object.values(menus || {}).reduce(
    (total, category) => total + (category.produits || []).length,
    0
  );
}

function openDaysCount(hours) {
  return DAYS.filter((day) => hours?.[day]?.ouvert).length;
}

function MenuItemRow({ item, onSave, busy }) {
  const [name, setName] = useState(item.nom || "");
  const [prixBase, setPrixBase] = useState(
    item.prixBase != null ? String(item.prixBase) : "0"
  );
  const [disponible, setDisponible] = useState(item.disponible !== false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(item.nom || "");
    setPrixBase(item.prixBase != null ? String(item.prixBase) : "0");
    setDisponible(item.disponible !== false);
  }, [item._id, item.nom, item.prixBase, item.disponible]);

  useEffect(() => {
    setSaved(false);
    setError(null);
  }, [item._id]);

  const dirty =
    name.trim() !== String(item.nom || "").trim() ||
    Number(prixBase) !== Number(item.prixBase || 0) ||
    disponible !== (item.disponible !== false);

  const handleSave = async () => {
    setSaved(false);
    try {
      await onSave(item._id, {
        name: name.trim(),
        prixBase: Number(prixBase),
        disponible,
      });
      setError(null);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err.message);
    }
  };

  return (
    <article className="prs-item">
      <div className="prs-item-main">
        <input
          type="text"
          maxLength={200}
          value={name}
          aria-label="Nom du plat"
          onChange={(event) => {
            setSaved(false);
            setName(event.target.value);
          }}
          autoComplete="off"
        />
        {item.description ? <p>{item.description}</p> : null}
      </div>
      <label className="prs-item-price">
        <span>Prix</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={prixBase}
          onChange={(event) => {
            setSaved(false);
            setPrixBase(event.target.value);
          }}
        />
      </label>
      <label className="prs-toggle">
        <input
          type="checkbox"
          checked={disponible}
          onChange={(event) => {
            setSaved(false);
            setDisponible(event.target.checked);
          }}
        />
        <span>{disponible ? "En carte" : "Masqué"}</span>
      </label>
      <div className="prs-item-actions">
        {onSave ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !dirty}
          onClick={handleSave}
        >
          {busy ? "..." : "Sauver"}
        </button>
        ) : null}
        {saved && !dirty ? <em>OK</em> : null}
        {error ? (
          <p className="platform-admin-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function HoursPanel({ hours, onSave, busy }) {
  const [draft, setDraft] = useState(() => mergeHours(hours));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const initial = useMemo(() => mergeHours(hours), [hours]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    setDraft(mergeHours(hours));
  }, [hours]);

  const setDay = (day, patch) => {
    setSaved(false);
    setError(null);
    setDraft((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }));
  };

  const setSlot = (day, slot, field, value) => {
    setSaved(false);
    setError(null);
    setDraft((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [slot]: { ...current[day][slot], [field]: value },
      },
    }));
  };

  const copyMonday = () => {
    const monday = draft.lundi || emptyDay();
    setSaved(false);
    setDraft((current) => {
      const next = { ...current };
      DAYS.forEach((day) => {
        if (day === "lundi") return;
        next[day] = {
          ouvert: monday.ouvert,
          midi: { ...monday.midi },
          soir: { ...monday.soir },
        };
      });
      return next;
    });
  };

  return (
    <form
      className="prs-hours"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await onSave(draft);
          setError(null);
          setSaved(true);
        } catch (err) {
          setSaved(false);
          setError(err.message);
        }
      }}
    >
      <p className="prs-lead">
        {openDaysCount(draft)} jour{openDaysCount(draft) > 1 ? "s" : ""} d&apos;ouverture.
        Un seul enregistrement pour toute la semaine.
      </p>
      <div className="prs-hours-table">
        <div className="prs-hours-row is-head">
          <span>Jour</span>
          <span>Ouvert</span>
          <span>Midi</span>
          <span>Soir</span>
        </div>
        {DAYS.map((day) => {
          const row = draft[day] || emptyDay();
          return (
            <div
              key={day}
              className={row.ouvert ? "prs-hours-row" : "prs-hours-row is-closed"}
            >
              <strong>{DAY_LABELS[day]}</strong>
              <label className="prs-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(row.ouvert)}
                  onChange={(event) => setDay(day, { ouvert: event.target.checked })}
                />
                <span className="prs-sr">{DAY_LABELS[day]} ouvert</span>
              </label>
              <div className="prs-times">
                <input
                  type="time"
                  value={row.midi?.ouverture || ""}
                  disabled={!row.ouvert}
                  aria-label={`${DAY_LABELS[day]} midi ouverture`}
                  onChange={(event) =>
                    setSlot(day, "midi", "ouverture", event.target.value)
                  }
                />
                <span>à</span>
                <input
                  type="time"
                  value={row.midi?.fermeture || ""}
                  disabled={!row.ouvert}
                  aria-label={`${DAY_LABELS[day]} midi fermeture`}
                  onChange={(event) =>
                    setSlot(day, "midi", "fermeture", event.target.value)
                  }
                />
              </div>
              <div className="prs-times">
                <input
                  type="time"
                  value={row.soir?.ouverture || ""}
                  disabled={!row.ouvert}
                  aria-label={`${DAY_LABELS[day]} soir ouverture`}
                  onChange={(event) =>
                    setSlot(day, "soir", "ouverture", event.target.value)
                  }
                />
                <span>à</span>
                <input
                  type="time"
                  value={row.soir?.fermeture || ""}
                  disabled={!row.ouvert}
                  aria-label={`${DAY_LABELS[day]} soir fermeture`}
                  onChange={(event) =>
                    setSlot(day, "soir", "fermeture", event.target.value)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
      <footer className="prs-actions">
        {onSave ? (
          <>
        <button type="button" className="btn btn-secondary" onClick={copyMonday}>
          Reprendre lundi sur la semaine
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? "Enregistrement..." : "Enregistrer les horaires"}
        </button>
          </>
        ) : null}
        {saved && !dirty ? <span className="prs-saved">Horaires enregistrés.</span> : null}
        {error ? (
          <p className="platform-admin-error" role="alert">
            {error}
          </p>
        ) : null}
      </footer>
    </form>
  );
}

const PlatformRestaurantSupport = ({
  tenant,
  tenantId,
  children,
  users,
  usersLoading,
  onSaveUser,
  onAddUser,
  onRemoveUser,
  userBusyId,
  userErrors,
  ops,
  opsLoading,
  opsError,
  onSaveHours,
  onSaveMenuItem,
  busyId,
}) => {
  const [tab, setTab] = useState("dossier");
  const [menuQuery, setMenuQuery] = useState("");
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [inviteError, setInviteError] = useState(null);
  useEffect(() => {
    setTab("dossier");
    setMenuQuery("");
    setInvite({ name: "", email: "", password: "", role: "member" });
    setInviteError(null);
  }, [tenantId]);

  const menus = ops?.menus || {};
  const categories = Object.entries(menus);
  const calls = ops?.calls || [];
  const needle = menuQuery.trim().toLowerCase();
  const filteredCategories = categories
    .map(([slug, category]) => ({
      slug,
      nom: category.nom || slug,
      produits: (category.produits || []).filter((item) => {
        if (!needle) return true;
        const haystack = `${item.nom || ""} ${item.description || ""}`.toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((category) => !needle || category.produits.length > 0);

  const counts = {
    users: users?.length || 0,
    menu: productCount(menus),
    hours: openDaysCount(ops?.hours),
    calls: calls.length,
  };

  const usage = ops?.usage;
  const periodUsage = usage?.period;
  const totalUsage = usage?.total;
  const status = STATUS_LABELS[tenant?.status] || tenant?.status || "—";
  const meta = [
    tenant?.restaurantPhone,
    tenant?.phoneNumber ? `Ligne ${tenant.phoneNumber}` : null,
    tenant?.planName || tenant?.planSlug,
    tenant ? describeBilling(tenant).label : null,
    periodUsage
      ? `Twilio ce mois : ${formatMinutes(periodUsage.billedMinutes)} min · ${formatEur(periodUsage.costEur)}`
      : null,
  ].filter(Boolean);

  const selectTab = (id) => setTab(id);
  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((entry) => entry.id === tab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(TABS[(index + 1) % TABS.length].id);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(TABS[(index - 1 + TABS.length) % TABS.length].id);
    }
  };

  return (
    <section className="prs">
      <header className="prs-head">
        <div>
          <h2>{tenant?.businessName || tenant?.name || "Restaurant"}</h2>
          {meta.length ? <p>{meta.join(" · ")}</p> : null}
        </div>
        <span className="platform-admin-status">{status}</span>
      </header>

      <div
        className="prs-tabs"
        role="tablist"
        aria-label="Fiche restaurant"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((entry) => {
          const count = counts[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`prs-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`prs-panel-${entry.id}`}
              className={tab === entry.id ? "is-active" : ""}
              onClick={() => selectTab(entry.id)}
            >
              {entry.label}
              {count > 0 ? <strong>{count}</strong> : null}
            </button>
          );
        })}
      </div>

      <div
        className="prs-panel"
        role="tabpanel"
        id={`prs-panel-${tab}`}
        aria-labelledby={`prs-tab-${tab}`}
      >
        {tab === "dossier" ? children : null}

        {tab === "users" ? (
          <>
            <p className="prs-lead">
              Comptes qui accèdent à ce restaurant. Corrigez un nom, un e-mail ou un
              mot de passe sans demander au client.
            </p>
            {usersLoading && !users?.length ? (
              <p className="prs-empty">Chargement de l&apos;équipe...</p>
            ) : null}
            {tenant?.status !== "closed" && onAddUser ? (
              <form
                className="platform-admin-login"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setInviteError(null);
                  try {
                    await onAddUser(invite);
                    setInvite({ name: "", email: "", password: "", role: "member" });
                  } catch (err) {
                    setInviteError(err.message);
                  }
                }}
              >
                <p className="prs-lead">Ajouter un membre (admin ou membre).</p>
                <label>
                  Nom
                  <input
                    type="text"
                    value={invite.name}
                    onChange={(event) =>
                      setInvite((current) => ({ ...current, name: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    type="email"
                    required
                    value={invite.email}
                    onChange={(event) =>
                      setInvite((current) => ({ ...current, email: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </label>
                <label>
                  Mot de passe (si le compte n&apos;existe pas)
                  <input
                    type="password"
                    minLength={8}
                    value={invite.password}
                    onChange={(event) =>
                      setInvite((current) => ({ ...current, password: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Rôle
                  <select
                    value={invite.role}
                    onChange={(event) =>
                      setInvite((current) => ({ ...current, role: event.target.value }))
                    }
                  >
                    <option value="member">Membre</option>
                    <option value="admin">Admin restaurant</option>
                  </select>
                </label>
                {inviteError ? (
                  <p className="platform-admin-error" role="alert">
                    {inviteError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={userBusyId === "add-member"}
                >
                  {userBusyId === "add-member" ? "Ajout..." : "Ajouter"}
                </button>
              </form>
            ) : null}
            {users?.length
              ? users.map((user) => (
                  <UserAccessCard
                    key={user.id}
                    user={user}
                    onSave={onSaveUser}
                    busy={userBusyId === user.id}
                    error={userErrors?.[user.id]}
                    onChangeRole={
                      tenant?.status === "closed" || !onSaveUser
                        ? undefined
                        : (userId, role) => onSaveUser(userId, { role })
                    }
                    onRemove={
                      tenant?.status === "closed" || !onRemoveUser
                        ? undefined
                        : onRemoveUser
                    }
                  />
                ))
              : !usersLoading
                ? (
                    <p className="prs-empty">Aucun compte lié à ce restaurant.</p>
                  )
                : null}
          </>
        ) : null}

        {tab === "menu" ? (
          <>
            <div className="prs-toolbar">
              <p className="prs-lead">
                {counts.menu
                  ? `${counts.menu} plat${counts.menu > 1 ? "s" : ""} en base.`
                  : "Carte encore vide."}{" "}
                Modifiez nom, prix ou visibilité, puis sauvez la ligne.
              </p>
              {counts.menu > 0 ? (
                <input
                  type="search"
                  value={menuQuery}
                  onChange={(event) => setMenuQuery(event.target.value)}
                  placeholder="Filtrer un plat"
                  aria-label="Filtrer la carte"
                />
              ) : null}
            </div>
            {opsLoading && !ops ? (
              <p className="prs-empty">Chargement de la carte...</p>
            ) : null}
            {opsError ? (
              <p className="platform-admin-error" role="alert">
                {opsError}
              </p>
            ) : null}
            {!opsLoading && !categories.length ? (
              <p className="prs-empty">Aucune catégorie ni plat pour ce restaurant.</p>
            ) : null}
            {needle && !filteredCategories.length ? (
              <p className="prs-empty">Aucun plat ne correspond à « {menuQuery} ».</p>
            ) : null}
            {filteredCategories.map((category) => (
              <section key={category.slug} className="prs-category">
                <header>
                  <h3>{category.nom}</h3>
                  <span>{category.produits.length}</span>
                </header>
                {category.produits.length === 0 ? (
                  <p className="prs-empty">Aucun plat dans cette catégorie.</p>
                ) : (
                  category.produits.map((item) => (
                    <MenuItemRow
                      key={item._id}
                      item={item}
                      onSave={onSaveMenuItem}
                      busy={busyId === item._id}
                    />
                  ))
                )}
              </section>
            ))}
          </>
        ) : null}

        {tab === "hours" ? (
          <>
            {opsLoading && !ops ? (
              <p className="prs-empty">Chargement des horaires...</p>
            ) : null}
            {opsError ? (
              <p className="platform-admin-error" role="alert">
                {opsError}
              </p>
            ) : null}
            {ops ? (
              <HoursPanel
                key={tenantId}
                hours={ops.hours}
                onSave={onSaveHours}
                busy={busyId === "hours"}
              />
            ) : null}
          </>
        ) : null}

        {tab === "calls" ? (
          <>
            {periodUsage || totalUsage ? (
              <dl className="prs-usage">
                <div>
                  <dt>Ce mois</dt>
                  <dd>
                    {formatMinutes(periodUsage?.billedMinutes)} min Twilio
                    {" · "}
                    {formatEur(periodUsage?.costEur)}
                  </dd>
                </div>
                <div>
                  <dt>Depuis le début</dt>
                  <dd>
                    {formatMinutes(totalUsage?.billedMinutes)} min Twilio
                    {" · "}
                    {formatEur(totalUsage?.costEur)}
                  </dd>
                </div>
                <div className="prs-usage-wide">
                  <dt>Calcul</dt>
                  <dd>
                    Minutes arrondies à la minute par appel, × 0,008 $
                    {periodUsage
                      ? ` = ${formatUsd(periodUsage.costUsd)} ce mois`
                      : ""}
                    , converti en euro.
                  </dd>
                </div>
              </dl>
            ) : null}
            <p className="prs-lead">
              {counts.calls
                ? `${counts.calls} dernier${counts.calls > 1 ? "s" : ""} appel${counts.calls > 1 ? "s" : ""}.`
                : "Pas encore d'appel enregistré."}{" "}
              Consultation uniquement.
            </p>
            {opsLoading && !ops ? (
              <p className="prs-empty">Chargement des appels...</p>
            ) : null}
            {opsError ? (
              <p className="platform-admin-error" role="alert">
                {opsError}
              </p>
            ) : null}
            {!opsLoading && calls.length === 0 ? (
              <p className="prs-empty">Aucun appel pour ce restaurant.</p>
            ) : null}
            {calls.length ? (
              <div className="prs-calls">
                <div className="prs-calls-row is-head">
                  <span>Date</span>
                  <span>Numéro</span>
                  <span>Durée</span>
                  <span>Statut</span>
                </div>
                {calls.map((call) => (
                  <div key={call.id} className="prs-calls-row">
                    <span>{formatOpsDate(call.startedAt)}</span>
                    <span>{call.fromNumber || "Inconnu"}</span>
                    <span>{formatDuration(call.durationSeconds)}</span>
                    <span>{CALL_STATUS[call.status] || call.status || "—"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
};

export default PlatformRestaurantSupport;
