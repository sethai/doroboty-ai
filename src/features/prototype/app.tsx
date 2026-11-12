import { useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { capturePageview } from "./analytics";
import { PrototypeProvider } from "./store";
import { Shell, NotFound } from "./shell";
import HomePage from "./home";
import MethodologyPage from "./methodology";
import { JobsPage, JobPage, CompanyPage } from "./marketplace";
import {
  PersonPicker,
  RequireRole,
  WorkspaceHome,
  ProfilePage,
  SavedPage,
  ApplyPage,
  ApplicationsPage,
  ApplicationDetail,
} from "./workspace";
import { EmployerJobs, EmployerJobEditor, CompanyEditor } from "./employer";
import { SettingsPage, PrivacyPage } from "./settings";
import { CasePage } from "./case";
function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="oferty" element={<JobsPage />} />
        <Route path="oferty/:slug" element={<JobPage />} />
        <Route path="firmy/:slug" element={<CompanyPage />} />
        <Route path="metodologia" element={<MethodologyPage />} />
        <Route path="polityka-prywatnosci" element={<PrivacyPage />} />
        <Route path="auth/:mode" element={<PersonPicker />} />
        <Route
          path="aplikuj/:slug"
          element={
            <RequireRole role="candidate">
              <ApplyPage />
            </RequireRole>
          }
        />
        <Route
          path="app"
          element={
            <RequireRole>
              <WorkspaceHome />
            </RequireRole>
          }
        />
        <Route path="app/onboarding" element={<Navigate to="/app/profil" replace />} />
        <Route
          path="app/profil"
          element={
            <RequireRole role="candidate">
              <ProfilePage />
            </RequireRole>
          }
        />
        <Route
          path="app/profil/podglad"
          element={
            <RequireRole role="candidate">
              <ProfilePage preview />
            </RequireRole>
          }
        />
        <Route
          path="app/zapisane"
          element={
            <RequireRole role="candidate">
              <SavedPage />
            </RequireRole>
          }
        />
        <Route
          path="app/aplikacje"
          element={
            <RequireRole role="candidate">
              <ApplicationsPage />
            </RequireRole>
          }
        />
        <Route
          path="app/aplikacje/:id"
          element={
            <RequireRole role="candidate">
              <ApplicationDetail />
            </RequireRole>
          }
        />
        <Route
          path="app/aplikacje/:id/wyslano"
          element={
            <RequireRole role="candidate">
              <ApplicationDetail />
            </RequireRole>
          }
        />
        <Route
          path="app/oferty"
          element={
            <RequireRole role="employer">
              <EmployerJobs />
            </RequireRole>
          }
        />
        <Route
          path="app/oferty/:id"
          element={
            <RequireRole role="employer">
              <EmployerJobEditor />
            </RequireRole>
          }
        />
        <Route
          path="app/organizacja"
          element={
            <RequireRole role="employer">
              <CompanyEditor />
            </RequireRole>
          }
        />
        <Route
          path="app/kandydaci"
          element={
            <RequireRole role="employer">
              <ApplicationsPage employer />
            </RequireRole>
          }
        />
        <Route
          path="app/kandydaci/:id"
          element={
            <RequireRole role="employer">
              <ApplicationDetail employer />
            </RequireRole>
          }
        />
        <Route
          path="app/case"
          element={
            <RequireRole role="operator">
              <CasePage />
            </RequireRole>
          }
        />
        <Route path="app/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
function PageviewTracker() {
  const location = useLocation();
  // One pageview per navigation; the key check also absorbs StrictMode's
  // repeated mount effect in development.
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === location.key) return;
    lastKey.current = location.key;
    capturePageview();
  }, [location.key]);
  return null;
}
export function App() {
  return (
    <PrototypeProvider>
      <HashRouter>
        <PageviewTracker />
        <AppRoutes />
      </HashRouter>
    </PrototypeProvider>
  );
}
