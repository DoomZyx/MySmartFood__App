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
import PlatformOpsModal from "../components/PlatformOpsBoard/PlatformOpsModal";
import PlatformOnboardingTracker from "../components/PlatformOpsBoard/PlatformOnboardingTracker";
import PlatformUserEditor from "../components/PlatformUserEditor/PlatformUserEditor";
import PlatformStaffCreateForm from "../components/PlatformStaffEditor/PlatformStaffCreateForm";
import PlatformStaffEditor from "../components/PlatformStaffEditor/PlatformStaffEditor";
import PlatformRestaurantSupport from "../components/PlatformRestaurantSupport/PlatformRestaurantSupport";
import {
  EMPTY_LABELS,
  STATUS_LABELS,
  buildOpsGroups,
  firstUsefulLane,
  formatOpsDate,
  platformUserDeleteReason,
  ownedRestaurantNames,
  itemsForLane,
  laneIdsFromGroups,
  isDossierAwaitingReview,
  mergeRestaurants,
  restaurantStage,
} from "../utils/platformOpsLanes";
import { hasPlatformCapability } from "../utils/platformAccess";
import { dashboardHomeHref } from "../utils/dashboardPath";
import "./PlatformAdmin.scss";
import "../components/PlatformStaffEditor/PlatformStaffEditor.scss";

const PlatformAdmin = () => {
  const { setAuth, refreshUser, user: authUser } = useAuth();
  const {
    tenants,
    fleet,
    closed,
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
    updateStaff,
    revokeStaff,
    users,
    usersTotal,
    usersOffset,
    loadUsers,
    loadClosed,
    ensureUser,
    updateUser,
    deleteUser,
    ensureTenant,
    tenantUsers,
    tenantUsersLoading,
    loadTenantUsers,
    addTenantUser,
    removeTenantUser,
    saveLeadNote,
    convertLead,
    updateTenantUser,
    tenantOps,
    tenantOpsLoading,
    tenantOpsError,
    loadTenantOps,
    updateTenantHours,
    updateTenantMenuItem,
    uploadTenantDocument,
    impersonateUser,
  } = usePlatformAdmin();
  const [lane, setLane] = useState("active");
  const [laneChosen, setLaneChosen] = useState(false);
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
  const [staffFormError, setStaffFormError] = useState(null);
  const [staffCreated, setStaffCreated] = useState(null);
  const [createDraft, setCreateDraft] = useState(EMPTY_TENANT_DRAFT);
  const [editDrafts, setEditDrafts] = useState({});
  const [clientFormError, setClientFormError] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [userErrors, setUserErrors] = useState({});
  const [staffDrafts, setStaffDrafts] = useState({});
  const [userSearch, setUserSearch] = useState("");
  const [leadNotes, setLeadNotes] = useState({});
  const [convertedLead, setConvertedLead] = useState(null);
  const [userDrafts, setUserDrafts] = useState({});
  const [userFormError, setUserFormError] = useState(null);
  const [supportUserId, setSupportUserId] = useState(null);
  const isDevBypass = import.meta.env.DEV;
  const can = (capability) => hasPlatformCapability(authUser, capability);
  const canManageStaff = can("staff.manage");
  const canCreateTenant = can("tenant.write");
  const canWriteTenant = can("tenant.write");
  const canLifecycle = can("tenant.lifecycle");
  const canWriteUser = can("user.write");
  const canDeleteUser = can("user.delete");
  const canWriteMembership = can("membership.write");
  const canWriteLead = can("lead.write");
  const canConvertLead = can("lead.convert");
  const canImpersonate = can("impersonate");
  const canWriteOps = can("tenant.ops");

  const restaurants = useMemo(
    () => mergeRestaurants(tenants, fleet, closed),
    [tenants, fleet, closed]
  );
  const groups = useMemo(
    () =>
      buildOpsGroups({
        restaurants,
        contacts,
        demos,
        staff,
        users,
        usersTotal,
        canManageStaff,
        canCreateTenant,
      }),
    [restaurants, contacts, demos, staff, users, usersTotal, canManageStaff, canCreateTenant]
  );
  const items = useMemo(
    () => itemsForLane(lane, { restaurants, contacts, demos, staff, users }),
    [lane, restaurants, contacts, demos, staff, users]
  );
  const visibleLaneIds = useMemo(() => laneIdsFromGroups(groups), [groups]);
  const listTitle = useMemo(
    () =>
      groups.flatMap((group) => group.lanes).find((entry) => entry.id === lane)
        ?.label || "",
    [groups, lane]
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
        loadClosed();
        const userId = new URLSearchParams(window.location.search).get("user");
        loadUsers().then(() => {
          if (cancelled || !userId) return;
          ensureUser(userId).catch((err) => setUserFormError(err.message));
        });
        if (result.user && hasPlatformCapability(result.user, "staff.manage")) {
          loadStaff();
        }
      }
      if (result?.totpStep === "enroll") {
        loadTotpSetup().catch((err) => setLoginError(err.message));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkSession, loadInbox, loadFleet, loadClosed, loadStaff, loadUsers, loadTotpSetup, setAuth]);

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
    if (!visibleLaneIds.length) return;
    if (!laneChosen) {
      setLane(firstUsefulLane(groups));
      return;
    }
    if (!visibleLaneIds.includes(lane)) {
      setLane(firstUsefulLane(groups));
      setSelected(null);
    }
  }, [visibleLaneIds, laneChosen, lane, groups]);

  useEffect(() => {
    if (lane === "create" || isLoading) return;
    if (!selected) return;
    if (selected.kind === "tenant") {
      if (restaurants.some((tenant) => tenant.id === selected.id)) return;
    } else if (selected.kind === "user") {
      return;
    } else if (
      items.some((item) => item.id === selected.id && item.kind === selected.kind)
    ) {
      return;
    }
    setSelected(null);
  }, [items, selected, isLoading, lane, restaurants]);

  useEffect(() => {
    if (!elevated) return;
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");
    if (!userId) return;
    let cancelled = false;
    setLaneChosen(true);
    setLane("users");
    setSelected({ kind: "user", id: userId });
    return () => {
      cancelled = true;
    };
  }, [elevated]);

  useEffect(() => {
    if (selected?.kind === "user") {
      const url = new URL(window.location.href);
      url.searchParams.set("user", selected.id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return;
    }
    if (elevated) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("user")) {
        url.searchParams.delete("user");
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      }
    }
  }, [selected, elevated]);

  useEffect(() => {
    if (!elevated || selected?.kind !== "tenant" || !selected.id) return;
    loadTenantUsers(selected.id).catch((err) => {
      setRowError((current) => ({ ...current, [selected.id]: err.message }));
    });
    loadTenantOps(selected.id).catch(() => {});
  }, [elevated, selected?.kind, selected?.id, loadTenantUsers, loadTenantOps]);

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
      if (data.user) {
        setAuth({
          ...data.user,
          tenants: data.tenants || data.user.tenants,
        });
      }
      setPassword("");
      setAccessCode("");
      if (data.platformVerified) {
        setShowSuccess(true);
        await loadInbox();
        await loadFleet();
        await loadClosed();
        await loadUsers();
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
      await loadClosed();
      await loadUsers();
      if (user?.isPlatformOwner) await loadStaff();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const selectLane = (next) => {
    setLaneChosen(true);
    setLane(next);
    setSelected(null);
    setSupportUserId(null);
    if (next === "active" || next === "suspended" || next === "rejected") loadFleet();
    if (next === "closed") loadClosed();
    if (
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

  useEffect(() => {
    if (!elevated || lane !== "users") return undefined;
    const delay = userSearch.trim() ? 300 : 0;
    const timer = window.setTimeout(() => {
      loadUsers(userSearch, { limit: 50, offset: 0 });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [elevated, lane, userSearch, loadUsers]);

  const closeModal = () => {
    if (lane === "create") {
      setLaneChosen(true);
      setLane("active");
    }
    setSelected(null);
    setSupportUserId(null);
  };

  const setEditDraft = (tenantId, draft) => {
    setEditDrafts((current) => ({ ...current, [tenantId]: draft }));
  };

  const handleActivate = async (tenantId) => {
    setRowError((current) => ({ ...current, [tenantId]: null }));
    try {
      await activateTenant(tenantId);
      await refreshUser?.();
      setLaneChosen(true);
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
      setLaneChosen(true);
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
        name: data.tenant?.businessName || payload.name,
      });
      setCreateDraft(EMPTY_TENANT_DRAFT);
      if (data.tenant?.id) {
        setLaneChosen(true);
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
      });
    } catch (err) {
      setRowError((current) => ({ ...current, [tenant.id]: err.message }));
    }
  };

  const handleSaveUser = async (tenant, userId, payload) => {
    setUserErrors((current) => ({ ...current, [userId]: null }));
    try {
      const data = await updateTenantUser(tenant.id, userId, payload);
      if (data.tenant) {
        const current = editDrafts[tenant.id] || tenantToDraft(data.tenant);
        setEditDraft(tenant.id, {
          ...current,
          ownerName: data.tenant.ownerName || current.ownerName,
          email: data.tenant.ownerEmail || current.email,
        });
      }
    } catch (err) {
      setUserErrors((current) => ({ ...current, [userId]: err.message }));
      throw err;
    }
  };

  const handleSaveTenantHours = async (tenant, horairesOuverture) => {
    await updateTenantHours(tenant.id, horairesOuverture);
  };

  const handleSaveTenantMenuItem = async (tenant, itemId, payload) => {
    await updateTenantMenuItem(tenant.id, itemId, payload);
  };

  const handleSaveStaff = async (event, member) => {
    event.preventDefault();
    setStaffFormError(null);
    const draft = staffDrafts[member.id] || {
      name: member.name || "",
      email: member.email || "",
      password: "",
      role: member.platformRole || "ops",
    };
    try {
      const payload = {
        name: draft.name,
        email: draft.email,
      };
      if (String(draft.password || "").trim()) {
        payload.password = String(draft.password).trim();
      }
      if (draft.role && !member.isPlatformOwner) {
        payload.role = draft.role;
      }
      await updateStaff(member.id, payload);
      setStaffDrafts((current) => ({
        ...current,
        [member.id]: {
          name: draft.name,
          email: draft.email,
          password: "",
          role: draft.role || member.platformRole || "ops",
        },
      }));
    } catch (err) {
      setStaffFormError(err.message);
    }
  };

  const handleSavePlatformUser = async (event, member) => {
    event.preventDefault();
    setUserFormError(null);
    const draft = userDrafts[member.id] || {
      name: member.name || "",
      email: member.email || "",
      password: "",
      emailVerified: Boolean(member.emailVerified),
    };
    try {
      const payload = {
        name: draft.name,
        email: draft.email,
        emailVerified: Boolean(draft.emailVerified),
      };
      if (String(draft.password || "").trim()) {
        payload.password = String(draft.password).trim();
      }
      const updated = await updateUser(member.id, payload);
      setUserDrafts((current) => ({
        ...current,
        [member.id]: {
          name: updated?.name || draft.name,
          email: updated?.email || draft.email,
          password: "",
          emailVerified: Boolean(updated?.emailVerified ?? draft.emailVerified),
        },
      }));
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleChangeUserMembership = async (tenantSummary, role) => {
    setUserFormError(null);
    try {
      await updateTenantUser(tenantSummary.id, selectedUser?.id || selected?.id, { role });
      if (selected?.id) await ensureUser(selected.id);
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleRemoveUserMembership = async (tenantSummary) => {
    const label = tenantSummary.businessName || tenantSummary.name || "ce restaurant";
    if (!window.confirm(`Retirer ce compte de ${label} ?`)) return;
    setUserFormError(null);
    try {
      await removeTenantUser(tenantSummary.id, selectedUser?.id || selected?.id);
      if (selected?.id) await ensureUser(selected.id);
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleUnlockPlatformUser = async (member) => {
    setUserFormError(null);
    try {
      await updateUser(member.id, { unlockDashboard: true });
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleImpersonateUser = async (tenantSummary) => {
    setUserFormError(null);
    const userId = selectedUser?.id || selected?.id;
    if (!userId || !tenantSummary?.id) {
      setUserFormError("Impossible d'ouvrir le dashboard client.");
      return;
    }
    try {
      await impersonateUser({ userId, tenantId: tenantSummary.id });
      localStorage.setItem("tenantId", tenantSummary.id);
      window.location.assign(dashboardHomeHref());
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleOpenUserRestaurant = async (tenantSummary) => {
    setUserFormError(null);
    if (!tenantSummary?.id) {
      setUserFormError("Ce restaurant n'est plus disponible.");
      return;
    }
    try {
      const fromUserId = selected?.kind === "user" ? selected.id : supportUserId;
      const tenant = await ensureTenant(tenantSummary.id, {
        includeClosed: tenantSummary.status === "closed",
      });
      const stage = restaurantStage(tenant);
      const nextLane = [
        "pending_payment",
        "pending_compliance",
        "ready",
        "active",
        "suspended",
        "rejected",
        "closed",
      ].includes(stage)
        ? stage
        : "active";
      if (fromUserId) setSupportUserId(fromUserId);
      setLaneChosen(true);
      setLane(nextLane);
      setSelected({ kind: "tenant", id: tenant.id });
    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleCreateStaff = async ({ email, name, password, role }) => {
    setStaffFormError(null);
    setStaffCreated(null);
    try {
      const created = await createStaff({ email, name, password, role });
      setStaffCreated(created);
    } catch (err) {
      setStaffFormError(err.message);
      throw err;
    }
  };

  const handleDeleteAccount = async (item) => {
    const target = item.raw || item;
    const reason = platformUserDeleteReason(authUser, target);
    if (reason) {
      if (item.kind === "staff") setStaffFormError(reason);
      else setUserFormError(reason);
      return;
    }
    const label = target.email || target.name || "ce compte";
    const restaurants = ownedRestaurantNames(target);
    const restaurantNote = restaurants.length
      ? ` Ses restaurants seront aussi supprimés : ${restaurants.join(", ")}.`
      : " S'il possède un restaurant, celui-ci sera aussi supprimé.";
    const confirmed = window.confirm(
      `Supprimer définitivement ${label} ?${restaurantNote} Cette action est irréversible.`
    );
    if (!confirmed) return;
    setUserFormError(null);
    setStaffFormError(null);
    try {
      await deleteUser(target.id);
      if (selected?.id === target.id) setSelected(null);
    } catch (err) {
      if (item.kind === "staff") setStaffFormError(err.message);
      else setUserFormError(err.message);
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
  const selectedUser =
    selected?.kind === "user" ? users.find((item) => item.id === selected.id) : null;

  const canAcceptSelfService = (tenant) =>
    tenant.onboardedBy === "platform" || Boolean(tenant.dossierComplete);

  const renderTenantActions = (tenant) =>
    canLifecycle ? (
    <div className="platform-admin-assign">
      {(tenant.status !== "active" && tenant.status !== "suspended") ||
      isDossierAwaitingReview(tenant) ? (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyId === tenant.id || !canAcceptSelfService(tenant)}
            onClick={() => handleActivate(tenant.id)}
          >
            {tenant.status === "active" ? "Valider le dossier" : "Accepter"}
          </button>
          {tenant.status !== "active" ? (
            <>
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
          ) : null}
        </>
      ) : null}
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
      {tenant.status !== "closed" ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busyId === tenant.id}
          onClick={() => handleClose(tenant)}
        >
          Supprimer
        </button>
      ) : null}
    </div>
    ) : null;

  const renderLeadActions = (kind, item) => (
    <div className="platform-admin-assign">
      <label>
        Note interne
        <textarea
          rows={3}
          maxLength={2000}
          value={leadNotes[item.id] ?? item.internalNote ?? ""}
          onChange={(event) =>
            setLeadNotes((current) => ({ ...current, [item.id]: event.target.value }))
          }
          readOnly={!canWriteLead}
        />
      </label>
      {canWriteLead ? (
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busyId === item.id}
        onClick={() => saveLeadNote(kind, item.id, leadNotes[item.id] ?? item.internalNote ?? "")}
      >
        Enregistrer la note
      </button>
      ) : null}
      {canWriteLead && item.status === "nouveau" && (
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
      {canWriteLead ? (
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
      ) : null}
      {canConvertLead && !item.convertedTenantId ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busyId === `convert-${item.id}`}
          onClick={async () => {
            try {
              const data = await convertLead(kind, item.id);
              setConvertedLead({
                email: item.email,
                password: data.temporaryPassword,
                tenantId: data.tenant?.id,
              });
              if (data.tenant?.id) {
                setLaneChosen(true);
                setLane("active");
                setSelected({ kind: "tenant", id: data.tenant.id });
              }
            } catch (err) {
              setUserFormError(err.message);
            }
          }}
        >
          Convertir en restaurant
        </button>
      ) : null}
      {convertedLead?.tenantId && convertedLead.password ? (
        <p role="status">
          Restaurant créé. Mot de passe temporaire : {convertedLead.password}. Notez-le,
          il ne sera plus réaffiché.
        </p>
      ) : null}
    </div>
  );

  let detail = null;

  if (lane === "create" && canCreateTenant) {
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
              Le mot de passe saisi ne sera plus réaffiché.
            </p>
          )}
        </PlatformTenantEditor>
      </div>
    );
  } else if (selectedTenant) {
    const fromUser = supportUserId
      ? users.find((item) => item.id === supportUserId)
      : null;
    detail = (
      <>
        {fromUser ? (
          <div className="platform-admin-assign">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setLaneChosen(true);
                setLane("users");
                setSelected({ kind: "user", id: fromUser.id });
              }}
            >
              Retour au compte {fromUser.name || fromUser.email}
            </button>
          </div>
        ) : null}
        {convertedLead?.tenantId === selectedTenant.id && convertedLead.password ? (
          <p role="status">
            Mot de passe temporaire : {convertedLead.password}. Notez-le, il ne
            sera plus réaffiché.
          </p>
        ) : null}
        <PlatformRestaurantSupport
          tenant={selectedTenant}
          tenantId={selectedTenant.id}
          users={tenantUsers[selectedTenant.id] || []}
          usersLoading={Boolean(tenantUsersLoading[selectedTenant.id])}
          onSaveUser={
            canWriteUser
              ? (userId, payload) => handleSaveUser(selectedTenant, userId, payload)
              : undefined
          }
          onAddUser={
            canWriteMembership
              ? (payload) => addTenantUser(selectedTenant.id, payload)
              : undefined
          }
          onRemoveUser={
            canWriteMembership
              ? async (userId) => {
                  if (!window.confirm("Retirer ce compte du restaurant ?")) return;
                  await removeTenantUser(selectedTenant.id, userId);
                }
              : undefined
          }
          userBusyId={busyId}
          userErrors={userErrors}
          ops={tenantOps[selectedTenant.id]}
          opsLoading={Boolean(tenantOpsLoading[selectedTenant.id])}
          opsError={tenantOpsError[selectedTenant.id]}
          onSaveHours={
            canWriteOps
              ? (horaires) => handleSaveTenantHours(selectedTenant, horaires)
              : undefined
          }
          onSaveMenuItem={
            canWriteOps
              ? (itemId, payload) =>
                  handleSaveTenantMenuItem(selectedTenant, itemId, payload)
              : undefined
          }
          busyId={busyId}
        >
          <PlatformOnboardingTracker tenant={selectedTenant} />
          <div className="platform-admin-card">
            {selectedTenant.status === "closed" ? (
              <p>Établissement fermé. Consultation uniquement.</p>
            ) : null}
            <PlatformTenantEditor
              mode="edit"
              showAccess={false}
              tenant={{
                ...selectedTenant,
                status: STATUS_LABELS[selectedTenant.status] || selectedTenant.status,
              }}
              draft={editDrafts[selectedTenant.id] || tenantToDraft(selectedTenant)}
              onChange={(draft) => setEditDraft(selectedTenant.id, draft)}
              onSubmit={(event) => {
                if (selectedTenant.status === "closed") {
                  event.preventDefault();
                  return;
                }
                handleSaveTenant(event, selectedTenant);
              }}
              readOnly={!canWriteTenant || selectedTenant.status === "closed"}
              busy={busyId === selectedTenant.id || selectedTenant.status === "closed"}
              error={rowError[selectedTenant.id]}
              users={tenantUsers[selectedTenant.id] || []}
              usersLoading={Boolean(tenantUsersLoading[selectedTenant.id])}
              onSaveUser={
                canWriteUser
                  ? (userId, payload) => handleSaveUser(selectedTenant, userId, payload)
                  : undefined
              }
              userBusyId={busyId}
              userErrors={userErrors}
              onUploadIdentity={
                canWriteTenant
                  ? (kind, file) => uploadTenantDocument(selectedTenant.id, kind, file)
                  : undefined
              }
              uploadBusyId={busyId}
            >
              {renderTenantActions(selectedTenant)}
            </PlatformTenantEditor>
          </div>
        </PlatformRestaurantSupport>
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
  } else if (selectedStaff && canManageStaff) {
    const staffDraft = staffDrafts[selectedStaff.id] || {
      name: selectedStaff.name || "",
      email: selectedStaff.email || "",
      password: "",
      role: selectedStaff.platformRole || "ops",
    };
    detail = (
      <PlatformStaffEditor
        user={selectedStaff}
        draft={staffDraft}
        onChange={(draft) =>
          setStaffDrafts((current) => ({ ...current, [selectedStaff.id]: draft }))
        }
        onSubmit={(event) => handleSaveStaff(event, selectedStaff)}
        busy={busyId === selectedStaff.id}
        error={staffFormError}
        onRevoke={handleRevokeStaff}
        onDelete={
          selectedStaff.isPlatformOwner
            ? undefined
            : () => handleDeleteAccount({ kind: "staff", raw: selectedStaff })
        }
      />
    );
  } else if (selectedUser) {
    const userDraft = userDrafts[selectedUser.id] || {
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      password: "",
      emailVerified: Boolean(selectedUser.emailVerified),
    };
    detail = (
      <PlatformUserEditor
        user={selectedUser}
        draft={userDraft}
        onChange={(draft) =>
          setUserDrafts((current) => ({ ...current, [selectedUser.id]: draft }))
        }
        onSubmit={(event) => handleSavePlatformUser(event, selectedUser)}
        busy={Boolean(busyId)}
        error={userFormError}
        canEdit={
          canWriteUser && (!selectedUser.isPlatformAdmin || canManageStaff)
        }
        onUnlockDashboard={
          canWriteUser ? () => handleUnlockPlatformUser(selectedUser) : undefined
        }
        onOpenRestaurant={handleOpenUserRestaurant}
        onChangeMembership={canWriteMembership ? handleChangeUserMembership : undefined}
        onRemoveMembership={canWriteMembership ? handleRemoveUserMembership : undefined}
        onImpersonate={
          canImpersonate && !selectedUser.isPlatformAdmin
            ? handleImpersonateUser
            : undefined
        }
        onDelete={
          !canDeleteUser || platformUserDeleteReason(authUser, selectedUser)
            ? undefined
            : () => handleDeleteAccount({ kind: "user", raw: selectedUser })
        }
      />
    );
  }

  const staffCreateForm =
    lane === "staff" && canManageStaff ? (
      <PlatformStaffCreateForm
        onSubmit={handleCreateStaff}
        busy={busyId === "create-staff"}
        error={!selectedStaff ? staffFormError : null}
        success={
          staffCreated
            ? `Compte créé pour ${staffCreated.name || staffCreated.email}.`
            : null
        }
      />
    ) : null;

  const userSearchForm =
    lane === "users" ? (
      <form
        className="pse-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadUsers(userSearch, { limit: 50, offset: 0 });
        }}
      >
        <label className="pse-field" htmlFor="platform-user-search">
          <span className="pse-label">Rechercher un compte</span>
          <input
            id="platform-user-search"
            type="search"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Nom, e-mail, restaurant, SIRET ou n° Twilio"
            autoComplete="off"
          />
        </label>
        {usersTotal ? (
          <p className="pse-search-count">
            {usersTotal} compte{usersTotal > 1 ? "s" : ""}
          </p>
        ) : null}
        {userFormError ? (
          <p className="pse-error" role="alert">
            {userFormError}
          </p>
        ) : null}
        {usersTotal > 50 ? (
          <div className="platform-admin-assign">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={usersOffset <= 0}
              onClick={() =>
                loadUsers(userSearch, { limit: 50, offset: Math.max(0, usersOffset - 50) })
              }
            >
              Précédent
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={usersOffset + 50 >= usersTotal}
              onClick={() =>
                loadUsers(userSearch, { limit: 50, offset: usersOffset + 50 })
              }
            >
              Suivant
            </button>
          </div>
        ) : null}
      </form>
    ) : null;

  const modalOpen =
    lane === "create" ||
    Boolean(selectedTenant || selectedContact || selectedDemo || selectedStaff || selectedUser);

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
        actor={authUser}
        busyId={busyId}
        onDeleteItem={handleDeleteAccount}
        onSelectItem={(item) => {
          setSelected({ kind: item.kind, id: item.id });
          if (item.kind === "user") {
            setUserFormError(null);
            ensureUser(item.id).catch((err) => setUserFormError(err.message));
          }
        }}
        isLoading={isLoading}
        error={error}
        emptyLabel={EMPTY_LABELS[lane] || "Aucun élément."}
        listTitle={listTitle}
        hideList={lane === "create"}
        listHeader={
          <>
            {staffCreateForm}
            {userSearchForm}
          </>
        }
      />
      <PlatformOpsModal isOpen={modalOpen} onClose={closeModal}>
        {detail}
      </PlatformOpsModal>
    </PageContainer>
  );
};

export default PlatformAdmin;
