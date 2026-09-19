import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { isAuthenticated, isAdmin, hasDashboardAccess, fetchSession } from "./dashboard/API/auth";
import ErrorBoundary from "./dashboard/Components/Common/ErrorBoundary";
import { PLATFORM_ADMIN_PATH, isPlatformAdminPath } from "@shared/platformAdminPath";
import {
  DASHBOARD_PATH,
  LEGACY_DASHBOARD_PATH,
  dashboardPagePath,
  rewriteLegacyDashboardPath,
} from "@shared/dashboardPath";
import { leaveApiHostHref } from "@shared/publicSite";
import { isDashboardPath, useWebsiteStyles } from "./app/websiteFlags";

const DashboardRoot = lazy(() =>
  import("./app/DashboardRoot").then((mod) => ({ default: mod.DashboardRoot }))
);
const DashboardShell = lazy(() =>
  import("./app/DashboardShell.jsx").then((mod) => ({ default: mod.DashboardShell }))
);
const PlatformAdminRoute = lazy(() => import("./app/PlatformAdminRoute"));
const StyledWebsiteLayout = lazy(() =>
  import("./app/WebsiteRoot").then((mod) => ({ default: mod.StyledWebsiteLayout }))
);
const LoginRedirect = lazy(() =>
  import("./app/WebsiteRoot").then((mod) => ({ default: mod.LoginRedirect }))
);
const GoogleCallbackRedirect = lazy(() =>
  import("./app/WebsiteRoot").then((mod) => ({ default: mod.GoogleCallbackRedirect }))
);
const GoogleStartRedirect = lazy(() =>
  import("./app/WebsiteRoot").then((mod) => ({ default: mod.GoogleStartRedirect }))
);
const WebsiteProtectedRoute = lazy(() => import("@site/components/Auth/ProtectedRoute"));
const Access = lazy(() => import("./dashboard/Pages/Site/Access"));
const Homepage = lazy(() => import("./dashboard/Pages/Homepage/homepage"));
const Profile = lazy(() => import("./dashboard/Pages/Profile/Profile"));
const Admin = lazy(() => import("./dashboard/Pages/Admin/Admin"));
const ServiceHealth = lazy(() => import("./dashboard/Pages/ServiceHealth/ServiceHealth"));
const AppointmentsPage = lazy(() => import("./dashboard/Pages/AppointmentsPage/AppointmentsPage"));
const ReservationsPage = lazy(() => import("./dashboard/Pages/ReservationsPage/ReservationsPage"));
const Configuration = lazy(() => import("./dashboard/Pages/Configuration/Configuration"));
const Home = lazy(() => import("@site/pages/Home"));
const Services = lazy(() => import("@site/pages/Services"));
const Pricing = lazy(() => import("@site/pages/Pricing"));
const Contact = lazy(() => import("@site/pages/Contact"));
const AuthCallback = lazy(() => import("@site/pages/AuthCallback"));
const MonEspace = lazy(() => import("@site/pages/MonEspace"));
const MentionsLegales = lazy(() => import("@site/pages/MentionsLegales"));
const PolitiqueConfidentialite = lazy(() => import("@site/pages/PolitiqueConfidentialite"));
const ServiceIATelephonique = lazy(() => import("@site/pages/ServiceIATelephonique"));
const FonctionnalitesPrevues = lazy(() => import("@site/pages/FonctionnalitesPrevues"));
const Onboarding = lazy(() => import("@site/pages/Onboarding"));

const FLASH_ERROR_KEY = "app_flash_error";

function UnknownRoute() {
  const { pathname } = useLocation();
  if (isPlatformAdminPath(pathname)) {
    return <Navigate to={PLATFORM_ADMIN_PATH} replace />;
  }
  return <Navigate to="/" replace />;
}

function LeaveApiHost() {
  useLayoutEffect(() => {
    const href = leaveApiHostHref();
    if (href) window.location.replace(href);
  }, []);
  return null;
}

function LegacyDashboardRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${rewriteLegacyDashboardPath(pathname)}${search}`} replace />;
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
    if (!onDashboard) {
      setAuthChecked(true);
      return undefined;
    }
    setAuthChecked(false);
    let cancelled = false;
    (async () => {
      await fetchSession();
      if (!cancelled) setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onDashboard]);

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
      <LeaveApiHost />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/bf-admin" element={<PlatformAdminRoute />} />
          <Route
            path="/x/bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4"
            element={<PlatformAdminRoute />}
          />

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

          <Route path={LEGACY_DASHBOARD_PATH} element={<LegacyDashboardRedirect />} />
          <Route path={`${LEGACY_DASHBOARD_PATH}/*`} element={<LegacyDashboardRedirect />} />

          <Route element={<DashboardRoot />}>
            <Route
              element={
                <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                  <DashboardShell />
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
                  <DashboardShell />
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
    </ErrorBoundary>
  );
}

export default App;
