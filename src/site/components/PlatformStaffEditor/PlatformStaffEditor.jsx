import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatOpsDate } from "../../utils/platformOpsLanes";
import "./PlatformStaffEditor.scss";

function roleLabel(user) {
  if (user.isPlatformOwner) return "Propriétaire";
  if (user.platformRole === "support") return "Support";
  if (user.platformRole === "billing") return "Facturation";
  if (user.platformRole === "readonly") return "Lecture";
  if (user.isPlatformAdmin) return "Exploitation";
  return "Compte";
}

const PlatformStaffEditor = ({
  user,
  draft,
  onChange,
  onSubmit,
  busy,
  error,
  onRevoke,
  onDelete,
}) => {
  const baseId = useId();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="pse-editor" onSubmit={onSubmit}>
      <div className="pse-head">
        <span className="pse-badge">{roleLabel(user)}</span>
        <h2>{user.name || user.email}</h2>
        <p>Corrigez l'identité du compte et réinitialisez le mot de passe si besoin.</p>
      </div>

      <section className="pse-section" aria-labelledby={`${baseId}-meta`}>
        <h3 id={`${baseId}-meta`}>Informations du compte</h3>
        <dl className="pse-meta">
          <div>
            <dt>Rôle</dt>
            <dd>{roleLabel(user)}</dd>
          </div>
          <div>
            <dt>E-mail vérifié</dt>
            <dd>{user.emailVerified ? "Oui" : "Non"}</dd>
          </div>
          <div>
            <dt>Dernière connexion</dt>
            <dd>{formatOpsDate(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt>Créé le</dt>
            <dd>{formatOpsDate(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="pse-section" aria-labelledby={`${baseId}-identity`}>
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
          {!user.isPlatformOwner ? (
            <label className="pse-field" htmlFor={`${baseId}-role`}>
              <span className="pse-label">Rôle back-office</span>
              <select
                id={`${baseId}-role`}
                value={draft.role || user.platformRole || "ops"}
                onChange={(event) => onChange({ ...draft, role: event.target.value })}
                disabled={busy}
              >
                <option value="ops">Exploitation</option>
                <option value="support">Support</option>
                <option value="billing">Facturation</option>
                <option value="readonly">Lecture</option>
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="pse-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="pse-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Enregistrement..." : "Enregistrer"}
        </button>
        {!user.isPlatformOwner && onRevoke ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => onRevoke(user)}
          >
            Retirer l'accès
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
  );
};

export default PlatformStaffEditor;
