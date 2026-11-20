import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/ui/AppShell';
import { visitorApi } from '../services/api';
import type { VisitorInboxItem } from '../services/api';
import { downloadCsv } from '../../utils/csv';

const STATUSES = [
  ['ACCUSE_RECU', 'Accusé réception'],
  ['EN_QUALIFICATION', 'En cours d’étude'],
  ['EN_ATTENTE_CLIENT', 'Attente du client'],
  ['DEVIS_EN_PREPARATION', 'Devis en préparation'],
  ['DEVIS_ENVOYE', 'Devis transmis'],
  ['AJUSTEMENT_DEMANDE', 'Ajustement demandé'],
  ['ACCEPTE', 'Acceptée'],
  ['REFUSE', 'Refusée'],
  ['EXPIRE', 'Expirée'],
  ['CLOS', 'Clôturée'],
] as const;

export function VisitorRequestInboxPage() {
  return (
    <AppShell eyebrow="Espace commercial" title="Demandes visiteurs">
      <VisitorRequestInboxContent />
    </AppShell>
  );
}

export function VisitorRequestInboxContent() {
  const [requests, setRequests] = useState<VisitorInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const visibleRequests = requests.filter((item) => {
    const matchesSearch = `${item.reference} ${item.companyName} ${item.fullName} ${item.email}`
      .toLocaleLowerCase('fr')
      .includes(search.trim().toLocaleLowerCase('fr'));
    return matchesSearch && (statusFilter === 'all' || item.status === statusFilter);
  });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await visitorApi.inbox();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const updateStatus = async (item: VisitorInboxItem, status: string) => {
    setUpdating(item.reference);
    setError(null);
    try {
      await visitorApi.updateStatus(item.reference, status);
      setRequests((current) => current.map((request) =>
        request.reference === item.reference ? { ...request, status } : request
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-7 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Demandes de devis envoyées depuis l’espace public.</p>
          <button type="button" onClick={() => void loadRequests()} disabled={loading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Actualiser
          </button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="surface-card px-5 py-12 text-center text-sm text-slate-500">Chargement des demandes…</div>
        ) : requests.length === 0 ? (
          <div className="surface-card px-5 py-14 text-center">
            <p className="font-semibold text-slate-700">Aucune demande visiteur</p>
            <p className="mt-1 text-sm text-slate-400">Les demandes de devis publiques apparaîtront ici.</p>
          </div>
        ) : (
          <div>
            <section className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="block text-xs font-bold text-slate-600">
                Rechercher une demande
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="form-control mt-1.5" placeholder="Référence, entreprise, contact ou e-mail…" />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Statut
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="form-control mt-1.5">
                  <option value="all">Tous les statuts</option>
                  {requests.some((request) => request.status === 'SOUMISE') && <option value="SOUMISE">Nouvelle demande</option>}
                  {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button type="button" disabled={!visibleRequests.length} onClick={() => downloadCsv('demandes-visiteurs-gtv.csv',
                ['Référence', 'Entreprise', 'Contact', 'E-mail', 'Statut', 'Objectif', 'Date de soumission', 'Montant estimé'],
                visibleRequests.map((item) => [
                  item.reference,
                  item.companyName,
                  item.fullName,
                  item.email,
                  item.status,
                  item.objective ?? item.brief.objective,
                  item.submittedAt?.slice(0, 10),
                  item.plan.reduce((total, line) => total + line.grossTotal, 0),
                ]))}
                className="h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#0055B8] hover:bg-[#eef3fb] disabled:opacity-40">
                Exporter {visibleRequests.length} demande(s)
              </button>
              <p className="text-xs text-slate-500 sm:col-span-3">{visibleRequests.length} demande(s) affichée(s) sur {requests.length} chargée(s).</p>
            </section>
            {visibleRequests.length === 0 ? (
              <div className="surface-card p-10 text-center text-sm text-slate-500">Aucune demande ne correspond à ces filtres.</div>
            ) : <div className="space-y-4">
            {visibleRequests.map((item) => {
              const totalCents = item.plan.reduce((sum, line) => sum + Math.round(line.grossTotal * 100), 0);
              const total = totalCents / 100;
              const currency = item.plan[0]?.currency ?? 'XAF';
              return (
                <article key={item.reference} className="surface-card p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#0055B8]">{item.reference}</p>
                      <h2 className="mt-1 text-base font-bold text-slate-800">{item.companyName}</h2>
                      <p className="mt-1 break-words text-sm text-slate-500">{item.fullName} · <a className="break-all text-[#0055B8] hover:underline" href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.objective ?? item.brief.objective}
                        {item.brief.targetSegment ? ` · ${item.brief.targetSegment}` : ''}
                        {item.submittedAt ? ` · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(item.submittedAt))}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {item.plan.length > 0 && (
                        <span className="text-sm font-bold text-slate-700">{money(total, currency)}</span>
                      )}
                      <select
                        aria-label={`Statut de la demande ${item.reference}`}
                        value={item.status}
                        disabled={updating === item.reference}
                        onChange={(event) => void updateStatus(item, event.target.value)}
                        className="form-control !min-h-[38px] !w-auto !py-1.5 text-xs font-semibold"
                      >
                        {item.status === 'SOUMISE' && <option value="SOUMISE">Nouvelle demande</option>}
                        {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </div>

                  {item.plan.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Formats demandés</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {item.plan.map((line, index) => (
                          <li key={`${line.formatId}-${index}`} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                            {line.formatLabel} · {line.quantity} passage(s)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
            </div>}
          </div>
        )}
    </main>
  );
}

function money(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}
