import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { describeBilling, formatOpsDate, STATUS_LABELS } from "../../utils/platformOpsLanes";
import "../PlatformStaffEditor/PlatformStaffEditor.scss";

function roleLabel(user) {
  if (user.isPlatformOwner) return "Propriétaire plateforme";
  if (user.isPlatformAdmin) return "Admin back-office";
  return "Utilisateur";
}

function membershipLabel(tenant) {
  if (tenant.isOwner || tenant.role === "owner") return "Propriétaire";
  if (tenant.role === "admin") return "Admin restaurant";
  return tenant.role || "Membre";
}

function restaurantAddress(tenant) {
  return [tenant.addressLine, tenant.postalCode, tenant.city].filter(Boolean).join(", ") || "—";
}

const PlatformUserEditor = ({
  user,
  draft,
  onChange,
  onSubmit,
  busy,
  error,
  canEdit,
  onUnlockDashboard,
  onOpenRestaurant,
  onChangeMembership,
  onRemoveMembership,
  onImpersonate,
  onDelete,
}) => {
  const baseId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const tenants = user.tenants || [];

  return (
    <div className="pse-editor">
      <div className="pse-head">
        <span className="pse-badge">{roleLabel(user)}</span>
        <h2>{user.name || user.email}</h2>
        <p>Toutes les informations du compte. Les champs d'identité sont modifiables.</p>
      </div>

      <section className="pse-section" aria-labelledby={`${baseId}-meta`}>
        <h3 id={`${baseId}-meta`}>Informations du compte</h3>
        <dl className="pse-meta">
          <div>
            <dt>Rôle</dt>
            <dd>{roleLabel(user)}</dd>
          </div>
          <div>
            <dt>Google</dt>
            <dd>{user.hasGoogleId ? "Compte lié" : "Non lié"}</dd>
          </div>
          <div>
            <dt>Tableau de bord</dt>
            <dd>
              {user.dashboardUnlockedAt
                ? `Ouvert le ${formatOpsDate(user.dashboardUnlockedAt)}`
                : "Fermé"}
            </dd>
          </div>
          <div>
            <dt>Dernière connexion</dt>
            <dd>{formatOpsDate(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt>Créé le</dt>
            <dd>{formatOpsDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Restaurants</dt>
            <dd>{tenants.length}</dd>
          </div>
        </dl>
      </section>

      {error ? (
        <p className="pse-error" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <form className="pse-section" onSubmit={onSubmit} aria-labelledby={`${baseId}-identity`}>
          <h3 id={`${baseId}-identity`}>Identité</h3>
          <div className="pse-grid">
            <label className="pse-field" htmlFor={`${baseId}-name`}>
              <span className="pse-label">Nom</span>
              <input
                id={`${baseId}-name`}
                type="text"
                maxLength={120}
                value={draft.name}
                onChange={(event) => onChange({ ...draft, name: event.target.value })}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <label className="pse-field" htmlFor={`${baseId}-email`}>
              <span className="pse-label">
                E-mail <span className="pse-required" aria-hidden="true">*</span>
              </span>
              <input
                id={`${baseId}-email`}
                type="email"
                required
                aria-required="true"
                value={draft.email}
                onChange={(event) => onChange({ ...draft, email: event.target.value })}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <div className="pse-field pse-field-wide">
              <label className="pse-label" htmlFor={`${baseId}-password`}>
                Nouveau mot de passe
              </label>
              <div className="pse-password">
                <input
                  id={`${baseId}-password`}
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  value={draft.password}
                  onChange={(event) =>
                    onChange({ ...draft, password: event.target.value })
                  }
                  autoComplete="off"
                  disabled={busy}
                  aria-describedby={`${baseId}-password-hint`}
                />
                <button
                  type="button"
                  className="pse-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <span id={`${baseId}-password-hint`} className="pse-hint">
                Laissez vide pour conserver le mot de passe actuel. 8 caractères minimum
                pour en définir un nouveau.
              </span>
            </div>
            <label className="pse-field pse-field-wide pse-check" htmlFor={`${baseId}-verified`}>
              <input
                id={`${baseId}-verified`}
                type="checkbox"
                checked={Boolean(draft.emailVerified)}
                onChange={(event) =>
                  onChange({ ...draft, emailVerified: event.target.checked })
                }
                disabled={busy}
              />
              E-mail vérifié
            </label>
          </div>
          <div className="pse-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Enregistrement..." : "Enregistrer"}
            </button>
            {!user.dashboardUnlockedAt ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={onUnlockDashboard}
              >
                Ouvrir le tableau de bord
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="btn btn-secondary puc-delete"
                disabled={busy}
                onClick={onDelete}
              >
                Supprimer le compte
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="pue-empty">Les comptes back-office se modifient dans Équipe.</p>
      )}

      <section className="pse-section" aria-labelledby={`${baseId}-restaurants`}>
        <h3 id={`${baseId}-restaurants`}>Restaurants</h3>
        {tenants.length === 0 ? (
          <p className="pue-empty">Aucun restaurant affecté à ce compte.</p>
        ) : (
          tenants.map((tenant) => {
            const stage = tenant.status === "closed" ? "closed" : tenant.status;
            const status = STATUS_LABELS[stage] || tenant.status || "—";
            const name = tenant.businessName || tenant.name || "Restaurant";
            const billing = describeBilling(tenant);
            const canManage =
              Boolean(onChangeMembership) &&
              tenant.role !== "owner" &&
              tenant.status !== "closed";
            return (
              <article key={tenant.id} className="pue-restaurant">
                <div className="pue-restaurant-head">
                  <h4>{name}</h4>
                  <span className="pse-badge">{status}</span>
                </div>
                <dl className="pue-restaurant-meta">
                  <div>
                    <dt>Rôle</dt>
                    <dd>{membershipLabel(tenant)}</dd>
                  </div>
                  <div>
                    <dt>Offre</dt>
                    <dd>{tenant.planName || tenant.planSlug || "—"}</dd>
                  </div>
                  <div>
                    <dt>Facturation</dt>
                    <dd>{billing.label}</dd>
                  </div>
                  <div>
                    <dt>Adresse</dt>
                    <dd>{restaurantAddress(tenant)}</dd>
                  </div>
                  <div>
                    <dt>Téléphone resto</dt>
                    <dd>{tenant.restaurantPhone || "—"}</dd>
                  </div>
                  <div>
                    <dt>E-mail resto</dt>
                    <dd>{tenant.restaurantEmail || "—"}</dd>
                  </div>
                  <div>
                    <dt>SIRET</dt>
                    <dd>{tenant.siret || "—"}</dd>
                  </div>
                  <div>
                    <dt>Ligne vocale</dt>
                    <dd>{tenant.inboundPhone || "—"}</dd>
                  </div>
                  {tenant.phone ? (
                    <div>
                      <dt>Téléphone membre</dt>
                      <dd>{tenant.phone}</dd>
                    </div>
                  ) : null}
                  {tenant.jobTitle ? (
                    <div>
                      <dt>Fonction</dt>
                      <dd>{tenant.jobTitle}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="pse-actions">
                  {onOpenRestaurant ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => onOpenRestaurant(tenant)}
                    >
                      Voir la fiche restaurant
                    </button>
                  ) : null}
                  {onImpersonate && tenant.status !== "closed" ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => onImpersonate(tenant)}
                    >
                      Ouvrir le dashboard client
                    </button>
                  ) : null}
                  {canManage ? (
                    <>
                      <label className="pse-field" htmlFor={`${baseId}-role-${tenant.id}`}>
                        <span className="pse-label">Rôle dans le restaurant</span>
                        <select
                          id={`${baseId}-role-${tenant.id}`}
                          value={tenant.role === "admin" ? "admin" : "member"}
                          disabled={busy}
                          onChange={(event) =>
                            onChangeMembership(tenant, event.target.value)
                          }
                        >
                          <option value="member">Membre</option>
                          <option value="admin">Admin restaurant</option>
                        </select>
                      </label>
                      {onRemoveMembership ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => onRemoveMembership(tenant)}
                        >
                          Retirer du restaurant
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default PlatformUserEditor;
