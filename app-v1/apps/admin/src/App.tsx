import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { Button, Spinner } from "./components/ui";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomersPage } from "./pages/CustomersPage";

const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const JobsPage = lazy(() => import("./pages/JobsPage").then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage").then((m) => ({ default: m.JobDetailPage })));
const SalesPage = lazy(() => import("./pages/SalesPage").then((m) => ({ default: m.SalesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then((m) => ({ default: m.SupportPage })));

function Gate() {
  const { state, signOut, retryRole } = useAuth();
  switch (state.status) {
    case "loading":
      return <div className="fullscreen"><Spinner label="Vérification de la session…" /></div>;
    case "signed_out":
      return <LoginPage denied={state.denied} />;
    case "error":
      return (
        <div className="fullscreen">
          <div className="login__card">
            <h1 className="login__title">Vérification impossible</h1>
            <p className="login__sub">Impossible de vérifier votre rôle pour {state.email}. Vérifiez votre connexion puis réessayez.</p>
            <div className="login__links">
              <Button variant="primary" onClick={retryRole}>Réessayer</Button>
              <Button onClick={() => void signOut()}>Se déconnecter</Button>
            </div>
          </div>
        </div>
      );
    case "ready":
      return <Outlet />;
  }
}

function NotFound() {
  return (
    <div className="empty">
      <p className="empty__title">Page introuvable</p>
      <p className="empty__text">Cette page n'existe pas. Utilisez la navigation latérale.</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Gate />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<CustomersPage />} />
          <Route path="clients/:userId" element={<Suspense fallback={<Spinner />}><CustomerDetailPage /></Suspense>} />
          <Route path="jobs" element={<Suspense fallback={<Spinner />}><JobsPage /></Suspense>} />
          <Route path="jobs/:jobId" element={<Suspense fallback={<Spinner />}><JobDetailPage /></Suspense>} />
          <Route path="ventes" element={<Suspense fallback={<Spinner />}><SalesPage /></Suspense>} />
          <Route path="tarifs" element={<Suspense fallback={<Spinner />}><SettingsPage /></Suspense>} />
          <Route path="paiements" element={<Suspense fallback={<Spinner />}><PaymentsPage /></Suspense>} />
          <Route path="audit" element={<Suspense fallback={<Spinner />}><AuditPage /></Suspense>} />
          <Route path="support" element={<Suspense fallback={<Spinner />}><SupportPage /></Suspense>} />
          <Route path="connexion" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
