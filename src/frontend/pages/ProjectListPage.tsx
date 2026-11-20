// =============================================================================
// GTV Media Sales — Page : ProjectListPage
// Liste des projets du commercial connecté (ou tous pour ADMIN).
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  clientsApi,
  projectFollowUpsApi,
  projectsApi,
  type ClientDto,
  type ProjectDto,
  type ProjectFollowUpDto,
} from '../services/api';
import { AppShell } from '../components/ui/AppShell';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { downloadCsv } from '../../utils/csv';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:        { label: 'Brouillon',    color: 'bg-gray-100 text-gray-600' },
  SUBMITTED:    { label: 'Soumis',       color: 'bg-gtv-blue-light/10 text-gtv-blue-dark' },
  NEGOTIATION:  { label: 'Négociation',  color: 'bg-amber-100 text-amber-700' },
  CLOSED_WON:   { label: 'Gagné',        color: 'bg-emerald-100 text-emerald-700' },
  CLOSED_LOST:  { label: 'Perdu',        color: 'bg-red-100 text-red-600' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'],
  NEGOTIATION: ['CLOSED_WON', 'CLOSED_LOST'],
};

export function ProjectListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<ProjectFollowUpDto[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDto | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [budgetTarget, setBudgetTarget] = useState('');

  const canManageCommercial = user?.role === 'COMMERCIAL' || user?.role === 'ADMIN';

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await projectsApi.list();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les projets.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFollowUps = useCallback(async () => {
    if (!canManageCommercial) {
      setFollowUps([]);
      setFollowUpsLoading(false);
      return;
    }
    setFollowUpsLoading(true);
    setFollowUpError(null);
    try {
      const { data } = await projectFollowUpsApi.list();
      setFollowUps(data);
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : 'Impossible de charger les prochaines actions.');
    } finally {
      setFollowUpsLoading(false);
    }
  }, [canManageCommercial]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);
  useEffect(() => { void loadFollowUps(); }, [loadFollowUps]);

  useEffect(() => {
    clientsApi.list()
      .then(({ data }) => {
        setClients(data);
        if (data.length) setClientId(data[0].id);
      })
      .catch((err: Error) => setClientError(err.message));
  }, []);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    const filtered = projects.filter((project) => {
      const matchesSearch = `${project.reference} ${project.title} ${project.clientName}`
        .toLocaleLowerCase('fr')
        .includes(query);
      return matchesSearch && (statusFilter === 'all' || project.status === statusFilter);
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'fr');
      if (sortBy === 'budget') return (b.budgetTarget ?? 0) - (a.budgetTarget ?? 0);
      if (sortBy === 'campaign') return (a.campaignStart ?? '9999-12-31').localeCompare(b.campaignStart ?? '9999-12-31');
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [projects, search, sortBy, statusFilter]);

  const todayDate = localDateToday();
  const upcomingLimit = new Date();
  upcomingLimit.setDate(upcomingLimit.getDate() + 30);
  const upcomingDate = `${upcomingLimit.getFullYear()}-${String(upcomingLimit.getMonth() + 1).padStart(2, '0')}-${String(upcomingLimit.getDate()).padStart(2, '0')}`;
  const openProjects = projects.filter((project) => project.status !== 'CLOSED_WON' && project.status !== 'CLOSED_LOST');
  const pipelineBudget = openProjects.reduce((total, project) => total + (project.budgetTarget ?? 0), 0);
  const activeDeals = projects.filter((project) => project.status === 'SUBMITTED' || project.status === 'NEGOTIATION').length;
  const upcomingCampaigns = projects.filter((project) =>
    project.campaignStart !== null && project.campaignStart >= todayDate && project.campaignStart <= upcomingDate
  ).length;
  const overdueFollowUps = followUps.filter((item) => item.dueDate < todayDate).length;

  const resetProjectForm = () => {
    setEditingProject(null);
    setTitle('');
    setClientId(clients[0]?.id ?? '');
    setCampaignStart('');
    setCampaignEnd('');
    setBudgetTarget('');
  };

  const openNewProject = () => {
    resetProjectForm();
    setCreateError(null);
    setCreateOpen(true);
  };

  const openEditProject = (project: ProjectDto) => {
    setEditingProject(project);
    setTitle(project.title);
    setClientId(project.clientId);
    setCampaignStart(project.campaignStart ?? '');
    setCampaignEnd(project.campaignEnd ?? '');
    setBudgetTarget(project.budgetTarget === null ? '' : String(project.budgetTarget));
    setCreateError(null);
    setCreateOpen(true);
  };

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
      const payload = {
        title: trimmedTitle,
        clientId,
        campaignStart: campaignStart || null,
        campaignEnd: campaignEnd || null,
        budgetTarget: parsedBudget ?? null,
      };
      if (editingProject) {
        await projectsApi.update(editingProject.id, payload);
        setCreateOpen(false);
        resetProjectForm();
        await loadProjects();
      } else {
        const { data } = await projectsApi.create({
          title: trimmedTitle,
          clientId,
          ...(campaignStart ? { campaignStart } : {}),
          ...(campaignEnd ? { campaignEnd } : {}),
          ...(parsedBudget !== undefined ? { budgetTarget: parsedBudget } : {}),
        });
        navigate(`/projects/${data.id}`);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'L’enregistrement du projet a échoué.');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
    resetProjectForm();
  };

  const changeProjectStatus = async (project: ProjectDto, status: string) => {
    setUpdatingStatus(project.id);
    setActionError(null);
    try {
      await projectsApi.updateStatus(project.id, status);
      setProjects((current) => current.map((item) => item.id === project.id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item
      ));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de modifier le statut.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const completeFollowUp = async (item: ProjectFollowUpDto) => {
    try {
      await projectFollowUpsApi.setCompleted(item.projectId, item.id, true);
      setFollowUps((current) => current.filter((entry) => entry.id !== item.id));
      setFollowUpError(null);
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : 'Impossible de terminer cette action.');
    }
  };

  return (
    <AppShell eyebrow="Espace commercial" title="Mes projets">
      <main className="mx-auto max-w-6xl px-5 py-7 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {projects.length > 0
              ? `${projects.length} projet${projects.length > 1 ? 's' : ''} dans votre portefeuille`
              : 'Votre portefeuille commercial'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void loadProjects(); void loadFollowUps(); }} disabled={loading} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Actualiser
            </button>
            {canManageCommercial && (
            <button
              type="button"
              onClick={openNewProject}
              className="inline-flex h-10 items-center rounded-lg bg-[#0055B8] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#00338D]"
            >
              + Nouveau projet
            </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-gtv-blue-light border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => void loadProjects()} className="font-bold underline">Réessayer</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section aria-label="Indicateurs du portefeuille" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Projets ouverts" value={String(openProjects.length)} detail={`${projects.length} projet(s) au total`} />
              <MetricCard label="Budget du pipeline" value={`${fmt(pipelineBudget)} XAF`} detail="Projets non clôturés" />
              <MetricCard label="En cours de traitement" value={String(activeDeals)} detail="Soumis ou en négociation" />
              <MetricCard label="Campagnes sous 30 jours" value={String(upcomingCampaigns)} detail={`${overdueFollowUps} action(s) en retard`} />
            </section>

            {canManageCommercial && (
              <section className="surface-card mb-6 p-4 sm:p-5" aria-labelledby="upcoming-actions-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#009A44]">Relances</p>
                    <h2 id="upcoming-actions-title" className="mt-1 text-base font-bold text-slate-900">Prochaines actions</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{followUps.length} en attente</span>
                </div>
                {followUpError && <p role="alert" className="mt-3 text-sm text-red-700">{followUpError}</p>}
                {followUpsLoading ? (
                  <p className="mt-4 text-sm text-slate-500">Chargement des actions…</p>
                ) : !followUpError && followUps.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Aucune action à venir. Ajoutez un rappel depuis un projet.</p>
                ) : (
                  <div className="mt-3 divide-y divide-slate-100">
                    {followUps.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <Link to={`/projects/${item.projectId}`} className="text-xs font-bold text-[#0055B8] hover:underline">
                            {item.projectReference} · {item.projectTitle}
                          </Link>
                          <p className="mt-1 break-words text-sm text-slate-700">{item.note}</p>
                          <p className={`mt-1 text-xs ${item.dueDate < todayDate ? 'font-bold text-red-600' : 'text-slate-500'}`}>
                            {item.dueDate < todayDate ? 'En retard · ' : 'Échéance · '}{formatDate(item.dueDate)}
                          </p>
                        </div>
                        <button type="button" onClick={() => void completeFollowUp(item)} className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          Terminer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {actionError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}

            <section className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end" aria-label="Recherche et filtres des projets">
              <label className="block text-xs font-bold text-slate-600">
                Rechercher
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="form-control mt-1.5" placeholder="Référence, titre ou annonceur…" />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Statut
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="form-control mt-1.5">
                  <option value="all">Tous les statuts</option>
                  {Object.entries(STATUS_LABELS).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Trier par
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="form-control mt-1.5">
                  <option value="updated">Dernière activité</option>
                  <option value="campaign">Début de campagne</option>
                  <option value="budget">Budget décroissant</option>
                  <option value="title">Titre A à Z</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!visibleProjects.length}
                onClick={() => downloadCsv('projets-gtv.csv',
                  ['Référence', 'Titre', 'Annonceur', 'Statut', 'Budget cible XAF', 'Début de campagne', 'Fin de campagne', 'Dernière activité'],
                  visibleProjects.map((project) => [
                    project.reference, project.title, project.clientName,
                    STATUS_LABELS[project.status]?.label ?? project.status,
                    project.budgetTarget, project.campaignStart, project.campaignEnd,
                    project.updatedAt.slice(0, 10),
                  ]))}
                className="h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#0055B8] hover:bg-[#eef3fb] disabled:opacity-40"
              >
                Exporter CSV
              </button>
              <p className="text-xs text-slate-500 sm:col-span-4">{visibleProjects.length} projet(s) affiché(s) sur {projects.length}.</p>
            </section>

            {projects.length === 0 ? (
              <div className="surface-card py-16 text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">+</div>
                <p className="text-base font-semibold text-slate-700">Aucun projet pour le moment</p>
                <p className="mt-1 text-sm text-slate-400">Les nouveaux projets apparaîtront dans cette vue.</p>
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="surface-card p-10 text-center text-sm text-slate-500">Aucun projet ne correspond à ces filtres.</div>
            ) : (
              <>
                <div className="surface-card hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Référence</th>
                        <th className="px-4 py-3 text-left">Projet / annonceur</th>
                        <th className="px-4 py-3 text-center">Statut</th>
                        <th className="px-4 py-3 text-right">Budget cible</th>
                        <th className="px-4 py-3 text-right">Début</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProjects.map((project) => (
                        <ProjectTableRow
                          key={project.id}
                          project={project}
                          isAdmin={user?.role === 'ADMIN'}
                          canEdit={canManageCommercial && project.status === 'DRAFT'}
                          updating={updatingStatus === project.id}
                          onEdit={() => openEditProject(project)}
                          onStatusChange={(status) => void changeProjectStatus(project, status)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 lg:hidden">
                  {visibleProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      canEdit={canManageCommercial && project.status === 'DRAFT'}
                      isAdmin={user?.role === 'ADMIN'}
                      updating={updatingStatus === project.id}
                      onEdit={() => openEditProject(project)}
                      onStatusChange={(status) => void changeProjectStatus(project, status)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
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
            className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-4 py-5 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#009A44]">Espace commercial</p>
                <h2 id="create-project-title" className="mt-1 text-xl font-bold text-slate-900">
                  {editingProject ? 'Modifier le projet' : 'Nouveau projet'}
                </h2>
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

            <form onSubmit={handleCreate} className="space-y-4 px-4 py-5 sm:px-6">
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
                  className="h-10 rounded-lg bg-[#0055B8] px-5 text-sm font-bold text-white transition hover:bg-[#00338D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Enregistrement…' : editingProject ? 'Enregistrer les modifications' : 'Créer le projet'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="surface-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function ProjectTableRow({
  project,
  isAdmin,
  canEdit,
  updating,
  onEdit,
  onStatusChange,
}: {
  project: ProjectDto;
  isAdmin: boolean;
  canEdit: boolean;
  updating: boolean;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusMeta = STATUS_LABELS[project.status] ?? { label: project.status, color: 'bg-gray-100 text-gray-600' };
  return (
    <tr className="border-t border-slate-100 transition hover:bg-[#f8fafc]">
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{project.reference}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{project.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{project.clientName}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusControl project={project} isAdmin={isAdmin} updating={updating} onStatusChange={onStatusChange} statusMeta={statusMeta} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {project.budgetTarget !== null ? `${fmt(project.budgetTarget)} XAF` : '—'}
      </td>
      <td className="px-4 py-3 text-right text-xs text-gray-500">{project.campaignStart ? formatDate(project.campaignStart) : '—'}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/projects/${project.id}`} className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-bold text-[#0055B8] transition hover:border-[#0055B8]/30 hover:bg-[#eef3fb]">
            {project.status === 'DRAFT' ? 'Continuer' : 'Ouvrir'}
          </Link>
          {canEdit && <button type="button" onClick={onEdit} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Modifier</button>}
        </div>
      </td>
    </tr>
  );
}

function ProjectCard({
  project,
  canEdit,
  isAdmin,
  updating,
  onEdit,
  onStatusChange,
}: {
  project: ProjectDto;
  canEdit: boolean;
  isAdmin: boolean;
  updating: boolean;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusMeta = STATUS_LABELS[project.status] ?? { label: project.status, color: 'bg-gray-100 text-gray-600' };
  return (
    <article className="surface-card min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-slate-400">{project.reference}</p>
          <h2 className="mt-1 break-words font-bold text-slate-900">{project.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{project.clientName}</p>
        </div>
        <StatusControl project={project} isAdmin={isAdmin} updating={updating} onStatusChange={onStatusChange} statusMeta={statusMeta} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Budget cible</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-700">{project.budgetTarget !== null ? `${fmt(project.budgetTarget)} XAF` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Début de campagne</dt>
          <dd className="mt-1 text-sm text-slate-700">{project.campaignStart ? formatDate(project.campaignStart) : '—'}</dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Link to={`/projects/${project.id}`} className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-[#0055B8] transition hover:border-[#0055B8]/30 hover:bg-[#eef3fb]">
          {project.status === 'DRAFT' ? 'Continuer' : 'Ouvrir le projet'}
        </Link>
        {canEdit && <button type="button" onClick={onEdit} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Modifier</button>}
      </div>
    </article>
  );
}

function StatusControl({
  project,
  isAdmin,
  updating,
  onStatusChange,
  statusMeta,
}: {
  project: ProjectDto;
  isAdmin: boolean;
  updating: boolean;
  onStatusChange: (status: string) => void;
  statusMeta: { label: string; color: string };
}) {
  const transitions = STATUS_TRANSITIONS[project.status] ?? [];
  if (!isAdmin || transitions.length === 0) {
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>;
  }
  return (
    <select
      aria-label={`Statut du projet ${project.reference}`}
      value={project.status}
      disabled={updating}
      onChange={(event) => onStatusChange(event.target.value)}
      className="form-control !min-h-[34px] !w-auto !py-1 text-xs font-semibold"
    >
      <option value={project.status}>{statusMeta.label}</option>
      {transitions.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]?.label ?? status}</option>)}
    </select>
  );
}

function localDateToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
