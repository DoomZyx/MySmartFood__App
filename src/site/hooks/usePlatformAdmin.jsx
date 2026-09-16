import { useCallback, useState } from "react";
import {
  activatePlatformTenant,
  assignPlatformPhone,
  closePlatformTenant,
  confirmPlatformTotp,
  fetchPlatformChallenge,
  fetchPlatformInbox,
  fetchPlatformSession,
  fetchPlatformTenants,
  fetchPlatformTotpSetup,
  loginPlatformAdmin,
  rejectPlatformTenant,
  suspendPlatformTenant,
  verifyPlatformTotp,
  updateContactStatus,
  updateDemoStatus,
} from "../services/platformAdminService";

export function usePlatformAdmin() {
  const [tenants, setTenants] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demos, setDemos] = useState([]);
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
        return { elevated: true };
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
    setElevated(false);
    setTotpStep(data.totpStep || null);
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
    return data.user ?? data;
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
    assignPhone,
    activateTenant,
    suspendTenant,
    closeTenant,
    rejectTenant,
    markContact,
    markDemo,
  };
}
