import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function GtvLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="gtv-mark" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-slate-900">GTV Media Sales</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Gabon Télévisions
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  children,
  title,
  eyebrow,
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const onProjects = location.pathname.startsWith('/projects');
  const onRequests = location.pathname.startsWith('/demandes-visiteurs');

  return (
    <div className="gtv-shell">
      <header className="gtv-topbar sticky top-0 z-40 flex items-center px-5 lg:px-8">
        <Link to="/projects" aria-label="Retour aux projets">
          <GtvLogo />
        </Link>

        <nav className="ml-10 flex h-full items-center gap-1" aria-label="Navigation principale">
          <Link
            to="/projects"
            className={`relative flex h-full items-center px-3 text-sm font-semibold transition-colors ${
              onProjects ? 'text-[#003189]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Projets
            {onProjects && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#003189]" />}
          </Link>
          {(user?.role === 'COMMERCIAL' || user?.role === 'ADMIN') && (
            <Link
              to="/demandes-visiteurs"
              className={`relative flex h-full items-center px-3 text-sm font-semibold transition-colors ${
                onRequests ? 'text-[#003189]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Demandes visiteurs
              {onRequests && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#003189]" />}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-800">{user?.name ?? 'Utilisateur'}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{user?.role}</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#eef3fb] text-xs font-bold text-[#003189]">
            {(user?.name ?? 'U').charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={logout}
            className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Quitter
          </button>
        </div>
      </header>

      {(title || eyebrow) && (
        <div className="border-b border-slate-200/80 bg-white/70 px-5 py-5 lg:px-8">
          {eyebrow && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#009A44]">{eyebrow}</div>}
          {title && <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>}
        </div>
      )}

      {children}
    </div>
  );
}

export function VisitorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="gtv-shell min-h-screen">
      <header className="gtv-topbar flex items-center px-5 lg:px-10">
        <Link to="/" aria-label="Accueil GTV Media Sales">
          <GtvLogo />
        </Link>
        <nav className="ml-auto flex items-center gap-3 sm:gap-6" aria-label="Navigation visiteurs">
          <Link to="/campagne" className="hidden text-sm font-semibold text-slate-600 transition hover:text-[#003189] sm:inline">
            Préparer ma campagne
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4 sm:text-sm"
          >
            Espace commercial
          </Link>
        </nav>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white px-5 py-5 text-center text-xs text-slate-400">
        GTV Media Sales · Gabon Télévisions · Les simulations et demandes sont indicatives et sans engagement.
      </footer>
    </div>
  );
}
