import React, { useMemo } from "react";
import PlatformDossierReview from "../PlatformDossierReview/PlatformDossierReview";
import {
  auditDossier,
  scrollToDossierField,
} from "../../utils/dossierModeration";
import "./PlatformTenantEditor.scss";

export const OPENAI_REALTIME_MODEL = "gpt-realtime-1.5";
export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

export const EMPTY_TENANT_DRAFT = {
  name: "",
  ownerName: "",
  email: "",
  password: "",
  countryCode: "FR",
  addressLine: "",
  postalCode: "",
  city: "",
  restaurantPhone: "",
  restaurantEmail: "",
  seatCount: "",
  cuisineType: "",
  phoneNumberUsage: "",
  siret: "",
  inboundPhone: "",
  openaiApiKey: "",
  openaiModel: OPENAI_REALTIME_MODEL,
};

export function tenantToDraft(tenant) {
  return {
    ...EMPTY_TENANT_DRAFT,
    name: tenant?.businessName || tenant?.name || "",
    ownerName: tenant?.ownerName || "",
    email: tenant?.ownerEmail || "",
    countryCode: tenant?.countryCode || "FR",
    addressLine: tenant?.addressLine || "",
    postalCode: tenant?.postalCode || "",
    city: tenant?.city || "",
    restaurantPhone: tenant?.restaurantPhone || "",
    restaurantEmail: tenant?.restaurantEmail || "",
    seatCount: tenant?.seatCount != null ? String(tenant.seatCount) : "",
    cuisineType: tenant?.cuisineType || "",
    phoneNumberUsage: tenant?.phoneNumberUsage || "",
    siret: tenant?.siret || tenant?.siren || "",
    inboundPhone: tenant?.phoneNumber || tenant?.phoneNumberSid || "",
    openaiModel: tenant?.openaiModel || OPENAI_REALTIME_MODEL,
  };
}

export function draftToPayload(draft, { requirePassword } = {}) {
  const inbound = String(draft.inboundPhone || "").trim();
  const seatCount = String(draft.seatCount || "").trim();
  const payload = {
    name: String(draft.name || "").trim(),
    ownerName: String(draft.ownerName || "").trim() || undefined,
    email: String(draft.email || "").trim(),
    countryCode: draft.countryCode || "FR",
    addressLine: String(draft.addressLine || "").trim() || undefined,
    postalCode: String(draft.postalCode || "").trim() || undefined,
    city: String(draft.city || "").trim() || undefined,
    restaurantPhone: String(draft.restaurantPhone || "").trim() || undefined,
    restaurantEmail: String(draft.restaurantEmail || "").trim() || undefined,
    cuisineType: String(draft.cuisineType || "").trim() || undefined,
    phoneNumberUsage: String(draft.phoneNumberUsage || "").trim() || undefined,
    siret: String(draft.siret || "").trim() || undefined,
    openaiModel: String(draft.openaiModel || "").trim() || OPENAI_REALTIME_MODEL,
  };
  if (requirePassword || String(draft.password || "").trim()) {
    payload.password = String(draft.password || "").trim();
  }
  if (String(draft.openaiApiKey || "").trim()) {
    payload.openaiApiKey = String(draft.openaiApiKey).trim();
  }
  if (seatCount) payload.seatCount = Number(seatCount);
  if (/^PN[a-f0-9]{32}$/i.test(inbound)) {
    payload.phoneNumberSid = inbound;
  } else if (inbound) {
    payload.phoneNumber = inbound;
  }
  return payload;
}

function Field({ label, hint, wide, fieldKey, issue, children }) {
  const status = issue?.status;
  const className = [
    "pte-field",
    wide ? "pte-field-wide" : "",
    status === "missing" ? "pte-field-missing" : "",
    status === "mismatch" ? "pte-field-mismatch" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      className={className}
      id={fieldKey ? `pte-field-${fieldKey}` : undefined}
    >
      <span className="pte-label">
        {label}
        {status === "missing" ? (
          <em className="pte-field-flag">Manquant</em>
        ) : null}
        {status === "mismatch" ? (
          <em className="pte-field-flag">Ne correspond pas</em>
        ) : null}
      </span>
      {children}
      {status === "mismatch" && issue?.reason ? (
        <span className="pte-hint pte-hint-issue">{issue.reason}</span>
      ) : null}
      {hint ? <span className="pte-hint">{hint}</span> : null}
    </label>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="pte-section">
      <h3>{title}</h3>
      {hint ? <p className="pte-section-hint">{hint}</p> : null}
      <div className="pte-grid">{children}</div>
    </section>
  );
}

const ROLE_LABELS = {
  owner: "Propriétaire",
  admin: "Admin",
  member: "Équipe",
};

function formatLogin(value) {
  if (!value) return "Jamais connecté";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function UserAccessCard({ user, onSave, busy, error, nameIssue, emailIssue }) {
  const [name, setName] = React.useState(user.name || "");
  const [email, setEmail] = React.useState(user.email || "");
  const [password, setPassword] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setName(user.name || "");
    setEmail(user.email || "");
    setPassword("");
  }, [user.id, user.name, user.email]);

  const handleSave = async () => {
    setSaved(false);
    try {
      const payload = { name, email };
      if (String(password).trim()) payload.password = String(password).trim();
      await onSave(user.id, payload);
      setPassword("");
      setSaved(true);
    } catch {
      // erreur affichée par le parent
    }
  };

  return (
    <div className="pte-user">
      <div className="pte-user-head">
        <span className="pte-chip">{ROLE_LABELS[user.role] || user.role}</span>
        <span className="pte-hint">{formatLogin(user.lastLoginAt)}</span>
      </div>
      <Field label="Nom" fieldKey={nameIssue ? "ownerName" : undefined} issue={nameIssue}>
        <input
          type="text"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label="E-mail" fieldKey={emailIssue ? "email" : undefined} issue={emailIssue}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label="Nouveau mot de passe" hint="Laisser vide pour ne pas changer.">
        <input
          type="text"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <div className="pte-user-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={handleSave}
        >
          {busy ? "Enregistrement..." : "Enregistrer l'accès"}
        </button>
        {saved && !error ? <span className="pte-hint">Accès enregistré.</span> : null}
        {error ? (
          <p className="platform-admin-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ModerationPanel({ audit }) {
  if (!audit) return null;
  const { missing, mismatch, okCount } = audit;
  const blocked = missing.length + mismatch.length;
  return (
    <div className="pte-moderation" aria-label="Contrôle du dossier">
      <p className="pte-moderation-summary">
        {blocked === 0
          ? "Tous les champs attendus sont renseignés."
          : `${missing.length} manquant${missing.length > 1 ? "s" : ""} · ${mismatch.length} ne correspond${mismatch.length > 1 ? "ent" : ""} pas`}
        {` · ${okCount} conforme${okCount > 1 ? "s" : ""}`}
      </p>
      {missing.length > 0 ? (
        <div className="pte-moderation-group pte-moderation-missing">
          <h3>Manquants</h3>
          <ul>
            {missing.map((item) => (
              <li key={item.key}>
                <button type="button" onClick={() => scrollToDossierField(item.key)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {mismatch.length > 0 ? (
        <div className="pte-moderation-group pte-moderation-mismatch">
          <h3>Ne correspondent pas</h3>
          <ul>
            {mismatch.map((item) => (
              <li key={item.key}>
                <button type="button" onClick={() => scrollToDossierField(item.key)}>
                  {item.label}
                  {item.reason ? ` — ${item.reason}` : ""}
                  {item.value ? ` (${item.value})` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const PlatformTenantEditor = ({
  mode,
  draft,
  onChange,
  onSubmit,
  busy,
  error,
  tenant,
  users,
  usersLoading,
  onSaveUser,
  userBusyId,
  userErrors,
  onUploadIdentity,
  uploadBusyId,
  children,
}) => {
  const setField = (field) => (event) => {
    onChange({ ...draft, [field]: event.target.value });
  };
  const audit = useMemo(
    () => (mode === "edit" ? auditDossier({ tenant, draft, users }) : null),
    [mode, tenant, draft, users]
  );
  const issueOf = (key) => audit?.byKey?.[key];

  return (
    <form className="pte" onSubmit={onSubmit}>
      <header className="pte-head">
        <div>
          <h2>{mode === "create" ? "Nouveau client" : tenant?.businessName || tenant?.name}</h2>
          {mode === "create" ? (
            <p>
              Compte, établissement et ligne vocale. La clé OpenAI est un fallback
              optionnel si le GPU est down.
            </p>
          ) : (
            <p>
              {tenant?.ownerEmail || "Sans e-mail"}
              {tenant?.activatedAt
                ? ` · Activé ${new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(tenant.activatedAt))}`
                : ""}
            </p>
          )}
        </div>
        {mode === "edit" && (
          <span className="platform-admin-status">{tenant?.status}</span>
        )}
      </header>

      {mode === "edit" && <ModerationPanel audit={audit} />}

      {mode === "edit" && tenant && (
        <PlatformDossierReview
          tenant={tenant}
          audit={audit}
          onUploadIdentity={onUploadIdentity}
          uploadBusyId={uploadBusyId}
        />
      )}

      <Section
        title={mode === "edit" ? "Accès dashboard" : "Compte"}
        hint={
          mode === "edit"
            ? "Nom, e-mail et mot de passe du client. Vous pouvez les changer ici sans lui demander."
            : null
        }
      >
        {mode === "edit" && usersLoading && !users?.length ? (
          <p className="pte-hint">Chargement des accès...</p>
        ) : null}
        {mode === "edit" && users?.length
          ? users.map((user) => (
              <UserAccessCard
                key={user.id}
                user={user}
                onSave={onSaveUser}
                busy={userBusyId === user.id}
                error={userErrors?.[user.id]}
                nameIssue={user.role === "owner" ? issueOf("ownerName") : null}
                emailIssue={user.role === "owner" ? issueOf("email") : null}
              />
            ))
          : (
            <>
              <Field
                label="Nom du propriétaire"
                fieldKey="ownerName"
                issue={issueOf("ownerName")}
              >
                <input
                  type="text"
                  maxLength={120}
                  value={draft.ownerName}
                  onChange={setField("ownerName")}
                  autoComplete="off"
                />
              </Field>
              <Field
                label="E-mail du propriétaire"
                fieldKey="email"
                issue={issueOf("email")}
              >
                <input
                  type="email"
                  required={mode === "create"}
                  value={draft.email}
                  onChange={setField("email")}
                  autoComplete="off"
                />
              </Field>
              <Field
                label={mode === "create" ? "Mot de passe" : "Nouveau mot de passe"}
                hint={mode === "edit" ? "Laisser vide pour ne pas changer." : null}
              >
                <input
                  type="text"
                  required={mode === "create"}
                  minLength={mode === "create" ? 8 : undefined}
                  value={draft.password}
                  onChange={setField("password")}
                  autoComplete="off"
                />
              </Field>
            </>
          )}
      </Section>

      <Section title="Établissement">
        <Field label="Nom de l'établissement" fieldKey="name" issue={issueOf("name")}>
          <input
            type="text"
            required
            maxLength={200}
            value={draft.name}
            onChange={setField("name")}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Téléphone établissement"
          fieldKey="restaurantPhone"
          issue={issueOf("restaurantPhone")}
        >
          <input
            type="text"
            maxLength={30}
            value={draft.restaurantPhone}
            onChange={setField("restaurantPhone")}
            autoComplete="off"
          />
        </Field>
        <Field
          label="E-mail établissement"
          fieldKey="restaurantEmail"
          issue={issueOf("restaurantEmail")}
        >
          <input
            type="email"
            value={draft.restaurantEmail}
            onChange={setField("restaurantEmail")}
            autoComplete="off"
          />
        </Field>
        <Field label="Pays" fieldKey="countryCode" issue={issueOf("countryCode")}>
          <select value={draft.countryCode} onChange={setField("countryCode")}>
            <option value="FR">France</option>
            <option value="BE">Belgique</option>
            <option value="LU">Luxembourg</option>
          </select>
        </Field>
        <Field
          label="Adresse"
          wide
          fieldKey="addressLine"
          issue={issueOf("addressLine")}
        >
          <input
            type="text"
            maxLength={300}
            value={draft.addressLine}
            onChange={setField("addressLine")}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Code postal"
          fieldKey="postalCode"
          issue={issueOf("postalCode")}
        >
          <input
            type="text"
            maxLength={10}
            value={draft.postalCode}
            onChange={setField("postalCode")}
            autoComplete="off"
          />
        </Field>
        <Field label="Ville" fieldKey="city" issue={issueOf("city")}>
          <input
            type="text"
            maxLength={100}
            value={draft.city}
            onChange={setField("city")}
            autoComplete="off"
          />
        </Field>
        <Field label="Couverts">
          <input
            type="number"
            min={1}
            max={999}
            value={draft.seatCount}
            onChange={setField("seatCount")}
          />
        </Field>
        <Field label="Type de cuisine">
          <input
            type="text"
            maxLength={100}
            value={draft.cuisineType}
            onChange={setField("cuisineType")}
            autoComplete="off"
          />
        </Field>
        <Field
          label="SIRET / SIREN"
          hint="14 chiffres (SIRET) ou 9 chiffres (SIREN) si le SIRET n'est pas connu."
          fieldKey="siret"
          issue={issueOf("siret")}
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={17}
            value={draft.siret}
            onChange={setField("siret")}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Usage du numéro (Twilio)"
          wide
          fieldKey="phoneNumberUsage"
          issue={issueOf("phoneNumberUsage")}
        >
          <input
            type="text"
            maxLength={2000}
            value={draft.phoneNumberUsage}
            onChange={setField("phoneNumberUsage")}
            autoComplete="off"
          />
        </Field>
      </Section>

      <Section
        title="Ligne vocale"
        hint="Le numéro doit déjà exister sur le compte Twilio. Enregistrer le relie à ce tenant et pointe le webhook."
      >
        <Field
          label="Numéro Twilio déjà acheté"
          fieldKey="inboundPhone"
          issue={issueOf("inboundPhone")}
          hint={
            tenant?.phoneNumber
              ? `Relié : ${tenant.phoneNumber}. Colle un autre numéro ou un SID PN… pour le remplacer.`
              : "Ex. +12768811832, +33123456789, ou SID PN…"
          }
        >
          <input
            type="text"
            value={draft.inboundPhone}
            onChange={setField("inboundPhone")}
            placeholder="+12768811832"
            autoComplete="off"
          />
        </Field>
      </Section>

      <Section title="Fallback OpenAI">
        <Field
          label="Clé API OpenAI"
          hint={
            tenant?.openaiKeyConfigured
              ? "Clé déjà enregistrée. Laisser vide pour la conserver."
              : "Optionnel. Utilisée si le voice-server GPU est injoignable."
          }
        >
          <input
            type="password"
            value={draft.openaiApiKey}
            onChange={setField("openaiApiKey")}
            placeholder={tenant?.openaiKeyConfigured ? "••••••••" : "sk-..."}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Modèle Realtime"
          hint={`Requis par le runtime : ${tenant?.openaiRealtimeModel || OPENAI_REALTIME_MODEL}. Chat Completions interne : ${tenant?.openaiChatModel || OPENAI_CHAT_MODEL}.`}
        >
          <input
            type="text"
            maxLength={80}
            value={draft.openaiModel}
            onChange={setField("openaiModel")}
            autoComplete="off"
          />
        </Field>
      </Section>

      {mode === "edit" && tenant && (
        <Section title="Technique">
          <dl className="pte-meta">
            <div>
              <dt>Offre</dt>
              <dd>{tenant.planName || tenant.planSlug || "—"}</dd>
            </div>
            <div>
              <dt>Provisioning</dt>
              <dd>{tenant.provisioningState || "—"}</dd>
            </div>
            <div>
              <dt>Bundle Twilio</dt>
              <dd>{tenant.bundleStatus || "—"}</dd>
            </div>
            <div>
              <dt>Dossier pièces</dt>
              <dd>
                {tenant.documentKinds?.length
                  ? tenant.documentKinds.join(", ")
                  : tenant.documentsSubmittedAt
                    ? "Envoyé"
                    : "Aucun"}
              </dd>
            </div>
            <div>
              <dt>Numéro attribué</dt>
              <dd>{tenant.phoneNumber || "Non attribué"}</dd>
            </div>
            <div className="pte-meta-wide">
              <dt>Webhook vocal</dt>
              <dd>
                {tenant.voiceWebhookUrl ||
                  "Tunnel public introuvable. Lance ngrok vers le port 8080."}
              </dd>
            </div>
            {tenant.provisioningError && (
              <div className="pte-meta-wide">
                <dt>Motif</dt>
                <dd>{tenant.provisioningError}</dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {error && (
        <p className="platform-admin-error" role="alert">
          {error}
        </p>
      )}

      <footer className="pte-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy
            ? "Enregistrement..."
            : mode === "create"
              ? "Créer le client"
              : "Enregistrer"}
        </button>
        {children}
      </footer>
    </form>
  );
};

export default PlatformTenantEditor;
