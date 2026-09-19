import { useCallback, useState } from "react";
import {
  activatePlatformTenant,
  assignPlatformPhone,
  closePlatformTenant,
  confirmPlatformTotp,
  createPlatformStaff,
  createPlatformTenant,
  fetchPlatformTenantUsers,
  updatePlatformStaff,
  updatePlatformTenant,
  updatePlatformTenantUser,
  elevateDevPlatformAdmin,
  fetchPlatformChallenge,
  fetchPlatformInbox,
  fetchPlatformSession,
  fetchPlatformStaff,
  fetchPlatformTenants,
  fetchPlatformTenant,
  fetchPlatformTenantOps,
  fetchPlatformTotpSetup,
  fetchPlatformUser,
  fetchPlatformUsers,
  addPlatformTenantUser,
  removePlatformTenantUser,
  updatePlatformLeadNote,
  convertPlatformLead,
  updatePlatformUser,
  deletePlatformUser,
  updatePlatformTenantHours,
  updatePlatformTenantMenuItem,
  loginPlatformAdmin,
  rejectPlatformTenant,
  revokePlatformStaff,
  suspendPlatformTenant,
  uploadPlatformTenantDocument,
  verifyPlatformTotp,
  updateContactStatus,
  updateDemoStatus,
  startPlatformImpersonation,
} from "../services/platformAdminService";

export function usePlatformAdmin() {
  const [tenants, setTenants] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demos, setDemos] = useState([]);
  const [staff, setStaff] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const [closed, setClosed] = useState([]);
  const [tenantUsers, setTenantUsers] = useState({});
  const [tenantUsersLoading, setTenantUsersLoading] = useState({});
  const [tenantOps, setTenantOps] = useState({});
  const [tenantOpsLoading, setTenantOpsLoading] = useState({});
  const [tenantOpsError, setTenantOpsError] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [elevated, setElevated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [totpStep, setTotpStep] = useState(null);
  const [totpSetup, setTotpSetup] = useState(null);

  const checkSession = useCallback(async () => {
    setIsCheckingSession(true);
    try {
      const session = await fetchPlatformSession();
      if (session?.platformVerified) {
        setElevated(true);
        setTotpStep(null);
        return {
          elevated: true,
          user: session.user
            ? { ...session.user, tenants: session.tenants || session.user.tenants }
            : null,
        };
      }
      const devSession = await elevateDevPlatformAdmin();
      if (devSession?.platformVerified) {
        setElevated(true);
        setTotpStep(null);
        return {
          elevated: true,
          user: devSession.user
            ? { ...devSession.user, tenants: devSession.tenants || devSession.user.tenants }
            : null,
        };
      }
      const challenge = await fetchPlatformChallenge();
      setElevated(false);
      setTotpStep(challenge?.totpStep || null);
      return { elevated: false, totpStep: challenge?.totpStep || null };
    } catch (err) {
      setElevated(false);
      setError(err.message);
      return { elevated: false };
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  const login = async ({ email, password, accessCode }) => {
    setError(null);
    const data = await loginPlatformAdmin({ email, password, accessCode });
    if (data.platformVerified) {
      setElevated(true);
      setTotpStep(null);
    } else {
      setElevated(false);
      setTotpStep(data.totpStep || null);
    }
    return data;
  };

  const loadTotpSetup = useCallback(async () => {
    const setup = await fetchPlatformTotpSetup();
    setTotpSetup(setup);
    return setup;
  }, []);

  const finishTotp = useCallback(async (token) => {
    const data =
      totpStep === "enroll"
        ? await confirmPlatformTotp(token)
        : await verifyPlatformTotp(token);
    setElevated(Boolean(data.platformVerified));
    setTotpStep(null);
    setTotpSetup(null);
    if (!data.user) return data;
    return { ...data.user, tenants: data.tenants || data.user.tenants };
  }, [totpStep]);

  const loadInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchPlatformInbox();
      const data = payload.data || {};
      setTenants(data.tenants || []);
      setContacts(data.contacts || []);
      setDemos(data.demos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async (status, queue) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformTenants(status, queue);
      setTenants(data.tenants || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFleet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformTenants(undefined, "fleet");
      setFleet(data.tenants || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const replaceTenant = (tenant) => {
    const replace = (current) =>
      current.map((item) => (item.id === tenant.id ? tenant : item));
    setTenants(replace);
    setFleet(replace);
    setClosed(replace);
  };

  const upsertTenant = (tenant) => {
    if (!tenant?.id) return;
    const merge = (current) => {
      const index = current.findIndex((item) => item.id === tenant.id);
      if (index === -1) return [tenant, ...current];
      const next = current.slice();
      next[index] = tenant;
      return next;
    };
    setTenants(merge);
    setFleet(merge);
  };

  const ensureTenant = useCallback(async (tenantId, { includeClosed = false } = {}) => {
    setBusyId(tenantId);
    try {
      const data = await fetchPlatformTenant(tenantId, { includeClosed });
      if (!data.tenant) {
        throw new Error("Restaurant introuvable");
      }
      if (data.tenant.status === "closed") {
        setClosed((current) => {
          const index = current.findIndex((item) => item.id === data.tenant.id);
          if (index === -1) return [data.tenant, ...current];
          const next = current.slice();
          next[index] = data.tenant;
          return next;
        });
      } else {
        upsertTenant(data.tenant);
      }
      return data.tenant;
    } finally {
      setBusyId(null);
    }
  }, []);

  const uploadTenantDocument = async (tenantId, kind, file) => {
    setBusyId(`${tenantId}:${kind}`);
    try {
      const data = await uploadPlatformTenantDocument(tenantId, kind, file);
      if (data.tenant) replaceTenant(data.tenant);
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const assignPhone = async (tenantId, payload) => {
    setBusyId(tenantId);
    setError(null);
    try {
      const data = await assignPlatformPhone(tenantId, payload);
      replaceTenant(data.tenant);
      return data.tenant;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const activateTenant = async (tenantId) => {
    setBusyId(tenantId);
    setError(null);
    try {
      const data = await activatePlatformTenant(tenantId);
      setTenants((current) => current.filter((item) => item.id !== tenantId));
      setClosed((current) => current.filter((item) => item.id !== tenantId));
      setTenantOpsError((current) => ({ ...current, [tenantId]: null }));
      setFleet((current) => {
        const next = data.tenant;
        if (current.some((item) => item.id === tenantId)) {
          return current.map((item) => (item.id === tenantId ? next : item));
        }
        return [next, ...current];
      });
      return data.tenant;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const suspendTenant = async (tenantId) => {
    setBusyId(tenantId);
    setError(null);
    try {
      const data = await suspendPlatformTenant(tenantId);
      replaceTenant(data.tenant);
      return data.tenant;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const rejectTenant = async (tenantId, reason) => {
    setBusyId(tenantId);
    setError(null);
    try {
      const data = await rejectPlatformTenant(tenantId, reason);
      setTenants((current) => current.filter((item) => item.id !== tenantId));
      return data.tenant;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const closeTenant = async (tenantId) => {
    setBusyId(tenantId);
    setError(null);
    try {
      const data = await closePlatformTenant(tenantId);
      setTenants((current) => current.filter((item) => item.id !== tenantId));
      setFleet((current) => current.filter((item) => item.id !== tenantId));
      if (data.tenant) {
        setClosed((current) => [
          { ...data.tenant, status: "closed" },
          ...current.filter((item) => item.id !== tenantId),
        ]);
      } else {
        setClosed((current) => [
          { id: tenantId, status: "closed" },
          ...current.filter((item) => item.id !== tenantId),
        ]);
      }
      return data.tenant;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const markContact = async (id, status) => {
    setBusyId(id);
    try {
      await updateContactStatus(id, status);
      setContacts((current) =>
        status === "traite" || status === "archive"
          ? current.filter((item) => item.id !== id)
          : current.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformStaff();
      setStaff(data.staff || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (search, { limit = 50, offset = 0 } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformUsers(search, { limit, offset });
      setUsers(data.users || []);
      setUsersTotal(data.total || 0);
      setUsersOffset(offset);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadClosed = useCallback(async () => {
    try {
      const data = await fetchPlatformTenants(undefined, "closed");
      setClosed(data.tenants || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const ensureUser = useCallback(async (userId) => {
    const data = await fetchPlatformUser(userId);
    if (!data.user) throw new Error("Utilisateur introuvable");
    setUsers((current) => {
      const index = current.findIndex((item) => item.id === data.user.id);
      if (index === -1) return [data.user, ...current];
      const next = current.slice();
      next[index] = data.user;
      return next;
    });
    return data.user;
  }, []);

  const deleteUser = async (userId) => {
    setBusyId(userId);
    try {
      const data = await deletePlatformUser(userId);
      const tenantIds = new Set(data.tenantIds || []);
      setUsers((current) => current.filter((item) => item.id !== userId));
      setUsersTotal((current) => Math.max(0, current - 1));
      setStaff((current) => current.filter((item) => item.id !== userId));
      if (tenantIds.size) {
        const dropOwned = (list) => list.filter((item) => !tenantIds.has(item.id));
        setTenants(dropOwned);
        setFleet(dropOwned);
        setClosed(dropOwned);
      }
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const updateUser = async (userId, payload) => {
    setBusyId(userId);
    try {
      const data = await updatePlatformUser(userId, payload);
      if (data.user) {
        setUsers((current) =>
          current.map((item) => (item.id === data.user.id ? data.user : item))
        );
      }
      return data.user;
    } finally {
      setBusyId(null);
    }
  };

  const createTenant = async (payload) => {
    setBusyId("create-tenant");
    try {
      const data = await createPlatformTenant(payload);
      if (data.tenant) {
        setFleet((current) => [
          data.tenant,
          ...current.filter((item) => item.id !== data.tenant.id),
        ]);
      }
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const updateTenant = async (tenantId, payload) => {
    setBusyId(tenantId);
    try {
      const data = await updatePlatformTenant(tenantId, payload);
      if (data.tenant) replaceTenant(data.tenant);
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const loadTenantUsers = useCallback(async (tenantId) => {
    if (!tenantId) return [];
    setTenantUsersLoading((current) => ({ ...current, [tenantId]: true }));
    try {
      const data = await fetchPlatformTenantUsers(tenantId);
      const users = data.users || [];
      setTenantUsers((current) => ({ ...current, [tenantId]: users }));
      return users;
    } finally {
      setTenantUsersLoading((current) => ({ ...current, [tenantId]: false }));
    }
  }, []);

  const loadTenantOps = useCallback(async (tenantId) => {
    if (!tenantId) return null;
    setTenantOpsLoading((current) => ({ ...current, [tenantId]: true }));
    setTenantOpsError((current) => ({ ...current, [tenantId]: null }));
    try {
      const data = await fetchPlatformTenantOps(tenantId);
      setTenantOps((current) => ({ ...current, [tenantId]: data }));
      return data;
    } catch (err) {
      setTenantOpsError((current) => ({ ...current, [tenantId]: err.message }));
      throw err;
    } finally {
      setTenantOpsLoading((current) => ({ ...current, [tenantId]: false }));
    }
  }, []);

  const updateTenantHours = async (tenantId, horairesOuverture) => {
    setBusyId("hours");
    try {
      const data = await updatePlatformTenantHours(tenantId, horairesOuverture);
      setTenantOps((current) => ({ ...current, [tenantId]: data }));
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const updateTenantMenuItem = async (tenantId, itemId, payload) => {
    setBusyId(itemId);
    try {
      const data = await updatePlatformTenantMenuItem(tenantId, itemId, payload);
      setTenantOps((current) => ({ ...current, [tenantId]: data }));
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const addTenantUser = async (tenantId, payload) => {
    setBusyId("add-member");
    try {
      const data = await addPlatformTenantUser(tenantId, payload);
      if (data.users) {
        setTenantUsers((current) => ({ ...current, [tenantId]: data.users }));
      }
      if (data.tenant) replaceTenant(data.tenant);
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const removeTenantUser = async (tenantId, userId) => {
    setBusyId(userId);
    try {
      const data = await removePlatformTenantUser(tenantId, userId);
      if (data.users) {
        setTenantUsers((current) => ({ ...current, [tenantId]: data.users }));
      }
      if (data.tenant) replaceTenant(data.tenant);
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const saveLeadNote = async (kind, leadId, internalNote) => {
    setBusyId(leadId);
    try {
      const data = await updatePlatformLeadNote(kind, leadId, internalNote);
      if (kind === "contact" && data.contact) {
        setContacts((current) =>
          current.map((item) => (item.id === data.contact.id ? data.contact : item))
        );
      }
      if (kind === "demo" && data.demo) {
        setDemos((current) =>
          current.map((item) => (item.id === data.demo.id ? data.demo : item))
        );
      }
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const convertLead = async (kind, leadId) => {
    setBusyId(`convert-${leadId}`);
    try {
      const data = await convertPlatformLead(kind, leadId);
      if (data.tenant) upsertTenant(data.tenant);
      if (kind === "contact") {
        setContacts((current) => current.filter((item) => item.id !== leadId));
      } else {
        setDemos((current) => current.filter((item) => item.id !== leadId));
      }
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const updateTenantUser = async (tenantId, userId, payload) => {
    setBusyId(userId);
    try {
      const data = await updatePlatformTenantUser(tenantId, userId, payload);
      if (data.users) {
        setTenantUsers((current) => ({ ...current, [tenantId]: data.users }));
      } else if (data.user) {
        setTenantUsers((current) => ({
          ...current,
          [tenantId]: (current[tenantId] || []).map((item) =>
            item.id === data.user.id ? data.user : item
          ),
        }));
      }
      if (data.tenant) replaceTenant(data.tenant);
      return data;
    } finally {
      setBusyId(null);
    }
  };

  const impersonateUser = async ({ userId, tenantId }) => {
    setBusyId("impersonate");
    try {
      return await startPlatformImpersonation({ userId, tenantId });
    } finally {
      setBusyId(null);
    }
  };

  const createStaff = async ({ email, password, name, role }) => {
    setBusyId("create-staff");
    try {
      const data = await createPlatformStaff({ email, password, name, role });
      if (data.staff) {
        setStaff((current) => {
          const others = current.filter((item) => item.id !== data.staff.id);
          return [...others, data.staff].sort((left, right) => {
            if (left.isPlatformOwner !== right.isPlatformOwner) {
              return left.isPlatformOwner ? -1 : 1;
            }
            return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
          });
        });
      }
      return data.staff;
    } finally {
      setBusyId(null);
    }
  };

  const revokeStaff = async (userId) => {
    setBusyId(userId);
    try {
      await revokePlatformStaff(userId);
      setStaff((current) => current.filter((item) => item.id !== userId));
    } finally {
      setBusyId(null);
    }
  };

  const updateStaff = async (userId, payload) => {
    setBusyId(userId);
    try {
      const data = await updatePlatformStaff(userId, payload);
      if (data.staff) {
        setStaff((current) =>
          current.map((item) => (item.id === data.staff.id ? data.staff : item))
        );
      }
      return data.staff;
    } finally {
      setBusyId(null);
    }
  };

  const markDemo = async (id, status) => {
    setBusyId(id);
    try {
      await updateDemoStatus(id, status);
      setDemos((current) =>
        status === "traite" || status === "archive"
          ? current.filter((item) => item.id !== id)
          : current.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  return {
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
    loadTenants,
    loadFleet,
    createTenant,
    updateTenant,
    assignPhone,
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
    impersonateUser,
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
  };
}
