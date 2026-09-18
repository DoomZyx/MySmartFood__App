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
  fetchPlatformTotpSetup,
  loginPlatformAdmin,
  rejectPlatformTenant,
  revokePlatformStaff,
  suspendPlatformTenant,
  uploadPlatformTenantDocument,
  verifyPlatformTotp,
  updateContactStatus,
  updateDemoStatus,
} from "../services/platformAdminService";

export function usePlatformAdmin() {
  const [tenants, setTenants] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demos, setDemos] = useState([]);
  const [staff, setStaff] = useState([]);
  const [tenantUsers, setTenantUsers] = useState({});
  const [tenantUsersLoading, setTenantUsersLoading] = useState({});
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
    setTenants((current) =>
      current.map((item) => (item.id === tenant.id ? tenant : item))
    );
    setFleet((current) =>
      current.map((item) => (item.id === tenant.id ? tenant : item))
    );
  };

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

  const createStaff = async ({ email, password, name }) => {
    setBusyId("create-staff");
    try {
      const data = await createPlatformStaff({ email, password, name });
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
    tenantUsers,
    tenantUsersLoading,
    loadTenantUsers,
    updateTenantUser,
    uploadTenantDocument,
  };
}
