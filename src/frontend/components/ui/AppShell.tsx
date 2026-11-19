import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function GtvLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="gtv-mark" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-tight text-slate-900 sm:text-[15px]">GTV Media Sales</div>
          <div className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">
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
  const onAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="gtv-shell">
      <header className="gtv-topbar sticky top-0 z-40 flex h-auto min-h-[68px] flex-wrap items-center gap-y-1 px-4 py-2 sm:h-[68px] sm:flex-nowrap sm:px-5 sm:py-0 lg:px-8">
        <Link to="/projects" aria-label="Retour aux projets">
          <GtvLogo />
        </Link>

        <nav className="order-3 flex h-9 w-full items-center gap-1 sm:order-none sm:ml-10 sm:h-full sm:w-auto" aria-label="Navigation principale">
          <Link
            to="/projects"
            className={`relative flex h-full items-center px-3 text-sm font-semibold transition-colors ${
              onProjects ? 'text-[#0055B8]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Projets
            {onProjects && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0055B8]" />}
          </Link>
          {(user?.role === 'COMMERCIAL' || user?.role === 'ADMIN') && (
            <Link
              to="/demandes-visiteurs"
              className={`relative flex h-full items-center px-3 text-sm font-semibold transition-colors ${
                onRequests ? 'text-[#0055B8]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Demandes visiteurs
              {onRequests && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0055B8]" />}
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`relative flex h-full items-center px-3 text-sm font-semibold transition-colors ${
                onAdmin ? 'text-[#0055B8]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Administration
              {onAdmin && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0055B8]" />}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-800">{user?.name ?? 'Utilisateur'}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{user?.role}</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#eef3fb] text-xs font-bold text-[#0055B8]">
            {(user?.name ?? 'U').charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={logout}
            className="ml-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:px-3"
          >
            Quitter
          </button>
        </div>
      </header>

      {(title || eyebrow) && (
        <div className="border-b border-slate-200/80 bg-white/70 px-5 py-5 lg:px-8">
          {eyebrow && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#009A44]">{eyebrow}</div>}
          {title && <h1 className="break-words text-xl font-bold tracking-tight text-slate-900">{title}</h1>}
        </div>
      )}

      {children}
    </div>
  );
}

export function VisitorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="gtv-shell min-h-screen">
      <header className="gtv-topbar flex h-[68px] items-center px-3 sm:px-5 lg:px-10">
        <Link to="/" aria-label="Accueil GTV Media Sales">
          <GtvLogo />
        </Link>
        <nav className="ml-auto flex items-center gap-3 sm:gap-6" aria-label="Navigation visiteurs">
          <Link to="/campagne" className="hidden text-sm font-semibold text-slate-600 transition hover:text-[#0055B8] sm:inline">
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
        <span className="mx-2" aria-hidden="true">·</span>
        <a className="font-semibold text-[#0055B8] hover:underline" href="/images/credits.html">
          Crédits photos
        </a>
      </footer>
    </div>
  );
}
