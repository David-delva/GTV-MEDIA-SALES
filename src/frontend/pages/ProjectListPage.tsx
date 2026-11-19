// =============================================================================
// GTV Media Sales — Page : ProjectListPage
// Liste des projets du commercial connecté (ou tous pour ADMIN).
// =============================================================================

import React, { useEffect, useState, type FormEvent } from 'react';
import { clientsApi, projectsApi, type ClientDto, type ProjectDto } from '../services/api';
import { AppShell } from '../components/ui/AppShell';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:        { label: 'Brouillon',    color: 'bg-gray-100 text-gray-600' },
  SUBMITTED:    { label: 'Soumis',       color: 'bg-blue-100 text-blue-700' },
  NEGOTIATION:  { label: 'Négociation',  color: 'bg-amber-100 text-amber-700' },
  CLOSED_WON:   { label: 'Gagné',        color: 'bg-emerald-100 text-emerald-700' },
  CLOSED_LOST:  { label: 'Perdu',        color: 'bg-red-100 text-red-600' },
};

export function ProjectListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [budgetTarget, setBudgetTarget] = useState('');

  useEffect(() => {
    projectsApi.list()
      .then(({ data }) => setProjects(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clientsApi.list()
      .then(({ data }) => {
        setClients(data);
        if (data.length) setClientId(data[0].id);
      })
      .catch((err: Error) => setClientError(err.message));
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !clientId) {
      setCreateError('Renseignez le titre du projet et sélectionnez un annonceur.');
      return;
    }
    if (campaignStart && campaignEnd && campaignEnd < campaignStart) {
      setCreateError('La date de fin doit être postérieure ou égale à la date de début.');
      return;
    }

    const parsedBudget = budgetTarget === '' ? undefined : Number(budgetTarget);
    if (parsedBudget !== undefined && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      setCreateError('Le budget cible doit être un nombre positif.');
      return;
    }

    setCreating(true);
    try {
      const { data } = await projectsApi.create({
        title: trimmedTitle,
        clientId,
        ...(campaignStart ? { campaignStart } : {}),
        ...(campaignEnd ? { campaignEnd } : {}),
        ...(parsedBudget !== undefined ? { budgetTarget: parsedBudget } : {}),
      });
      navigate(`/projects/${data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'La création du projet a échoué.');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
  };

  return (
    <AppShell eyebrow="Espace commercial" title="Mes projets">
      <main className="mx-auto max-w-6xl px-5 py-7 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {projects.length > 0
              ? `${projects.length} projet${projects.length > 1 ? 's' : ''} dans votre portefeuille`
              : 'Votre portefeuille commercial'}
          </p>
          {(user?.role === 'COMMERCIAL' || user?.role === 'ADMIN') && (
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="inline-flex h-10 items-center rounded-lg bg-[#003189] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#002570]"
            >
              + Nouveau projet
            </button>
          )}
        </div>
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="surface-card py-16 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">+</div>
            <p className="text-base font-semibold text-slate-700">Aucun projet pour le moment</p>
            <p className="mt-1 text-sm text-slate-400">Les nouveaux projets apparaîtront dans cette vue.</p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Titre</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Budget cible</th>
                  <th className="px-4 py-3 text-right">Début</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const statusMeta = STATUS_LABELS[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={p.id} className="border-t border-slate-100 transition hover:bg-[#f8fafc]">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.reference}</td>
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {p.budgetTarget ? `${fmt(p.budgetTarget)} XAF` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {p.campaignStart ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/projects/${p.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-bold text-[#003189] transition hover:border-[#003189]/30 hover:bg-[#eef3fb]"
                        >
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreate();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#009A44]">Espace commercial</p>
                <h2 id="create-project-title" className="mt-1 text-xl font-bold text-slate-900">Nouveau projet</h2>
                <p className="mt-1 text-sm text-slate-500">Les dates et le budget peuvent être complétés ultérieurement.</p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                aria-label="Fermer"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="project-title" className="mb-1.5 block text-sm font-semibold text-slate-700">Titre du projet *</label>
                <input
                  id="project-title"
                  autoFocus
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="form-control"
                  placeholder="Ex. Campagne de fin d’année"
                />
              </div>

              <div>
                <label htmlFor="project-client" className="mb-1.5 block text-sm font-semibold text-slate-700">Annonceur *</label>
                {clientError ? (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{clientError}</p>
                ) : clients.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Aucun annonceur disponible. Ajoutez d’abord un annonceur à la base de données.
                  </p>
                ) : (
                  <select
                    id="project-client"
                    required
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="form-control"
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}{client.sector ? ` · ${client.sector}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="campaign-start" className="mb-1.5 block text-sm font-semibold text-slate-700">Début de campagne</label>
                  <input
                    id="campaign-start"
                    type="date"
                    value={campaignStart}
                    onChange={(event) => setCampaignStart(event.target.value)}
                    className="form-control"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-end" className="mb-1.5 block text-sm font-semibold text-slate-700">Fin de campagne</label>
                  <input
                    id="campaign-end"
                    type="date"
                    min={campaignStart || undefined}
                    value={campaignEnd}
                    onChange={(event) => setCampaignEnd(event.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="project-budget" className="mb-1.5 block text-sm font-semibold text-slate-700">Budget cible (XAF)</label>
                <input
                  id="project-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetTarget}
                  onChange={(event) => setBudgetTarget(event.target.value)}
                  className="form-control"
                  placeholder="Facultatif"
                />
              </div>

              {createError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {createError}
                </p>
              )}

              <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={creating}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || clients.length === 0 || Boolean(clientError)}
                  className="h-10 rounded-lg bg-[#003189] px-5 text-sm font-bold text-white transition hover:bg-[#002570] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Création…' : 'Créer le projet'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
