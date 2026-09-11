import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { isAuthenticated, isAdmin, hasDashboardAccess, fetchSession } from "./API/auth";
import ErrorBoundary from "./Components/Common/ErrorBoundary";
import Access from "./Pages/Site/Access";
import {
  StyledWebsiteLayout,
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
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
  PlatformAdmin,
  ProtectedRoute as WebsiteProtectedRoute,
} from "./Website/WebsiteRoot";
const DashboardRoot = lazy(() =>
  import("./Website/DashboardRoot").then((mod) => ({ default: mod.DashboardRoot }))
);

const Homepage = lazy(() => import("./Pages/Homepage/homepage"));
const Profile = lazy(() => import("./Pages/Profile/Profile"));
const Admin = lazy(() => import("./Pages/Admin/Admin"));
const ServiceHealth = lazy(() => import("./Pages/ServiceHealth/ServiceHealth"));
const AppointmentsPage = lazy(() => import("./Pages/AppointmentsPage/AppointmentsPage"));
const ReservationsPage = lazy(() => import("./Pages/ReservationsPage/ReservationsPage"));
const Configuration = lazy(() => import("./Pages/Configuration/Configuration"));

const FLASH_ERROR_KEY = "app_flash_error";

function DashboardProtectedRoute({ children, requireAdmin = false, requireSubscription = false, authChecked }) {
  const routeLocation = useLocation();
  if (!authChecked) return null;

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: routeLocation }} />;
  }

  if (requireAdmin && !isAdmin()) {
    sessionStorage.setItem(FLASH_ERROR_KEY, "Vous n'avez pas les privilèges pour accéder à cette page.");
    return <Navigate to="/app" replace />;
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
        <Suspense fallback={null}>
          <Routes>
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
              <Route path="api/auth/google" element={<Navigate to="/login" replace />} />
              <Route path="/api/auth/callback" element={<AuthCallback />} />
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
              <Route
                path="/admin-plateforme"
                element={
                  <WebsiteProtectedRoute>
                    <PlatformAdmin />
                  </WebsiteProtectedRoute>
                }
              />
            </Route>

            <Route element={<DashboardRoot />}>
              <Route
                path="/app"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <Homepage />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <Profile />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <AppointmentsPage />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/reservations"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <ReservationsPage />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/configuration"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireSubscription>
                    <Configuration />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireAdmin requireSubscription>
                    <Admin />
                  </DashboardProtectedRoute>
                }
              />
              <Route
                path="/admin/services"
                element={
                  <DashboardProtectedRoute authChecked={authChecked} requireAdmin requireSubscription>
                    <ServiceHealth />
                  </DashboardProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </WebsiteProviders>
    </ErrorBoundary>
  );
}

export default App;
