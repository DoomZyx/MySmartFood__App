import React, { useEffect, useMemo, useState } from "react";
import { PageContainer, Section } from "../components";
import { useAuth } from "../hooks/useAuth";
import { usePlatformAdmin } from "../hooks/usePlatformAdmin";
import { startPlatformGoogleLogin } from "../services/platformAdminService";
import AuthSuccessModal from "../components/Shared/AuthSuccessModal/AuthSuccessModal";
import PlatformTenantEditor, {
  EMPTY_TENANT_DRAFT,
  draftToPayload,
  tenantToDraft,
} from "../components/PlatformTenantEditor/PlatformTenantEditor";
import PlatformOpsBoard from "../components/PlatformOpsBoard/PlatformOpsBoard";
import PlatformOnboardingTracker from "../components/PlatformOpsBoard/PlatformOnboardingTracker";
import {
  EMPTY_LABELS,
  STATUS_LABELS,
  buildOpsGroups,
  formatOpsDate,
  itemsForLane,
  mergeRestaurants,
} from "../utils/platformOpsLanes";
import "./PlatformAdmin.scss";

const PlatformAdmin = () => {
  const { setAuth, user: authUser } = useAuth();
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
    createTenant,
    updateTenant,
    activateTenant,
    suspendTenant,
    closeTenant,
    rejectTenant,
    markContact,
    markDemo,
    staff,
    loadStaff,
    createStaff,
    revokeStaff,
  } = usePlatformAdmin();
  const [lane, setLane] = useState("inbox");
  const [selected, setSelected] = useState(null);
  const [rejectDrafts, setRejectDrafts] = useState({});
  const [rowError, setRowError] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [totpToken, setTotpToken] = useState("");
  const [oauthDenied, setOauthDenied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffFormError, setStaffFormError] = useState(null);
  const [createDraft, setCreateDraft] = useState(EMPTY_TENANT_DRAFT);
  const [editDrafts, setEditDrafts] = useState({});
  const [clientFormError, setClientFormError] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);
  const isDevBypass = import.meta.env.DEV;
  const canManageStaff = Boolean(authUser?.isPlatformOwner);

  const restaurants = useMemo(
    () => mergeRestaurants(tenants, fleet),
    [tenants, fleet]
  );
  const groups = useMemo(
    () =>
      buildOpsGroups({
        restaurants,
        contacts,
        demos,
        staff,
        canManageStaff,
      }),
    [restaurants, contacts, demos, staff, canManageStaff]
  );
  const items = useMemo(
    () => itemsForLane(lane, { restaurants, contacts, demos, staff }),
    [lane, restaurants, contacts, demos, staff]
  );

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
      if (result?.user) setAuth(result.user);
      if (result?.elevated) {
        loadInbox();
        loadFleet();
        if (result.user?.isPlatformOwner) loadStaff();
      }
      if (result?.totpStep === "enroll") {
        loadTotpSetup().catch((err) => setLoginError(err.message));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkSession, loadInbox, loadFleet, loadStaff, loadTotpSetup, setAuth]);

  useEffect(() => {
    setEditDrafts((current) => {
      const next = { ...current };
      restaurants.forEach((tenant) => {
        if (!next[tenant.id]) next[tenant.id] = tenantToDraft(tenant);
      });
      return next;
    });
  }, [restaurants]);

  useEffect(() => {
    if (!selected || isLoading) return;
    const stillThere = items.some(
      (item) => item.id === selected.id && item.kind === selected.kind
    );
    if (!stillThere && lane !== "create") setSelected(null);
  }, [items, selected, isLoading, lane]);

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
      if (data.platformVerified) {
        setShowSuccess(true);
        await loadInbox();
        await loadFleet();
        if (data.user?.isPlatformOwner) await loadStaff();
        return;
      }
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
      setShowSuccess(true);
      await loadInbox();
      await loadFleet();
      if (user?.isPlatformOwner) await loadStaff();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const selectLane = (next) => {
    setLane(next);
    setSelected(null);
    if (next === "active" || next === "suspended" || next === "inbox") loadFleet();
    if (
      next === "inbox" ||
      next === "pending_payment" ||
      next === "pending_compliance" ||
      next === "ready" ||
      next === "contacts" ||
      next === "demos"
    ) {
      loadInbox();
    }
    if (next === "staff" && canManageStaff) loadStaff();
  };

  const setEditDraft = (tenantId, draft) => {
    setEditDrafts((current) => ({ ...current, [tenantId]: draft }));
  };

  const handleActivate = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await activateTenant(tenantId);
      setLane("active");
      setSelected({ kind: "tenant", id: tenantId });
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleReject = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await rejectTenant(tenantId, rejectDrafts[tenantId]);
      setRejectDrafts((current) => ({ ...current, [tenantId]: "" }));
      setSelected(null);
    } catch (err) {
      setRowError((current) => ({ ...current, [tenantId]: err.message }));
    }
  };

  const handleSuspend = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await suspendTenant(tenantId);
      setLane("suspended");
      setSelected({ kind: "tenant", id: tenantId });
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
      setSelected(null);
    } catch (err) {
      setRowError((current) => ({ ...current, [tenant.id]: err.message }));
    }
  };

  const handleCreateTenant = async (event) => {
    event.preventDefault();
    setClientFormError(null);
    setCreatedAccount(null);
    try {
      const payload = draftToPayload(createDraft, { requirePassword: true });
      const data = await createTenant(payload);
      setCreatedAccount({
        email: payload.email,
        password: data.temporaryPassword || payload.password,
        name: data.tenant?.businessName || payload.name,
      });
      setCreateDraft(EMPTY_TENANT_DRAFT);
      if (data.tenant?.id) {
        setLane("active");
        setSelected({ kind: "tenant", id: data.tenant.id });
      }
    } catch (err) {
      setClientFormError(err.message);
    }
  };

  const handleSaveTenant = async (event, tenant) => {
    event.preventDefault();
    setRowError((current) => ({ ...current, [tenant.id]: null }));
    try {
      const draft = editDrafts[tenant.id] || tenantToDraft(tenant);
      const data = await updateTenant(tenant.id, draftToPayload(draft));
      setEditDraft(tenant.id, {
        ...tenantToDraft(data.tenant),
        password: "",
        inboundPhone: "",
      });
    } catch (err) {
      setRowError((current) => ({ ...current, [tenant.id]: err.message }));
    }
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();
    setStaffFormError(null);
    try {
      await createStaff({
        email: staffEmail.trim(),
        name: staffName.trim(),
        password: staffPassword,
      });
      setStaffEmail("");
      setStaffName("");
      setStaffPassword("");
    } catch (err) {
      setStaffFormError(err.message);
    }
  };

  const handleRevokeStaff = async (member) => {
    const confirmed = window.confirm(
      `Retirer l'accès back-office de ${member.email} ?`
    );
    if (!confirmed) return;
    setStaffFormError(null);
    try {
      await revokeStaff(member.id);
      setSelected(null);
    } catch (err) {
      setStaffFormError(err.message);
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
        <Section variant="alt">
          <h1 className="platform-admin-login-title">Back-office MySmartFood</h1>
          <p className="platform-admin-login-copy">
            {isDevBypass
              ? "En local : e-mail et mot de passe du compte admin plateforme suffisent."
              : "Compte admin plateforme, code d'accès, puis Authenticator. N'utilisez pas le bouton Se connecter de la vitrine."}
          </p>
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
              {!isDevBypass && (
                <>
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
                </>
              )}
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

  const selectedTenant =
    selected?.kind === "tenant"
      ? restaurants.find((tenant) => tenant.id === selected.id)
      : null;
  const selectedContact =
    selected?.kind === "contact"
      ? contacts.find((contact) => contact.id === selected.id)
      : null;
  const selectedDemo =
    selected?.kind === "demo" ? demos.find((demo) => demo.id === selected.id) : null;
  const selectedStaff =
    selected?.kind === "staff" ? staff.find((member) => member.id === selected.id) : null;

  const canAcceptSelfService = (tenant) =>
    tenant.onboardedBy === "platform" || Boolean(tenant.dossierComplete);

  const renderTenantActions = (tenant) => (
    <div className="platform-admin-assign">
      {tenant.status !== "active" && tenant.status !== "suspended" && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyId === tenant.id || !canAcceptSelfService(tenant)}
            onClick={() => handleActivate(tenant.id)}
          >
            Accepter
          </button>
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
        </>
      )}
      {tenant.status === "active" && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busyId === tenant.id}
          onClick={() => handleSuspend(tenant.id)}
        >
          Suspendre
        </button>
      )}
      {tenant.status === "suspended" && (
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
  );

  const renderLeadActions = (kind, item) => (
    <div className="platform-admin-assign">
      {item.status === "nouveau" && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busyId === item.id}
          onClick={() =>
            kind === "contact"
              ? markContact(item.id, "en_cours")
              : markDemo(item.id, "en_cours")
          }
        >
          Prendre en cours
        </button>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busyId === item.id}
        onClick={() =>
          kind === "contact"
            ? markContact(item.id, "traite")
            : markDemo(item.id, "traite")
        }
      >
        Marquer traité
      </button>
    </div>
  );

  let detail = (
    <p className="platform-ops-placeholder">
      Choisissez une demande dans la file pour suivre l'état du dossier, ou
      ouvrez Nouveau client pour onboarder un restaurant.
    </p>
  );

  if (lane === "create") {
    detail = (
      <div className="platform-admin-card">
        <PlatformTenantEditor
          mode="create"
          draft={createDraft}
          onChange={setCreateDraft}
          onSubmit={handleCreateTenant}
          busy={busyId === "create-tenant"}
          error={clientFormError}
        >
          {createdAccount && (
            <p role="status">
              Compte créé pour {createdAccount.name}. E-mail : {createdAccount.email}.
              Mot de passe : {createdAccount.password}. Notez-le, il ne sera plus
              réaffiché.
            </p>
          )}
        </PlatformTenantEditor>
      </div>
    );
  } else if (selectedTenant) {
    detail = (
      <>
        <PlatformOnboardingTracker tenant={selectedTenant} />
        <div className="platform-admin-card">
          <PlatformTenantEditor
            mode="edit"
            tenant={{
              ...selectedTenant,
              status: STATUS_LABELS[selectedTenant.status] || selectedTenant.status,
            }}
            draft={editDrafts[selectedTenant.id] || tenantToDraft(selectedTenant)}
            onChange={(draft) => setEditDraft(selectedTenant.id, draft)}
            onSubmit={(event) => handleSaveTenant(event, selectedTenant)}
            busy={busyId === selectedTenant.id}
            error={rowError[selectedTenant.id]}
          >
            {renderTenantActions(selectedTenant)}
          </PlatformTenantEditor>
        </div>
      </>
    );
  } else if (selectedContact) {
    detail = (
      <div className="platform-admin-card">
        <div className="platform-admin-card-head">
          <h2>{selectedContact.subject}</h2>
          <span className="platform-admin-status">
            {STATUS_LABELS[selectedContact.status] || selectedContact.status}
          </span>
        </div>
        <dl className="platform-admin-meta">
          <div>
            <dt>Nom</dt>
            <dd>{selectedContact.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedContact.email}</dd>
          </div>
          <div>
            <dt>Société</dt>
            <dd>{selectedContact.company || "—"}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatOpsDate(selectedContact.createdAt)}</dd>
          </div>
          <div className="platform-admin-webhook">
            <dt>Message</dt>
            <dd>{selectedContact.message}</dd>
          </div>
        </dl>
        {renderLeadActions("contact", selectedContact)}
      </div>
    );
  } else if (selectedDemo) {
    detail = (
      <div className="platform-admin-card">
        <div className="platform-admin-card-head">
          <h2>{selectedDemo.company}</h2>
          <span className="platform-admin-status">
            {STATUS_LABELS[selectedDemo.status] || selectedDemo.status}
          </span>
        </div>
        <dl className="platform-admin-meta">
          <div>
            <dt>Nom</dt>
            <dd>{selectedDemo.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedDemo.email}</dd>
          </div>
          <div>
            <dt>Créneau</dt>
            <dd>{selectedDemo.preferredTime}</dd>
          </div>
          <div>
            <dt>Durée</dt>
            <dd>{selectedDemo.duration}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatOpsDate(selectedDemo.createdAt)}</dd>
          </div>
          <div className="platform-admin-webhook">
            <dt>Besoin</dt>
            <dd>{selectedDemo.needs}</dd>
          </div>
        </dl>
        {renderLeadActions("demo", selectedDemo)}
      </div>
    );
  } else if (lane === "staff" && canManageStaff) {
    detail = (
      <>
        <form className="platform-admin-login platform-ops-staff-form" onSubmit={handleCreateStaff}>
          <h2>Créer un admin back-office</h2>
          <p>
            Même accès que vous sur les restaurants et les instances. Seul votre
            compte gère les comptes.
          </p>
          <label>
            Nom
            <input
              type="text"
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              required
              value={staffEmail}
              onChange={(event) => setStaffEmail(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              required
              minLength={8}
              value={staffPassword}
              onChange={(event) => setStaffPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          {staffFormError && (
            <p className="platform-admin-error" role="alert">
              {staffFormError}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busyId === "create-staff"}
          >
            {busyId === "create-staff" ? "Création..." : "Créer le compte"}
          </button>
        </form>
        {selectedStaff && (
          <div className="platform-admin-card">
            <div className="platform-admin-card-head">
              <h2>{selectedStaff.name || selectedStaff.email}</h2>
              <span className="platform-admin-status">
                {selectedStaff.isPlatformOwner ? "Propriétaire" : "Admin"}
              </span>
            </div>
            <dl className="platform-admin-meta">
              <div>
                <dt>E-mail</dt>
                <dd>{selectedStaff.email}</dd>
              </div>
              <div>
                <dt>Dernière connexion</dt>
                <dd>{formatOpsDate(selectedStaff.lastLoginAt)}</dd>
              </div>
            </dl>
            {!selectedStaff.isPlatformOwner && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busyId === selectedStaff.id}
                onClick={() => handleRevokeStaff(selectedStaff)}
              >
                Retirer l'accès
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <PageContainer className="platform-ops-page">
      {showSuccess && (
        <AuthSuccessModal
          isOpen
          email={authUser?.email || email}
          onContinue={() => setShowSuccess(false)}
        />
      )}
      <PlatformOpsBoard
        groups={groups}
        lane={lane}
        onLaneChange={selectLane}
        items={items}
        selectedId={selected ? `${selected.kind}-${selected.id}` : null}
        onSelectItem={(item) => setSelected({ kind: item.kind, id: item.id })}
        isLoading={isLoading}
        error={error}
        emptyLabel={EMPTY_LABELS[lane] || "Aucun élément."}
        hideList={lane === "create"}
      >
        {detail}
      </PlatformOpsBoard>
    </PageContainer>
  );
};

export default PlatformAdmin;
