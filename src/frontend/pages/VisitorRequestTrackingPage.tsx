import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { VisitorShell } from '../components/ui/AppShell';
import { visitorApi } from '../services/api';
import type { VisitorTrackedRequest } from '../services/api';

const STATUS_LABELS: Record<string, { label: string; tone: string; description: string }> = {
  SOUMISE: {
    label: 'Demande transmise',
    tone: 'bg-blue-50 text-blue-800 border-blue-200',
    description: 'Votre demande a été enregistrée. L’équipe commerciale GTV pourra l’examiner.',
  },
  ACCUSE_RECU: {
    label: 'Demande reçue',
    tone: 'bg-blue-50 text-blue-800 border-blue-200',
    description: 'Votre demande a été prise en compte par l’équipe GTV.',
  },
  EN_QUALIFICATION: {
    label: 'En cours d’étude',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'L’équipe commerciale étudie les éléments de votre brief.',
  },
  EN_ATTENTE_CLIENT: {
    label: 'Informations complémentaires attendues',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'L’équipe GTV pourra vous contacter pour compléter votre demande.',
  },
  DEVIS_EN_PREPARATION: {
    label: 'Devis en préparation',
    tone: 'bg-violet-50 text-violet-800 border-violet-200',
    description: 'Un devis est en cours de préparation par l’équipe GTV.',
  },
  DEVIS_ENVOYE: {
    label: 'Devis transmis',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Le devis a été préparé par l’équipe commerciale GTV.',
  },
  CLOS: {
    label: 'Demande clôturée',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Cette demande est clôturée. Contactez GTV pour toute nouvelle demande.',
  },
};

const OBJECTIVE_LABELS: Record<string, string> = {
  NOTORIETE: 'Faire connaître ma marque',
  TRAFIC: 'Générer du trafic',
  LANCEMENT: 'Lancer un produit ou service',
  PROMOTION: 'Communiquer sur une promotion',
  IMAGE: 'Développer mon image de marque',
  SENSIBILISATION: 'Sensibiliser le public',
  RECRUTEMENT: 'Recruter ou mobiliser',
  EVENEMENT: 'Promouvoir un événement',
};

export function VisitorRequestTrackingPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [request, setRequest] = useState<VisitorTrackedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    visitorApi.track(token)
      .then(({ data }) => { if (active) setRequest(data); })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const status = request ? STATUS_LABELS[request.status] : undefined;
  const currency = request?.plan[0]?.currency ?? 'XAF';
  const total = request?.plan.reduce((sum, line) => sum + line.grossTotal, 0) ?? 0;

  return (
    <VisitorShell>
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
        {loading && (
          <div className="surface-card px-6 py-12 text-center text-sm text-slate-500">
            Chargement du suivi de votre demande…
          </div>
        )}

        {!loading && error && (
          <div className="surface-card px-6 py-12 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-xl text-amber-600">!</div>
            <h1 className="text-xl font-bold text-slate-800">Lien de suivi indisponible</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Ce lien peut avoir expiré ou être incorrect. Pour toute question, contactez l’équipe commerciale GTV.
            </p>
            <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#003189] px-4 text-sm font-bold text-white">
              Retour à l’accueil
            </Link>
          </div>
        )}

        {!loading && request && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#009A44]">Suivi de demande</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Votre demande a bien été enregistrée
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Référence <span className="font-mono font-bold text-slate-700">{request.reference}</span>
            </p>

            <section className={`mt-6 rounded-xl border p-5 ${status?.tone ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <p className="text-sm font-bold">{status?.label ?? request.status}</p>
              <p className="mt-1 text-sm leading-6">{status?.description ?? 'Votre demande est enregistrée.'}</p>
              <p className="mt-3 text-xs opacity-70">
                Envoyée le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(request.submittedAt))}
              </p>
            </section>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Conservez l’adresse de cette page pour revenir consulter le suivi. Aucun compte n’est nécessaire.
            </p>

            <section className="surface-card mt-5 p-5">
              <h2 className="text-sm font-bold text-slate-800">Résumé de votre brief</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <Summary label="Objectif" value={OBJECTIVE_LABELS[request.brief.objective] ?? request.brief.objective} />
                <Summary label="Audience" value={request.brief.targetSegment || 'Non communiquée'} />
                <Summary label="Budget indicatif" value={request.brief.budgetHT ? money(request.brief.budgetHT, 'XAF') : 'Non communiqué'} />
                <Summary label="Période souhaitée" value={
                  request.brief.periodStart || request.brief.periodEnd
                    ? `${request.brief.periodStart ?? '…'} — ${request.brief.periodEnd ?? '…'}`
                    : 'Non communiquée'
                } />
              </dl>
            </section>

            {request.plan.length > 0 && (
              <section className="surface-card mt-5 overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-800">Formats proposés à l’étude</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {request.plan.map((line, index) => (
                    <div key={`${line.formatId}-${line.daypart}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-slate-700">{line.formatLabel}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-400">{line.channel} · {line.daypart} · {line.quantity} passage(s)</p>
                      </div>
                      <p className="shrink-0 font-mono text-xs font-semibold text-slate-600">{money(line.grossTotal, line.currency)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm">
                  <span className="font-semibold text-slate-500">Total indicatif brut</span>
                  <span className="font-bold text-slate-800">{money(total, currency)}</span>
                </div>
              </section>
            )}

            <p className="mt-5 text-xs leading-5 text-slate-400">
              Ce suivi concerne une demande de devis uniquement. Les tarifs et disponibilités restent à confirmer par GTV; aucun espace n’est réservé.
            </p>
            <Link to="/" className="mt-6 inline-flex text-sm font-semibold text-[#003189] hover:underline">
              Retour à l’accueil
            </Link>
          </>
        )}
      </main>
    </VisitorShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

function money(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}
