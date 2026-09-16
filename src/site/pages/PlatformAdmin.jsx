import React, { useEffect, useState } from "react";
import { PageContainer, Hero, Section } from "../components";
import { useAuth } from "../hooks/useAuth";
import { usePlatformAdmin } from "../hooks/usePlatformAdmin";
import { startPlatformGoogleLogin } from "../services/platformAdminService";
import "./PlatformAdmin.scss";

const STATUS_LABELS = {
  pending_payment: "Paiement",
  pending_compliance: "Conformité",
  active: "Actif",
  suspended: "Suspendu",
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traité",
};

function parsePhoneInput(value) {
  const trimmed = String(value || "").trim();
  if (/^PN[a-f0-9]{32}$/i.test(trimmed)) {
    return { phoneNumberSid: trimmed };
  }
  return { phoneNumber: trimmed };
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const PlatformAdmin = () => {
  const { setAuth } = useAuth();
  const {
    tenants,
    fleet,
    contacts,
    demos,
    isLoading,
    error,
    busyId,
    elevated,
    isCheckingSession,
    totpStep,
    totpSetup,
    checkSession,
    login,
    loadTotpSetup,
    finishTotp,
    loadInbox,
    loadFleet,
    assignPhone,
    activateTenant,
    suspendTenant,
    closeTenant,
    rejectTenant,
    markContact,
    markDemo,
  } = usePlatformAdmin();
  const [tab, setTab] = useState("restaurants");
  const [phoneDrafts, setPhoneDrafts] = useState({});
  const [rejectDrafts, setRejectDrafts] = useState({});
  const [rowError, setRowError] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [totpToken, setTotpToken] = useState("");
  const [oauthDenied, setOauthDenied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "denied") setOauthDenied(true);
    if (oauth) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    let cancelled = false;
    checkSession().then((result) => {
      if (cancelled) return;
      if (result?.elevated) {
        loadInbox();
        loadFleet();
      }
      if (result?.totpStep === "enroll") {
        loadTotpSetup().catch((err) => setLoginError(err.message));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkSession, loadInbox, loadFleet, loadTotpSetup]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError(null);
    setOauthDenied(false);
    setIsLoggingIn(true);
    try {
      const data = await login({
        email: email.trim(),
        password,
        accessCode: accessCode.trim(),
      });
      setAuth(data.user);
      setPassword("");
      setAccessCode("");
      if (data.totpStep === "enroll") {
        await loadTotpSetup();
      }
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTotp = async (event) => {
    event.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const user = await finishTotp(totpToken.trim());
      setAuth(user);
      setTotpToken("");
      await loadInbox();
      await loadFleet();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isCheckingSession) {
    return (
      <PageContainer>
        <p className="platform-admin-empty">Vérification de la session back-office...</p>
      </PageContainer>
    );
  }

  if (!elevated) {
    return (
      <PageContainer>
        <Hero
          title="Back-office"
          gradientText="sécurisé"
          description="OAuth Google ou mot de passe, puis code Authenticator."
        />
        <Section variant="alt">
          {totpStep ? (
            <form className="platform-admin-login" onSubmit={handleTotp}>
              {totpStep === "enroll" && totpSetup?.qrDataUrl && (
                <div className="platform-admin-totp-setup">
                  <p>
                    Scannez ce QR code avec Google Authenticator, Authy ou un
                    autre Authenticator.
                  </p>
                  <img
                    className="platform-admin-totp-qr"
                    src={totpSetup.qrDataUrl}
                    alt="QR code Authenticator"
                  />
                </div>
              )}
              <label htmlFor="platform-totp">Code Authenticator</label>
              <input
                id="platform-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpToken}
                onChange={(event) => setTotpToken(event.target.value)}
                required
                minLength={6}
                maxLength={12}
                disabled={isLoggingIn}
              />
              {loginError && (
                <p className="platform-admin-error" role="alert">
                  {loginError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
                {isLoggingIn ? "Vérification..." : "Valider le code"}
              </button>
            </form>
          ) : (
            <form className="platform-admin-login" onSubmit={handleLogin}>
              <label htmlFor="platform-email">Adresse e-mail</label>
              <input
                id="platform-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                disabled={isLoggingIn}
              />
              <label htmlFor="platform-password">Mot de passe</label>
              <input
                id="platform-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isLoggingIn}
              />
              <label htmlFor="platform-access-code">Code d'accès</label>
              <input
                id="platform-access-code"
                type="password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                autoComplete="one-time-code"
                required
                minLength={8}
                disabled={isLoggingIn}
              />
              {(loginError || oauthDenied) && (
                <p className="platform-admin-error" role="alert">
                  {loginError || "Connexion Google refusée pour le back-office."}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
                {isLoggingIn ? "Vérification..." : "Continuer"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isLoggingIn}
                onClick={() => {
                  try {
                    startPlatformGoogleLogin();
                  } catch (err) {
                    setLoginError(err.message);
                  }
                }}
              >
                Continuer avec Google
              </button>
            </form>
          )}
        </Section>
      </PageContainer>
    );
  }

  const handleAssign = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await assignPhone(tenantId, parsePhoneInput(phoneDrafts[tenantId]));
      setPhoneDrafts((current) => ({ ...current, [tenantId]: "" }));
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleActivate = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await activateTenant(tenantId);
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleReject = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await rejectTenant(tenantId, rejectDrafts[tenantId]);
      setRejectDrafts((current) => ({ ...current, [tenantId]: "" }));
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleSuspend = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await suspendTenant(tenantId);
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleClose = async (tenant) => {
    const label = tenant.businessName || tenant.name || "cet établissement";
    const confirmed = window.confirm(
      `Supprimer ${label} ? Il disparaîtra du back-office et la ligne vocale sera coupée.`
    );
    if (!confirmed) return;
    setRowError((current) => ({ ...current, [tenant.id]: null }));
    try {
      await closeTenant(tenant.id);
    } catch (err) {
      setRowError((current) => ({ ...current, [tenant.id]: err.message }));
    }
  };

  const openTab = (next) => {
    setTab(next);
    if (next === "actifs") loadFleet();
    if (next === "restaurants") loadInbox();
  };

  return (
    <PageContainer>
      <Hero
        title="Back-office"
        gradientText="demandes"
        description="Demandes en attente et instances actives. Session plateforme obligatoire."
      />
      <Section variant="alt">
        <div className="platform-admin">
          <div className="platform-admin-toolbar">
            <button
              type="button"
              className={tab === "restaurants" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => openTab("restaurants")}
            >
              Demandes ({tenants.length})
            </button>
            <button
              type="button"
              className={tab === "actifs" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => openTab("actifs")}
            >
              Actifs ({fleet.length})
            </button>
            <button
              type="button"
              className={tab === "contacts" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setTab("contacts")}
            >
              Contacts ({contacts.length})
            </button>
            <button
              type="button"
              className={tab === "demos" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setTab("demos")}
            >
              Démos ({demos.length})
            </button>
          </div>

          {error && (
            <p className="platform-admin-error" role="alert">
              {error}
            </p>
          )}
          {isLoading && <p className="platform-admin-empty">Chargement...</p>}

          {tab === "restaurants" && !isLoading && tenants.length === 0 && (
            <p className="platform-admin-empty">Aucune demande restaurant en attente.</p>
          )}

          {tab === "restaurants" && (
            <ul className="platform-admin-list">
              {tenants.map((tenant) => (
                <li key={tenant.id} className="platform-admin-card">
                  <div className="platform-admin-card-head">
                    <h2>{tenant.businessName || tenant.name}</h2>
                    <span className="platform-admin-status">
                      {STATUS_LABELS[tenant.status] || tenant.status}
                    </span>
                  </div>
                  <dl className="platform-admin-meta">
                    <div>
                      <dt>Propriétaire</dt>
                      <dd>{tenant.ownerEmail}</dd>
                    </div>
                    <div>
                      <dt>Offre</dt>
                      <dd>{tenant.planName || tenant.planSlug || "—"}</dd>
                    </div>
                    <div>
                      <dt>Dossier envoyé</dt>
                      <dd>{formatDate(tenant.documentsSubmittedAt)}</dd>
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
                      <dt>Téléphone établissement</dt>
                      <dd>{tenant.restaurantPhone || "—"}</dd>
                    </div>
                    <div>
                      <dt>Numéro attribué</dt>
                      <dd>{tenant.phoneNumber || "Non attribué"}</dd>
                    </div>
                    <div>
                      <dt>Slug</dt>
                      <dd>{tenant.slug || "—"}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Identifiant HTTP Twilio (chiffré)</dt>
                      <dd>{tenant.voiceWebhookSlug || "—"}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Webhook vocal</dt>
                      <dd>
                        {tenant.voiceWebhookUrl ||
                          "Tunnel public introuvable. Lance ngrok vers le port 8080."}
                      </dd>
                    </div>
                    {tenant.provisioningError && (
                      <div className="platform-admin-webhook">
                        <dt>Motif</dt>
                        <dd>{tenant.provisioningError}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="platform-admin-actions">
                    <label htmlFor={`phone-${tenant.id}`}>
                      Numéro E.164 ou SID Twilio
                    </label>
                    <div className="platform-admin-assign">
                      <input
                        id={`phone-${tenant.id}`}
                        type="text"
                        value={phoneDrafts[tenant.id] || ""}
                        onChange={(event) =>
                          setPhoneDrafts((current) => ({
                            ...current,
                            [tenant.id]: event.target.value,
                          }))
                        }
                        placeholder="+33123456789"
                        disabled={busyId === tenant.id}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === tenant.id || !phoneDrafts[tenant.id]}
                        onClick={() => handleAssign(tenant.id)}
                      >
                        {busyId === tenant.id ? "Attribution..." : "Attribuer"}
                      </button>
                      {tenant.status !== "active" && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleActivate(tenant.id)}
                        >
                          Accepter
                        </button>
                      )}
                    </div>
                    {tenant.status !== "active" && (
                      <div className="platform-admin-assign">
                        <input
                          type="text"
                          value={rejectDrafts[tenant.id] || ""}
                          onChange={(event) =>
                            setRejectDrafts((current) => ({
                              ...current,
                              [tenant.id]: event.target.value,
                            }))
                          }
                          placeholder="Motif du refus"
                          disabled={busyId === tenant.id}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleReject(tenant.id)}
                        >
                          Refuser
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleClose(tenant)}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                    {tenant.status === "active" && (
                      <div className="platform-admin-assign">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleClose(tenant)}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                    {rowError[tenant.id] && (
                      <p className="platform-admin-error" role="alert">
                        {rowError[tenant.id]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "actifs" && !isLoading && fleet.length === 0 && (
            <p className="platform-admin-empty">Aucune instance active ou suspendue.</p>
          )}

          {tab === "actifs" && (
            <ul className="platform-admin-list">
              {fleet.map((tenant) => (
                <li key={tenant.id} className="platform-admin-card">
                  <div className="platform-admin-card-head">
                    <h2>{tenant.businessName || tenant.name}</h2>
                    <span className="platform-admin-status">
                      {STATUS_LABELS[tenant.status] || tenant.status}
                    </span>
                  </div>
                  <dl className="platform-admin-meta">
                    <div>
                      <dt>Propriétaire</dt>
                      <dd>{tenant.ownerEmail}</dd>
                    </div>
                    <div>
                      <dt>Offre</dt>
                      <dd>{tenant.planName || tenant.planSlug || "—"}</dd>
                    </div>
                    <div>
                      <dt>Activé le</dt>
                      <dd>{formatDate(tenant.activatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Téléphone établissement</dt>
                      <dd>{tenant.restaurantPhone || "—"}</dd>
                    </div>
                    <div>
                      <dt>Numéro attribué</dt>
                      <dd>{tenant.phoneNumber || "Non attribué"}</dd>
                    </div>
                    <div>
                      <dt>SID Twilio</dt>
                      <dd>{tenant.phoneNumberSid || "—"}</dd>
                    </div>
                    <div>
                      <dt>Slug</dt>
                      <dd>{tenant.slug || "—"}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Identifiant HTTP Twilio (chiffré)</dt>
                      <dd>{tenant.voiceWebhookSlug || "—"}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Webhook vocal</dt>
                      <dd>
                        {tenant.voiceWebhookUrl ||
                          "Tunnel public introuvable. Lance ngrok vers le port 8080."}
                      </dd>
                    </div>
                  </dl>

                  <div className="platform-admin-actions">
                    <label htmlFor={`fleet-phone-${tenant.id}`}>
                      Nouveau numéro E.164 ou SID Twilio
                    </label>
                    <div className="platform-admin-assign">
                      <input
                        id={`fleet-phone-${tenant.id}`}
                        type="text"
                        value={phoneDrafts[tenant.id] || ""}
                        onChange={(event) =>
                          setPhoneDrafts((current) => ({
                            ...current,
                            [tenant.id]: event.target.value,
                          }))
                        }
                        placeholder={tenant.phoneNumberSid || tenant.phoneNumber || "+33123456789"}
                        disabled={busyId === tenant.id}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === tenant.id || !phoneDrafts[tenant.id]}
                        onClick={() => handleAssign(tenant.id)}
                      >
                        {busyId === tenant.id ? "Mise à jour..." : "Changer le numéro"}
                      </button>
                      {tenant.status === "active" ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleSuspend(tenant.id)}
                        >
                          Suspendre
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === tenant.id}
                          onClick={() => handleActivate(tenant.id)}
                        >
                          Réactiver
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === tenant.id}
                        onClick={() => handleClose(tenant)}
                      >
                        Supprimer
                      </button>
                    </div>
                    {rowError[tenant.id] && (
                      <p className="platform-admin-error" role="alert">
                        {rowError[tenant.id]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "contacts" && !isLoading && contacts.length === 0 && (
            <p className="platform-admin-empty">Aucun message de contact à traiter.</p>
          )}
          {tab === "contacts" && (
            <ul className="platform-admin-list">
              {contacts.map((contact) => (
                <li key={contact.id} className="platform-admin-card">
                  <div className="platform-admin-card-head">
                    <h2>{contact.subject}</h2>
                    <span className="platform-admin-status">
                      {STATUS_LABELS[contact.status] || contact.status}
                    </span>
                  </div>
                  <dl className="platform-admin-meta">
                    <div>
                      <dt>Nom</dt>
                      <dd>{contact.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{contact.email}</dd>
                    </div>
                    <div>
                      <dt>Société</dt>
                      <dd>{contact.company || "—"}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatDate(contact.createdAt)}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Message</dt>
                      <dd>{contact.message}</dd>
                    </div>
                  </dl>
                  <div className="platform-admin-assign">
                    {contact.status === "nouveau" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === contact.id}
                        onClick={() => markContact(contact.id, "en_cours")}
                      >
                        Prendre en cours
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === contact.id}
                      onClick={() => markContact(contact.id, "traite")}
                    >
                      Marquer traité
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "demos" && !isLoading && demos.length === 0 && (
            <p className="platform-admin-empty">Aucune demande de démo à traiter.</p>
          )}
          {tab === "demos" && (
            <ul className="platform-admin-list">
              {demos.map((demo) => (
                <li key={demo.id} className="platform-admin-card">
                  <div className="platform-admin-card-head">
                    <h2>{demo.company}</h2>
                    <span className="platform-admin-status">
                      {STATUS_LABELS[demo.status] || demo.status}
                    </span>
                  </div>
                  <dl className="platform-admin-meta">
                    <div>
                      <dt>Nom</dt>
                      <dd>{demo.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{demo.email}</dd>
                    </div>
                    <div>
                      <dt>Créneau</dt>
                      <dd>{demo.preferredTime}</dd>
                    </div>
                    <div>
                      <dt>Durée</dt>
                      <dd>{demo.duration}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatDate(demo.createdAt)}</dd>
                    </div>
                    <div className="platform-admin-webhook">
                      <dt>Besoin</dt>
                      <dd>{demo.needs}</dd>
                    </div>
                  </dl>
                  <div className="platform-admin-assign">
                    {demo.status === "nouveau" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === demo.id}
                        onClick={() => markDemo(demo.id, "en_cours")}
                      >
                        Prendre en cours
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === demo.id}
                      onClick={() => markDemo(demo.id, "traite")}
                    >
                      Marquer traité
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </PageContainer>
  );
};

export default PlatformAdmin;
