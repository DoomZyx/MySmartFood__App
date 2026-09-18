import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { isAuthenticated, isAdmin, hasDashboardAccess, fetchSession } from "./dashboard/API/auth";
import ErrorBoundary from "./dashboard/Components/Common/ErrorBoundary";
import Access from "./dashboard/Pages/Site/Access";
import {
  StyledWebsiteLayout,
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
  Home,
  Services,
  Pricing,
  Contact,
  AuthCallback,
  MonEspace,
  MentionsLegales,
  PolitiqueConfidentialite,
  ServiceIATelephonique,
  FonctionnalitesPrevues,
  Onboarding,
  ProtectedRoute as WebsiteProtectedRoute,
} from "./app/WebsiteRoot";
import { PLATFORM_ADMIN_PATH, isPlatformAdminPath } from "@shared/platformAdminPath";
import { DASHBOARD_PATH, dashboardPagePath, openDashboard } from "@shared/dashboardPath";
import { isDashboardPath, useWebsiteStyles } from "./app/WebsiteRoot";
import { PlatformAdminScreen } from "./site/components/Shared/PlatformAdminShell/PlatformAdminShell";
import { useAuth } from "./site/hooks/useAuth";
import { isPlatformAdminUser } from "@shared/postSiteAuthPath";
const DashboardRoot = lazy(() =>
  import("./app/DashboardRoot").then((mod) => ({ default: mod.DashboardRoot }))
);

const Homepage = lazy(() => import("./dashboard/Pages/Homepage/homepage"));
const Profile = lazy(() => import("./dashboard/Pages/Profile/Profile"));
const Admin = lazy(() => import("./dashboard/Pages/Admin/Admin"));
const ServiceHealth = lazy(() => import("./dashboard/Pages/ServiceHealth/ServiceHealth"));
const AppointmentsPage = lazy(() => import("./dashboard/Pages/AppointmentsPage/AppointmentsPage"));
const ReservationsPage = lazy(() => import("./dashboard/Pages/ReservationsPage/ReservationsPage"));
const Configuration = lazy(() => import("./dashboard/Pages/Configuration/Configuration"));

const FLASH_ERROR_KEY = "app_flash_error";

const PLATFORM_ADMIN_ENTRY_PATHS = new Set(["/login", "/register"]);

function UnknownRoute() {
  const { pathname } = useLocation();
  if (isPlatformAdminPath(pathname)) {
    return <Navigate to={PLATFORM_ADMIN_PATH} replace />;
  }
  return <Navigate to="/" replace />;
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

function DashboardEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    openDashboard(navigate);
  }, [navigate]);
  return null;
}

function DashboardProtectedRoute({ children, requireAdmin = false, requireSubscription = false, authChecked }) {
  const routeLocation = useLocation();
  if (!authChecked) return null;

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: routeLocation }} />;
  }

  if (requireAdmin && !isAdmin()) {
    sessionStorage.setItem(FLASH_ERROR_KEY, "Vous n'avez pas les privilèges pour accéder à cette page.");
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  if (requireSubscription && !hasDashboardAccess()) {
    return <Navigate to="/mon-espace" replace />;
  }

  return children;
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [flashError, setFlashError] = useState(null);
  const location = useLocation();
  const onDashboard = isDashboardPath(location.pathname);
  useWebsiteStyles();

  useLayoutEffect(() => {
    document.documentElement.dataset.app = onDashboard ? "dashboard" : "website";
  }, [onDashboard]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchSession();
      if (!cancelled) setAuthChecked(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const msg = sessionStorage.getItem(FLASH_ERROR_KEY);
    if (msg) {
      sessionStorage.removeItem(FLASH_ERROR_KEY);
      setFlashError(msg);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!flashError) return;
    const t = setTimeout(() => setFlashError(null), 5000);
    return () => clearTimeout(t);
  }, [flashError]);

  return (
    <ErrorBoundary>
      {flashError && (
        <div className="notification-toast error-message" style={{ position: "fixed", top: "1rem", left: "50%", transform: "translateX(-50%)", zIndex: 9999 }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span className="message-content">{flashError}</span>
        </div>
      )}
      <WebsiteProviders>
        <PlatformAdminEntryRedirect />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/bf-admin" element={<PlatformAdminScreen />} />
            <Route path="/x/bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4" element={<PlatformAdminScreen />} />

            <Route element={<StyledWebsiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/tarifs" element={<Navigate to="/pricing" replace />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              <Route path="/service-ia-telephonique" element={<ServiceIATelephonique />} />
              <Route path="/fonctionnalites-prevues" element={<FonctionnalitesPrevues />} />
              <Route path="/login" element={<LoginRedirect />} />
              <Route path="/register" element={<LoginRedirect />} />
              <Route path="/api/auth/google" element={<GoogleStartRedirect />} />
              <Route path="/api/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/api/auth/google/callback" element={<GoogleCallbackRedirect />} />
              <Route path="/access" element={<Access />} />
              <Route
                path="/mon-espace"
                element={
                  <WebsiteProtectedRoute>
                    <MonEspace />
                  </WebsiteProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <WebsiteProtectedRoute>
                    <Onboarding />
                  </WebsiteProtectedRoute>
                }
              />
            </Route>

            <Route path="/app" element={<DashboardEntry />} />

            <Route element={<DashboardRoot />}>
              <Route
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <Outlet />
                  </DashboardProtectedRoute>
                }
              >
                <Route path={DASHBOARD_PATH} element={<Homepage />} />
                <Route path={dashboardPagePath("profile")} element={<Profile />} />
                <Route path={dashboardPagePath("orders")} element={<AppointmentsPage />} />
                <Route path={dashboardPagePath("reservations")} element={<ReservationsPage />} />
                <Route path={dashboardPagePath("configuration")} element={<Configuration />} />
                <Route path={dashboardPagePath("monitoring")} element={<ServiceHealth />} />
              </Route>
              <Route
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireAdmin requireSubscription>
                    <Outlet />
                  </DashboardProtectedRoute>
                }
              >
                <Route path={dashboardPagePath("admin")} element={<Admin />} />
              </Route>
              <Route path="/profile" element={<Navigate to={dashboardPagePath("profile")} replace />} />
              <Route path="/orders" element={<Navigate to={dashboardPagePath("orders")} replace />} />
              <Route path="/reservations" element={<Navigate to={dashboardPagePath("reservations")} replace />} />
              <Route path="/configuration" element={<Navigate to={dashboardPagePath("configuration")} replace />} />
              <Route path="/monitoring" element={<Navigate to={dashboardPagePath("monitoring")} replace />} />
              <Route path="/admin/services" element={<Navigate to={dashboardPagePath("monitoring")} replace />} />
              <Route path="/admin" element={<Navigate to={dashboardPagePath("admin")} replace />} />
            </Route>

            <Route path="*" element={<UnknownRoute />} />
          </Routes>
        </Suspense>
      </WebsiteProviders>
    </ErrorBoundary>
  );
}

export default App;
