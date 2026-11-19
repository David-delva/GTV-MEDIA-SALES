import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/ui/AppShell';
import { useAuthStore } from '../store/authStore';
import { VisitorRequestInboxContent } from './VisitorRequestInboxPage';
import {
  adminUsersApi,
  formatsApi,
  projectsApi,
  rateCardsApi,
  visitorApi,
  type AdminRateCardDto,
  type AdminUserDto,
  type FormatDto,
  type ProjectDto,
  type VisitorInboxItem,
} from '../services/api';

type AdminTab = 'overview' | 'rates' | 'users' | 'projects' | 'requests';

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'rates', label: 'Grilles tarifaires' },
  { id: 'users', label: 'Comptes' },
  { id: 'projects', label: 'Projets' },
  { id: 'requests', label: 'Demandes visiteurs' },
];

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  NEGOTIATION: 'Négociation',
  CLOSED_WON: 'Gagné',
  CLOSED_LOST: 'Perdu',
};

const PROJECT_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'],
  NEGOTIATION: ['CLOSED_WON', 'CLOSED_LOST'],
};

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [rateCards, setRateCards] = useState<AdminRateCardDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [requests, setRequests] = useState<VisitorInboxItem[]>([]);
  const [formats, setFormats] = useState<FormatDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [userResponse, cardResponse, projectResponse, requestResponse, formatResponse] = await Promise.all([
        adminUsersApi.list(),
        rateCardsApi.listAdmin(),
        projectsApi.list(),
        visitorApi.inbox(),
        formatsApi.list(),
      ]);
      setUsers(userResponse.data);
      setRateCards(cardResponse.data);
      setProjects(projectResponse.data);
      setRequests(requestResponse.data);
      setFormats(formatResponse.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les données administratives.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const activeRateCard = rateCards.find((card) => card.status === 'ACTIVE');
  const pendingRequests = requests.filter((request) =>
    !['ACCEPTE', 'REFUSE', 'EXPIRE', 'CLOS'].includes(request.status)
  ).length;
  const activeUsers = users.filter((user) => user.isActive).length;
  return (
    <AppShell eyebrow="Espace sécurisé · Administrateur" title="Administration">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Pilotez les tarifs, les comptes et l’activité commerciale de GTV.</p>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Actualiser
          </button>
        </div>

        <div role="tablist" aria-label="Sections d’administration" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              id={`admin-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`admin-panel-${item.id}`}
              onClick={() => { setTab(item.id); setNotice(null); }}
              className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
                tab === item.id ? 'bg-[#0055B8] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        {loading ? (
          <div className="surface-card px-5 py-16 text-center text-sm text-slate-500">Chargement de l’espace d’administration…</div>
        ) : (
          <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
            {tab === 'overview' && (
              <OverviewPanel
                activeUsers={activeUsers}
                usersCount={users.length}
                projects={projects}
                rateCard={activeRateCard}
                requestsCount={pendingRequests}
                loadedRequests={requests.length}
                onSelect={setTab}
              />
            )}
            {tab === 'rates' && (
              <RateCardsPanel
                cards={rateCards}
                formats={formats}
                onChanged={async (message) => { setNotice(message); await loadData(true); }}
                onError={setError}
              />
            )}
            {tab === 'users' && (
              <UsersPanel
                users={users}
                onChanged={(nextUsers, message) => { setUsers(nextUsers); setNotice(message); }}
                onError={setError}
              />
            )}
            {tab === 'projects' && (
              <ProjectsPanel
                projects={projects}
                onChanged={(id, status) => {
                  setProjects((current) => current.map((project) => project.id === id ? { ...project, status } : project));
                  setNotice('Le statut du projet a été mis à jour.');
                }}
                onError={setError}
              />
            )}
            {tab === 'requests' && <VisitorRequestInboxContent />}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function OverviewPanel({
  activeUsers,
  usersCount,
  projects,
  rateCard,
  requestsCount,
  loadedRequests,
  onSelect,
}: {
  activeUsers: number;
  usersCount: number;
  projects: ProjectDto[];
  rateCard?: AdminRateCardDto;
  requestsCount: number;
  loadedRequests: number;
  onSelect: (tab: AdminTab) => void;
}) {
  const projectCounts = useMemo(() => ({
    open: projects.filter((project) => !project.status.startsWith('CLOSED_')).length,
    submitted: projects.filter((project) => project.status === 'SUBMITTED').length,
  }), [projects]);

  const metrics = [
    { label: 'Comptes actifs', value: `${activeUsers} / ${usersCount}`, tab: 'users' as AdminTab, hint: 'Utilisateurs autorisés à se connecter' },
    { label: 'Projets ouverts', value: projectCounts.open, tab: 'projects' as AdminTab, hint: `${projectCounts.submitted} soumis à traiter` },
    { label: 'Demandes à suivre', value: requestsCount, tab: 'requests' as AdminTab, hint: `${loadedRequests} demandes récentes chargées` },
    { label: 'Grille en vigueur', value: rateCard ? 'Active' : 'Aucune', tab: 'rates' as AdminTab, hint: rateCard?.name ?? 'Créez et renseignez une grille' },
  ];

  return (
    <section aria-label="Vue d’ensemble" className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <button key={metric.label} type="button" onClick={() => onSelect(metric.tab)} className="surface-card min-w-0 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0055B8]/30 hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{metric.label}</p>
            <p className="mt-2 truncate text-2xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-2 truncate text-xs text-slate-500">{metric.hint}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0055B8]">Actions rapides</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuickAction title="Gérer les tarifs" description="Préparer, compléter et activer une grille." onClick={() => onSelect('rates')} />
            <QuickAction title="Gérer les comptes" description="Créer ou désactiver un accès commercial." onClick={() => onSelect('users')} />
            <QuickAction title="Suivre les projets" description="Consulter le portefeuille et son avancement." onClick={() => onSelect('projects')} />
            <QuickAction title="Traiter les demandes" description="Mettre à jour le suivi des prospects." onClick={() => onSelect('requests')} />
          </div>
        </section>
        <section className="surface-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Grille tarifaire active</p>
          {rateCard ? (
            <>
              <h2 className="mt-3 text-lg font-bold text-slate-900">{rateCard.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Valide depuis le {formatDate(rateCard.validFrom)}</p>
              <p className="mt-4 text-sm font-semibold text-slate-700">{rateCard.lines.length} ligne(s) tarifaire(s)</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Aucune grille active n’est disponible.</p>
          )}
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Vérifiez les montants et leur période de validité avant activation. La grille active est utilisée par le catalogue public.
          </p>
        </section>
      </div>
    </section>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#0055B8]/30 hover:bg-[#f7faff]">
      <span className="block text-sm font-bold text-slate-800">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
    </button>
  );
}

function RateCardsPanel({
  cards,
  formats,
  onChanged,
  onError,
}: {
  cards: AdminRateCardDto[];
  formats: FormatDto[];
  onChanged: (message: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const today = localDate();
  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState(today);
  const [validTo, setValidTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [lineFormatId, setLineFormatId] = useState('');
  const [daypart, setDaypart] = useState('DAY');
  const [channel, setChannel] = useState('GABON 1ère');
  const [grossPrice, setGrossPrice] = useState('');
  const [discountMaxPct, setDiscountMaxPct] = useState('0');
  const [currency, setCurrency] = useState('XAF');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [savingLine, setSavingLine] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);

  const selectedCard = cards.find((card) => card.id === selectedId);

  useEffect(() => {
    if (!selectedId || !cards.some((card) => card.id === selectedId)) {
      setSelectedId(cards.find((card) => card.status === 'DRAFT')?.id ?? cards[0]?.id ?? '');
    }
  }, [cards, selectedId]);
  useEffect(() => {
    if (!lineFormatId && formats.length > 0) setLineFormatId(formats[0].id);
  }, [formats, lineFormatId]);

  const createCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError(null);
    setCreating(true);
    try {
      const { data } = await rateCardsApi.create({
        name: name.trim(),
        validFrom,
        ...(validTo ? { validTo } : {}),
      });
      setName('');
      setValidTo('');
      setSelectedId(data.id);
      await onChanged('Grille brouillon créée. Ajoutez ses tarifs avant de l’activer.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'La création de la grille a échoué.');
    } finally {
      setCreating(false);
    }
  };

  const addLine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCard || selectedCard.status !== 'DRAFT') return;
    onError(null);
    setSavingLine(true);
    const wasEditing = Boolean(editingLineId);
    try {
      const payload = {
        formatId: lineFormatId,
        daypart,
        channel: channel.trim(),
        grossPrice: Number(grossPrice),
        discountMaxPct: Number(discountMaxPct),
        currency: currency.trim().toUpperCase(),
        isNegotiable,
      };
      if (editingLineId) {
        await rateCardsApi.updateLine(selectedCard.id, editingLineId, payload);
      } else {
        await rateCardsApi.addLine(selectedCard.id, payload);
      }
      setGrossPrice('');
      setEditingLineId(null);
      await onChanged(wasEditing ? 'Ligne tarifaire modifiée.' : 'Ligne tarifaire ajoutée.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible d’ajouter cette ligne tarifaire.');
    } finally {
      setSavingLine(false);
    }
  };

  const editLine = (line: AdminRateCardDto['lines'][number]) => {
    setEditingLineId(line.id);
    setLineFormatId(line.formatId);
    setDaypart(line.daypart);
    setChannel(line.channel);
    setGrossPrice(String(line.grossPrice));
    setDiscountMaxPct(String(line.discountMaxPct));
    setCurrency(line.currency);
    setIsNegotiable(line.isNegotiable);
  };

  const deleteLine = async (lineId: string) => {
    if (!selectedCard || !window.confirm('Supprimer cette ligne de la grille brouillon ?')) return;
    onError(null);
    setDeletingLineId(lineId);
    try {
      await rateCardsApi.deleteLine(selectedCard.id, lineId);
      if (editingLineId === lineId) setEditingLineId(null);
      await onChanged('Ligne tarifaire supprimée.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible de supprimer cette ligne tarifaire.');
    } finally {
      setDeletingLineId(null);
    }
  };

  const activate = async (card: AdminRateCardDto) => {
    if (!window.confirm(`Activer « ${card.name} » ? La grille actuellement active sera archivée.`)) return;
    onError(null);
    setActivatingId(card.id);
    try {
      await rateCardsApi.activate(card.id);
      await onChanged(`La grille « ${card.name} » est maintenant active.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible d’activer cette grille.');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <form onSubmit={(event) => void createCard(event)} className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="block text-xs font-bold text-slate-600">
          Nom de la nouvelle grille
          <input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="form-control mt-1.5" placeholder="Ex. Grille commerciale 2026" />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Valide à partir du
          <input required type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="form-control mt-1.5" />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Valide jusqu’au (facultatif)
          <input type="date" min={nextDate(validFrom)} value={validTo} onChange={(event) => setValidTo(event.target.value)} className="form-control mt-1.5" />
        </label>
        <button type="submit" disabled={creating} className="h-11 rounded-lg bg-[#0055B8] px-4 text-sm font-bold text-white hover:bg-[#00338D] disabled:opacity-50">
          {creating ? 'Création…' : 'Créer une grille'}
        </button>
      </form>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-3">
          {cards.length === 0 && <div className="surface-card p-8 text-center text-sm text-slate-500">Aucune grille n’a encore été créée.</div>}
          {cards.map((card) => (
            <article key={card.id} className={`surface-card min-w-0 p-4 sm:p-5 ${selectedId === card.id ? 'border-[#0055B8]/40 ring-1 ring-[#0055B8]/10' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" onClick={() => { setEditingLineId(null); setSelectedId(card.id); }} className="min-w-0 text-left">
                  <span className="block break-words font-bold text-slate-900">{card.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Du {formatDate(card.validFrom)}{card.validTo ? ` au ${formatDate(card.validTo)}` : ' · sans date de fin'} · {card.lines.length} ligne(s)
                  </span>
                </button>
                <StatusBadge status={card.status} />
              </div>
              {card.status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={!card.lines.length || activatingId !== null}
                  onClick={() => void activate(card)}
                  className="mt-4 h-9 rounded-lg border border-[#0055B8]/25 px-3 text-xs font-bold text-[#0055B8] hover:bg-[#eef3fb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {activatingId === card.id ? 'Activation…' : card.lines.length ? 'Activer cette grille' : 'Ajoutez une ligne pour activer'}
                </button>
              )}
            </article>
          ))}
        </div>

        <section className="surface-card min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Détail tarifaire</p>
              <h2 className="mt-1 break-words text-base font-bold text-slate-900">{selectedCard?.name ?? 'Sélectionnez une grille'}</h2>
            </div>
            {selectedCard && <StatusBadge status={selectedCard.status} />}
          </div>
          {selectedCard && (
            <>
              {selectedCard.status === 'DRAFT' && (
                <form onSubmit={(event) => void addLine(event)} className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                    Format
                    <select required disabled={Boolean(editingLineId)} value={lineFormatId} onChange={(event) => setLineFormatId(event.target.value)} className="form-control mt-1.5 disabled:bg-slate-100">
                      <option value="" disabled>Choisir un format</option>
                      {formats.map((format) => <option key={format.id} value={format.id}>{format.label} · {format.category}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Période
                    <select value={daypart} onChange={(event) => setDaypart(event.target.value)} className="form-control mt-1.5">
                      <option value="DAY">Journée</option><option value="PRIME">Prime time</option><option value="NUIT">Nuit</option><option value="WEEKEND">Week-end</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Chaîne / support
                    <input required maxLength={50} value={channel} onChange={(event) => setChannel(event.target.value)} className="form-control mt-1.5" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Tarif brut
                    <input required type="number" min="0" step="0.01" value={grossPrice} onChange={(event) => setGrossPrice(event.target.value)} className="form-control mt-1.5" />
                  </label>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <label className="text-xs font-bold text-slate-600">
                      Remise max. (%)
                      <input required type="number" min="0" max="100" step="0.01" value={discountMaxPct} onChange={(event) => setDiscountMaxPct(event.target.value)} className="form-control mt-1.5" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Devise
                      <input required maxLength={3} minLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="form-control mt-1.5 uppercase" />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 sm:col-span-2">
                    <input type="checkbox" checked={isNegotiable} onChange={(event) => setIsNegotiable(event.target.checked)} className="rounded border-slate-300 text-[#0055B8] focus:ring-[#0055B8]" />
                    Tarif négociable
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button type="submit" disabled={savingLine || !formats.length} className="h-10 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
                      {savingLine ? 'Enregistrement…' : editingLineId ? 'Enregistrer la modification' : 'Ajouter à la grille'}
                    </button>
                    {editingLineId && (
                      <button type="button" disabled={savingLine} onClick={() => setEditingLineId(null)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
                        Annuler
                      </button>
                    )}
                  </div>
                </form>
              )}
              {selectedCard.lines.length > 0 ? (
                <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                  {selectedCard.lines.map((line) => {
                    const format = formats.find((item) => item.id === line.formatId);
                    return (
                      <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-800">{format?.label ?? line.formatId}</p>
                          <p className="text-xs text-slate-500">{line.channel} · {daypartLabel(line.daypart)} · remise max. {line.discountMaxPct}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-bold text-slate-800">{money(line.grossPrice, line.currency)}</span>
                          {selectedCard.status === 'DRAFT' && (
                            <>
                              <button type="button" onClick={() => editLine(line)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#0055B8] hover:bg-[#eef3fb]">
                                Modifier
                              </button>
                              <button type="button" disabled={deletingLineId === line.id} onClick={() => void deleteLine(line.id)} className="rounded-md border border-red-100 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                                {deletingLineId === line.id ? '…' : 'Supprimer'}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-5 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Aucun tarif saisi dans cette grille.</p>
              )}
            </>
          )}
        </section>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        Une grille active est immédiatement publiée dans le catalogue visiteur; elle archive la précédente. Les tarifs de démonstration restent fictifs.
      </p>
    </section>
  );
}

function UsersPanel({
  users,
  onChanged,
  onError,
}: {
  users: AdminUserDto[];
  onChanged: (users: AdminUserDto[], message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminUserDto['role']>('COMMERCIAL');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError(null);
    if (password.length < 12) return onError('Le mot de passe doit contenir au moins 12 caractères.');
    if (password !== confirmPassword) return onError('Les deux mots de passe ne correspondent pas.');
    setSaving(true);
    try {
      const { data } = await adminUsersApi.create({ name: name.trim(), email: email.trim(), role, password });
      setName('');
      setEmail('');
      setRole('COMMERCIAL');
      setPassword('');
      setConfirmPassword('');
      onChanged([data, ...users], `Le compte ${data.email} a été créé.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'La création du compte a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: AdminUserDto) => {
    onError(null);
    setUpdatingId(user.id);
    try {
      await adminUsersApi.setActive(user.id, !user.isActive);
      onChanged(users.map((item) => item.id === user.id ? { ...item, isActive: !user.isActive } : item),
        user.isActive ? `Le compte ${user.email} a été désactivé.` : `Le compte ${user.email} a été réactivé.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'La mise à jour du compte a échoué.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={(event) => void createUser(event)} className="surface-card space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#0055B8]">Nouvel accès</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Créer un compte</h2>
        </div>
        <label className="block text-xs font-bold text-slate-600">Nom complet
          <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="form-control mt-1.5" autoComplete="name" />
        </label>
        <label className="block text-xs font-bold text-slate-600">Adresse e-mail
          <input required type="email" maxLength={150} value={email} onChange={(event) => setEmail(event.target.value)} className="form-control mt-1.5" autoComplete="email" />
        </label>
        <label className="block text-xs font-bold text-slate-600">Rôle
          <select value={role} onChange={(event) => setRole(event.target.value as AdminUserDto['role'])} className="form-control mt-1.5">
            <option value="COMMERCIAL">Commercial</option><option value="VIEWER">Lecture seule</option><option value="ADMIN">Administrateur</option>
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">Mot de passe initial
          <input required type="password" minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="form-control mt-1.5" autoComplete="new-password" />
          <span className="mt-1 block font-normal text-slate-400">12 caractères minimum, 72 octets maximum. Transmettez-le à la personne de façon sécurisée.</span>
        </label>
        <label className="block text-xs font-bold text-slate-600">Confirmer le mot de passe
          <input required type="password" minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="form-control mt-1.5" autoComplete="new-password" />
        </label>
        <button type="submit" disabled={saving} className="h-11 w-full rounded-lg bg-[#0055B8] px-4 text-sm font-bold text-white hover:bg-[#00338D] disabled:opacity-50">
          {saving ? 'Création…' : 'Créer le compte'}
        </button>
      </form>

      <section className="surface-card min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Accès enregistrés</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{users.length} compte(s)</h2>
          </div>
        </div>
        {users.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Aucun compte à afficher.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="break-all text-xs text-slate-500">{user.email} · {roleLabel(user.role)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Créé le {formatDate(user.createdAt.slice(0, 10))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={user.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <button
                    type="button"
                    disabled={updatingId === user.id || user.id === currentUserId}
                    onClick={() => void toggleActive(user)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={user.id === currentUserId ? 'Vous ne pouvez pas désactiver votre propre compte.' : undefined}
                  >
                    {updatingId === user.id ? '…' : user.isActive ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          La désactivation bloque immédiatement les nouvelles requêtes authentifiées de ce compte. Le dernier administrateur actif ne peut pas être désactivé.
        </p>
      </section>
    </section>
  );
}

function ProjectsPanel({
  projects,
  onChanged,
  onError,
}: {
  projects: ProjectDto[];
  onChanged: (id: string, status: string) => void;
  onError: (message: string | null) => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (project: ProjectDto, status: string) => {
    onError(null);
    setUpdatingId(project.id);
    try {
      await projectsApi.updateStatus(project.id, status);
      onChanged(project.id, status);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Impossible de changer le statut du projet.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-500">{projects.length} projet(s) dans le portefeuille. Les statuts suivent les transitions métier autorisées.</p>
      {projects.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-slate-500">Aucun projet à afficher.</div>
      ) : projects.map((project) => {
        const transitions = PROJECT_TRANSITIONS[project.status] ?? [];
        return (
          <article key={project.id} className="surface-card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-[#0055B8]">{project.reference}</p>
              <h2 className="mt-1 break-words font-bold text-slate-900">{project.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Budget cible : {project.budgetTarget !== null ? money(project.budgetTarget, 'XAF') : '—'} · Campagne : {project.campaignStart ?? '—'} → {project.campaignEnd ?? '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
              {transitions.length > 0 && (
                <select
                  aria-label={`Modifier le statut du projet ${project.reference}`}
                  value=""
                  disabled={updatingId === project.id}
                  onChange={(event) => { if (event.target.value) void updateStatus(project, event.target.value); }}
                  className="form-control !min-h-[38px] !w-auto !py-1.5 text-xs font-semibold"
                >
                  <option value="" disabled>{updatingId === project.id ? 'Mise à jour…' : 'Changer le statut'}</option>
                  {transitions.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}
                </select>
              )}
              <Link to={`/projects/${project.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0055B8] hover:bg-[#eef3fb]">Ouvrir</Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Active',
    ARCHIVED: 'Archivée',
    INACTIVE: 'Désactivé',
  };
  const color = status === 'ACTIVE'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'DRAFT'
      ? 'bg-amber-100 text-amber-800'
      : status === 'ARCHIVED' || status === 'INACTIVE'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-slate-100 text-slate-600';
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${color}`}>{labels[status] ?? status}</span>;
}

function roleLabel(role: AdminUserDto['role']): string {
  return role === 'ADMIN' ? 'Administrateur' : role === 'COMMERCIAL' ? 'Commercial' : 'Lecture seule';
}

function daypartLabel(daypart: string): string {
  return daypart === 'PRIME' ? 'Prime time' : daypart === 'DAY' ? 'Journée' : daypart === 'NUIT' ? 'Nuit' : 'Week-end';
}

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
