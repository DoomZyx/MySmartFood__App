import React from "react";
import PlatformDossierReview from "../PlatformDossierReview/PlatformDossierReview";
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

function Field({ label, hint, wide, children }) {
  return (
    <label className={wide ? "pte-field pte-field-wide" : "pte-field"}>
      <span className="pte-label">{label}</span>
      {children}
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

function UserAccessCard({ user, onSave, busy, error }) {
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
      <Field label="Nom">
        <input
          type="text"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label="E-mail">
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

function Checklist({ checklist }) {
  if (!checklist?.items?.length) return null;
  return (
    <div className="pte-check" aria-label="Validation du dossier">
      {checklist.items.map((item) => (
        <span
          key={item.key}
          className={item.ok ? "pte-chip pte-chip-ok" : "pte-chip pte-chip-ko"}
        >
          {item.label} : {item.ok ? "OK" : "manque"}
        </span>
      ))}
      <span className={checklist.ready ? "pte-chip pte-chip-ready" : "pte-chip pte-chip-wait"}>
        {checklist.ready ? "Prêt à valider" : "Dossier incomplet"}
      </span>
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

      {mode === "edit" && <Checklist checklist={tenant?.checklist} />}

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
              />
            ))
          : (
            <>
              <Field label="Nom du propriétaire">
                <input
                  type="text"
                  maxLength={120}
                  value={draft.ownerName}
                  onChange={setField("ownerName")}
                  autoComplete="off"
                />
              </Field>
              <Field label="E-mail du propriétaire">
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

      {mode === "edit" && tenant && (
        <PlatformDossierReview
          tenant={tenant}
          onUploadIdentity={onUploadIdentity}
          uploadBusyId={uploadBusyId}
        />
      )}

      <Section title="Établissement">
        <Field label="Nom de l'établissement">
          <input
            type="text"
            required
            maxLength={200}
            value={draft.name}
            onChange={setField("name")}
            autoComplete="off"
          />
        </Field>
        <Field label="Téléphone établissement">
          <input
            type="text"
            maxLength={30}
            value={draft.restaurantPhone}
            onChange={setField("restaurantPhone")}
            autoComplete="off"
          />
        </Field>
        <Field label="E-mail établissement">
          <input
            type="email"
            value={draft.restaurantEmail}
            onChange={setField("restaurantEmail")}
            autoComplete="off"
          />
        </Field>
        <Field label="Pays">
          <select value={draft.countryCode} onChange={setField("countryCode")}>
            <option value="FR">France</option>
            <option value="BE">Belgique</option>
            <option value="LU">Luxembourg</option>
          </select>
        </Field>
        <Field label="Adresse" wide>
          <input
            type="text"
            maxLength={300}
            value={draft.addressLine}
            onChange={setField("addressLine")}
            autoComplete="off"
          />
        </Field>
        <Field label="Code postal">
          <input
            type="text"
            maxLength={10}
            value={draft.postalCode}
            onChange={setField("postalCode")}
            autoComplete="off"
          />
        </Field>
        <Field label="Ville">
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
        <Field label="Usage du numéro (Twilio)" wide>
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
          hint={
            tenant?.phoneNumber
              ? `Relié : ${tenant.phoneNumber}. Colle un autre +33 ou un SID PN… pour le remplacer.`
              : "Format +33123456789 ou SID PN…"
          }
        >
          <input
            type="text"
            value={draft.inboundPhone}
            onChange={setField("inboundPhone")}
            placeholder="+33123456789"
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
