import React from "react";
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

function Section({ title, children }) {
  return (
    <section className="pte-section">
      <h3>{title}</h3>
      <div className="pte-grid">{children}</div>
    </section>
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

      <Section title="Compte">
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
      </Section>

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

      <Section title="Ligne vocale">
        <Field
          label="Numéro Twilio"
          hint={tenant?.phoneNumber ? `Actuel : ${tenant.phoneNumber}` : "E.164 ou SID. Optionnel."}
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
            <div>
              <dt>Slug</dt>
              <dd>{tenant.slug || "—"}</dd>
            </div>
            <div className="pte-meta-wide">
              <dt>Identifiant HTTP Twilio</dt>
              <dd>{tenant.voiceWebhookSlug || "—"}</dd>
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
