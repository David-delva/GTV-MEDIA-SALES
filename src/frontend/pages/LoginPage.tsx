// =============================================================================
// GTV Media Sales — Page : LoginPage
// Formulaire de connexion minimal. Appelle POST /api/auth/login.
// =============================================================================

import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../services/api';
import { GtvLogo } from '../components/ui/AppShell';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export function LoginPage() {
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();
      if (!res.ok) throw new ApiError(body.error?.code, body.error?.message, res.status);

      login(body.data.token, body.data.user);
      navigate('/projects', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) return <Navigate to="/projects" replace />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071b3a]">
      <div className="absolute inset-0 opacity-25" aria-hidden="true">
        <div className="absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full border-[80px] border-[#fcd116]/20" />
        <div className="absolute -bottom-52 -left-36 h-[520px] w-[520px] rounded-full border-[90px] border-[#009a44]/20" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden flex-col justify-between p-12 text-white lg:flex">
          <GtvLogo />
          <div className="max-w-xl pb-10">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#fcd116]">Plateforme commerciale</p>
            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight">
              Chaque campagne,<br />
              une décision éclairée.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-blue-100/75">
              Scoragez les opportunités, simulez le budget et préparez vos propositions média depuis un espace unique.
            </p>
          </div>
          <p className="text-xs text-blue-200/60">Gabon Télévisions — GTV Media Sales</p>
        </section>

        <main className="flex items-center justify-center bg-[#f7f9fc] px-6 py-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 lg:hidden"><GtvLogo /></div>
            <div className="mb-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#009a44]">Connexion sécurisée</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Bienvenue</h2>
              <p className="mt-2 text-sm text-slate-500">Accédez à votre espace commercial GTV.</p>
            </div>

            <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6 sm:p-8" noValidate>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  placeholder="commercial@gtv.ga"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-control"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#003189] px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,49,137,0.18)] transition hover:bg-[#002570] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
