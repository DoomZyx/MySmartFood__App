import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import CookieBanner from "./components/Shared/CookieBanner/CookieBanner";
import ScrollToTop from "./components/Shared/ScrollToTop/ScrollToTop";
import DemoModal from "./components/Shared/DemoModal/DemoModal";
import LoginModal from "./components/Shared/LoginModal/LoginModal";
import DossierAcceptedNotice from "./components/Shared/DossierAcceptedNotice/DossierAcceptedNotice";
import { DemoModalProvider, useDemoModal } from "./contexts/DemoModalContext";
import { LoginModalProvider, useLoginModal } from "./contexts/LoginModalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AnimationProvider } from "./components/Shared/AnimationProvider/AnimationProvider";
import ErrorBoundary from "./components/Shared/ErrorBoundary/ErrorBoundary";
import { PLATFORM_ADMIN_PATH, isPlatformAdminPath } from "./utils/platformAdminPath";
import { openDashboard } from "./utils/dashboardPath";
import { apiBaseUrl } from "./services/apiBase";
import { useAuth } from "./hooks/useAuth";
import { isPlatformAdminUser } from "@shared/postSiteAuthPath";

const PLATFORM_ADMIN_ENTRY_PATHS = new Set(["/login", "/register"]);

function redirectToApi(pathWithSearch) {
  const apiBase = apiBaseUrl();
  if (!apiBase) return;
  const target = `${apiBase}${pathWithSearch}`;
  try {
    if (new URL(target).origin === window.location.origin) return;
  } catch {
    return;
  }
  window.location.assign(target);
}

export function DashboardEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    openDashboard(navigate);
  }, [navigate]);
  return <div>Redirection...</div>;
}

export function GoogleCallbackRedirect() {
  useEffect(() => {
    redirectToApi(`/api/auth/google/callback${window.location.search}`);
  }, []);
  return <div>Redirection...</div>;
}

export function GoogleStartRedirect() {
  useEffect(() => {
    const search = window.location.search || "?return=site";
    redirectToApi(`/api/auth/google${search}`);
  }, []);
  return <div>Redirection...</div>;
}

function PlatformAdminEntryRedirect() {
  const { user, isInitialized } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInitialized || !isPlatformAdminUser(user)) return;
    if (isPlatformAdminPath(pathname)) return;
    if (!PLATFORM_ADMIN_ENTRY_PATHS.has(pathname)) return;
    navigate(PLATFORM_ADMIN_PATH, { replace: true });
  }, [isInitialized, user, pathname, navigate]);

  return null;
}

export function LoginRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    const from = location.state?.from;
    const fromPath = typeof from?.pathname === "string" ? from.pathname : "";
    if (isPlatformAdminPath(fromPath)) {
      navigate(fromPath || PLATFORM_ADMIN_PATH, { replace: true });
      return;
    }
    const planIdParam = searchParams.get("planId");
    const planId = planIdParam ? parseInt(planIdParam, 10) : undefined;
    const authError = searchParams.get("error");
    openLoginModal({
      planId: Number.isInteger(planId) ? planId : undefined,
      from,
      error: authError,
    });
    navigate("/", { replace: true });
  }, [location.state?.from, searchParams, openLoginModal, navigate]);

  return null;
}

export function WebsiteLayout() {
  const { isDemoModalOpen, closeDemoModal } = useDemoModal();
  const { isLoginModalOpen, closeLoginModal } = useLoginModal();

  return (
    <div className="App">
      <PlatformAdminEntryRedirect />
      <ScrollToTop />
      <Header />
      <Outlet />
      <Footer />
      <CookieBanner />
      <DemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <DossierAcceptedNotice />
    </div>
  );
}

export function WebsiteProviders({ children }) {
  return (
    <ErrorBoundary>
      <AnimationProvider>
        <AuthProvider>
          <DemoModalProvider>
            <LoginModalProvider>{children}</LoginModalProvider>
          </DemoModalProvider>
        </AuthProvider>
      </AnimationProvider>
    </ErrorBoundary>
  );
}
