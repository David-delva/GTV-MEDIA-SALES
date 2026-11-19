// =============================================================================
// GTV Media Sales — Routeur frontend (React Router v6)
// =============================================================================

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

const ProjectListPage  = lazy(() => import('./pages/ProjectListPage').then((m) => ({ default: m.ProjectListPage })));
const ProjectWorkspace = lazy(() => import('./pages/ProjectWorkspace').then((m) => ({ default: m.ProjectWorkspace })));
const QuoteSubmitPage  = lazy(() => import('./pages/QuoteSubmitPage').then((m) => ({ default: m.QuoteSubmitPage })));
const LoginPage        = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const VisitorLandingPage = lazy(() => import('./pages/VisitorLandingPage').then((m) => ({ default: m.VisitorLandingPage })));
const VisitorCampaignPage = lazy(() => import('./pages/VisitorCampaignPage').then((m) => ({ default: m.VisitorCampaignPage })));
const VisitorRequestTrackingPage = lazy(() => import('./pages/VisitorRequestTrackingPage').then((m) => ({ default: m.VisitorRequestTrackingPage })));
const VisitorRequestInboxPage = lazy(() => import('./pages/VisitorRequestInboxPage').then((m) => ({ default: m.VisitorRequestInboxPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/projects" replace />;
}

function WorkspaceRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <ProjectWorkspace
      projectId={id!}
      onSubmitSuccess={() => navigate(`/projects/${id}/submit`)}
    />
  );
}

function SubmitRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <QuoteSubmitPage
      projectId={id!}
      onSuccess={() => navigate('/projects')}
      onBack={() => navigate(`/projects/${id}`)}
    />
  );
}

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-gtv-blue-light border-t-transparent rounded-full animate-spin" />
  </div>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<VisitorLandingPage />} />
          <Route path="/campagne" element={<VisitorCampaignPage />} />
          <Route path="/demande/:token" element={<VisitorRequestTrackingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/projects" element={<RequireAuth><ProjectListPage /></RequireAuth>} />
          <Route path="/projects/:id" element={<RequireAuth><WorkspaceRoute /></RequireAuth>} />
          <Route path="/projects/:id/submit" element={<RequireAuth><SubmitRoute /></RequireAuth>} />
          <Route path="/demandes-visiteurs" element={<RequireAuth><VisitorRequestInboxPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
