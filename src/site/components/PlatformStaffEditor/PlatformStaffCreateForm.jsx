import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./PlatformStaffEditor.scss";

const PlatformStaffCreateForm = ({ onSubmit, busy, error, success }) => {
  const baseId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ops");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    const nextName = name.trim();
    const nextEmail = email.trim();
    if (!nextEmail) {
      setLocalError("L'e-mail est obligatoire.");
      return;
    }
    if (password.trim().length < 8) {
      setLocalError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    try {
      await onSubmit({
        name: nextName,
        email: nextEmail,
        password,
        role,
      });
    } catch {
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("ops");
    setShowPassword(false);
  };

  const visibleError = localError || error;

  return (
    <form className="pse-create" onSubmit={handleSubmit} noValidate>
      <div className="pse-head">
        <span className="pse-badge">Équipe</span>
        <h2>Créer un admin back-office</h2>
        <p>
          Attribuez un rôle : exploitation, support, facturation ou lecture. Seul
          le propriétaire gère ces comptes.
        </p>
      </div>

      <div className="pse-grid">
        <label className="pse-field" htmlFor={`${baseId}-name`}>
          <span className="pse-label">Nom</span>
          <input
            id={`${baseId}-name`}
            type="text"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            disabled={busy}
            placeholder="Nom affiché dans l'équipe"
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            disabled={busy}
            placeholder="admin@restaurant.fr"
          />
        </label>

        <div className="pse-field pse-field-wide">
          <label className="pse-label" htmlFor={`${baseId}-password`}>
            Mot de passe <span className="pse-required" aria-hidden="true">*</span>
          </label>
          <div className="pse-password">
            <input
              id={`${baseId}-password`}
              type={showPassword ? "text" : "password"}
              required
              aria-required="true"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={busy}
              aria-describedby={`${baseId}-password-hint`}
            />
            <button
              type="button"
              className="pse-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span id={`${baseId}-password-hint`} className="pse-hint">
            8 caractères minimum. Communiquez-le une seule fois à la personne.
          </span>
        </div>
        <label className="pse-field" htmlFor={`${baseId}-role`}>
          <span className="pse-label">Rôle back-office</span>
          <select
            id={`${baseId}-role`}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={busy}
          >
            <option value="ops">Exploitation</option>
            <option value="support">Support</option>
            <option value="billing">Facturation</option>
            <option value="readonly">Lecture</option>
          </select>
        </label>
      </div>

      {visibleError ? (
        <p className="pse-error" role="alert">
          {visibleError}
        </p>
      ) : null}
      {success && !visibleError ? (
        <p className="pse-status" role="status">
          {success}
        </p>
      ) : null}

      <div className="pse-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Création..." : "Créer le compte"}
        </button>
      </div>
    </form>
  );
};

export default PlatformStaffCreateForm;
