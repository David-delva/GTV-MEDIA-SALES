// =============================================================================
// GTV Media Sales — Page : QuoteSubmitPage
// Page de récapitulatif et de soumission du devis.
// Flux : récapitulatif → confirmation → soumission → succès/erreur
//
// POURQUOI une page dédiée et non une modale :
// La soumission est un acte irréversible (changement de statut DRAFT → SUBMITTED).
// Une page dédiée force l'utilisateur à une intention explicite et permet
// d'afficher un récapitulatif complet sans contrainte d'espace.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { QuoteSummaryTable } from '../components/quote/QuoteSummaryTable';
import { ScoringRadarChart } from '../components/quote/ScoringRadarChart';
import { useSimulatorStore } from '../store/simulatorStore';
import { useQuoteSubmit } from '../hooks/useQuoteSubmit';
import { projectsApi } from '../services/api';
import type { ProjectDto } from '../services/api';
import { AppShell } from '../components/ui/AppShell';

interface QuoteSubmitPageProps {
  projectId: string;
  onSuccess: () => void;   // callback navigation post-soumission
  onBack: () => void;      // retour au simulateur
}

export function QuoteSubmitPage({ projectId, onSuccess, onBack }: QuoteSubmitPageProps) {
  const [project, setProject]         = useState<ProjectDto | null>(null);
  const [loadingProject, setLoading]  = useState(true);
  const [confirmed, setConfirmed]     = useState(false);

  const { lines, computed, budgetTarget } = useSimulatorStore();
  const { status, error, submit }         = useQuoteSubmit();

  // Chargement des métadonnées du projet (titre, client, dates)
  useEffect(() => {
    let cancelled = false;
    projectsApi.getOne(projectId)
      .then(({ data }) => { if (!cancelled) setProject(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  // Redirection automatique après succès
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(onSuccess, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onSuccess]);

  if (loadingProject) return <PageLoader />;

  // Garde : ne pas soumettre un plan vide
  if (lines.length === 0) {
    return (
      <AppShell eyebrow="Récapitulatif" title="Devis non disponible">
        <div className="flex min-h-[520px] items-center justify-center px-5">
          <div className="surface-card max-w-md px-8 py-10 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">—</div>
            <p className="font-semibold text-slate-700">Le plan média est vide</p>
            <p className="mt-1 text-sm text-slate-500">Ajoutez des lignes avant de préparer le devis.</p>
            <button onClick={onBack} className="mt-5 rounded-lg bg-[#0055B8] px-4 py-2.5 text-sm font-bold text-white">
              Retour au simulateur
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const isOverBudget = computed.warnings.some((w) => w.type === 'OVER_BUDGET');

  return (
    <AppShell
      eyebrow={project ? `${project.reference} — Récapitulatif` : 'Récapitulatif'}
      title="Préparer le devis"
    >
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-6 lg:px-8 print:px-0">
      <div className="mb-5 flex items-center print:hidden">
        <button
          onClick={onBack}
          className="text-sm font-semibold text-slate-500 transition hover:text-[#0055B8]"
          aria-label="Retour au simulateur"
        >
          ← Retour au simulateur
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
          aria-label="Imprimer le récapitulatif"
        >
          Imprimer
        </button>
      </div>

      <main className="space-y-6">

        {/* Bloc métadonnées projet */}
        {project && (
          <section className="surface-card grid grid-cols-1 gap-5 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <MetaField label="Référence"      value={project.reference} />
            <MetaField label="Statut"         value={project.status} />
            <MetaField label="Début campagne" value={project.campaignStart ?? '[À REMPLIR]'} />
            <MetaField label="Fin campagne"   value={project.campaignEnd   ?? '[À REMPLIR]'} />
            <MetaField
              label="Budget cible"
              value={budgetTarget ? `${fmt(budgetTarget)} XAF` : '[À REMPLIR PAR GTV]'}
            />
            <MetaField
              label="Budget net proposé"
              value={`${fmt(computed.totalNet)} XAF`}
              highlight={isOverBudget ? 'danger' : computed.budgetUsagePct >= 95 ? 'warning' : 'ok'}
            />
          </section>
        )}

        {/* Layout : tableau + radar */}
        <div className="grid gap-6 items-start lg:grid-cols-[1fr_220px]">
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Plan média détaillé</h2>
            <QuoteSummaryTable
              lines={lines}
              totalGross={computed.totalGross}
              totalNet={computed.totalNet}
              budgetTarget={budgetTarget}
            />
          </section>

          <section className="surface-card p-4">
            <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Profil de scoring
            </h2>
            <ScoringRadarChart lines={lines} />
            <p className="text-xs text-gray-400 text-center mt-2">
              Moyenne sur {lines.filter((l) => l.scoring !== null).length} ligne(s) scorée(s)
            </p>
          </section>
        </div>

        {/* Avertissements bloquants */}
        {isOverBudget && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Dépassement budgétaire</strong> — Le plan net ({fmt(computed.totalNet)} XAF)
            dépasse le budget cible ({fmt(budgetTarget)} XAF) de{' '}
            <strong>{fmt(computed.totalNet - budgetTarget)} XAF</strong>.
            Vous pouvez soumettre quand même, mais cela sera signalé dans le devis.
          </div>
        )}

        {/* Bloc de confirmation et soumission */}
        <section className="surface-card p-5 space-y-4 print:hidden">
          <h2 className="text-base font-bold text-slate-800">Soumettre le devis</h2>

          <p className="text-sm text-gray-600">
            En soumettant, le plan média sera figé et transmis à l'équipe commerciale GTV
            pour validation. Cette action est <strong>irréversible</strong>.
          </p>

          {/* Case de confirmation obligatoire */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-gtv-blue"
              aria-label="Je confirme avoir vérifié le plan média"
            />
            <span className="text-sm">
              Je confirme avoir vérifié le plan média et les montants ci-dessus.
            </span>
          </label>

          {/* Erreur de soumission */}
          {error && (
            <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}

          {/* Succès */}
          {status === 'success' && (
            <div role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
              ✓ Devis soumis avec succès. Redirection en cours…
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              onClick={onBack}
              disabled={status === 'loading' || status === 'success'}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              ← Modifier le plan
            </button>
            <button
              onClick={() => submit(projectId)}
              disabled={!confirmed || status === 'loading' || status === 'success'}
              aria-busy={status === 'loading'}
              className={`h-10 rounded-lg px-5 text-sm font-bold transition-colors ${
                confirmed && status === 'idle'
                  ? 'bg-[#0055B8] text-white shadow-[0_8px_18px_rgba(0,85,184,0.14)] hover:bg-[#00338D]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {status === 'loading' ? 'Soumission en cours…' : 'Soumettre le devis'}
            </button>
          </div>
        </section>
      </main>
      </div>
    </AppShell>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function MetaField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'ok' | 'warning' | 'danger';
}) {
  const colorClass =
    highlight === 'danger'  ? 'text-red-600 font-bold' :
    highlight === 'warning' ? 'text-amber-600 font-semibold' :
    highlight === 'ok'      ? 'text-emerald-600' :
    'text-gray-800';

  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 font-medium ${colorClass}`}>{value}</dd>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <div className="w-6 h-6 border-2 border-gtv-blue-light border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
