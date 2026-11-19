import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { VisitorShell } from '../components/ui/AppShell';
import { visitorApi, type VisitorCatalogDto, type VisitorCatalogLine } from '../services/api';

const STEPS = [
  {
    number: '01',
    title: 'Découvrez et choisissez les formats',
    body: 'Parcourez les catégories et sélectionnez les options qui vous intéressent.',
  },
  {
    number: '02',
    title: 'Décrivez votre campagne',
    body: 'Précisez votre objectif, votre audience, votre période et votre budget si vous les connaissez.',
  },
  {
    number: '03',
    title: 'Vérifiez et transmettez votre demande',
    body: 'Consultez le récapitulatif puis envoyez votre demande à l’équipe GTV, sans créer de compte.',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  SPOT: 'Spots publicitaires',
  PARRAINAGE: 'Parrainage',
  HABILLAGE: 'Habillage antenne',
  AUTRE: 'Autres formats',
};

const CATEGORY_ORDER = ['SPOT', 'PARRAINAGE', 'HABILLAGE', 'AUTRE'];

export function VisitorLandingPage() {
  const [catalog, setCatalog] = useState<VisitorCatalogDto | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    let active = true;
    visitorApi.catalog()
      .then(({ data }) => { if (active) setCatalog(data); })
      .catch(() => { if (active) setCatalogError(true); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => {
    const groups = (catalog?.lines ?? []).reduce<Record<string, VisitorCatalogLine[]>>((result, line) => {
      (result[line.category] ??= []).push(line);
      return result;
    }, {});

    return Object.entries(groups)
      .sort(([left], [right]) => CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right))
      .map(([category, lines]) => {
        const formatIds = [...new Set(lines.map((line) => line.formatId))];
        return {
          category,
          label: CATEGORY_LABELS[category] ?? category,
          optionCount: lines.length,
          formats: formatIds.map((formatId) => {
            const formatLines = lines.filter((line) => line.formatId === formatId);
            return {
              formatId,
              label: formatLines[0].formatLabel,
              durationSec: formatLines[0].durationSec,
              options: [...new Set(formatLines.map((line) => `${line.channel} · ${line.daypart}`))],
            };
          }),
        };
      });
  }, [catalog]);

  return (
    <VisitorShell>
      <main>
        <section className="relative overflow-hidden bg-[#071b3a] text-white">
          <div className="pointer-events-none absolute -right-36 -top-40 h-[560px] w-[560px] rounded-full border-[72px] border-white/[0.04]" />
          <div className="pointer-events-none absolute right-0 top-24 h-2.5 w-28 rounded-l-full bg-[#FCD116]" />
          <div className="pointer-events-none absolute right-0 top-32 h-2.5 w-40 rounded-l-full bg-[#009A44]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#FCD116]">
                Gabon Télévisions · Espace annonceurs
              </p>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                Votre campagne commence par une bonne idée.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-blue-100/80">
                Découvrez les formats publicitaires renseignés par GTV, composez une première sélection et expliquez-nous votre objectif. Notre équipe commerciale vous accompagne pour confirmer une proposition adaptée.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/campagne"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-[#FCD116] px-6 text-sm font-bold text-[#071b3a] shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition hover:bg-yellow-300"
                >
                  Découvrir les offres
                </Link>
                <a
                  href="#nos-formats"
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Voir les formats
                </a>
              </div>
              <p className="mt-4 text-xs text-blue-100/60">
                Sans compte · Demande de devis non contractuelle
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-white/15 bg-white p-5 text-slate-900 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#009A44]">Votre espace annonceur</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Une démarche simple, accompagnée</h2>
                  </div>
                  <div className="gtv-mark shrink-0" aria-hidden="true">
                    {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {STEPS.map((step) => (
                    <div key={step.number} className="flex gap-4 rounded-xl border border-slate-200 bg-[#f8fafc] p-4">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eaf0fb] text-[11px] font-bold text-[#003189]">{step.number}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{step.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#003189]">
                    Catalogue publicitaire
                  </p>
                  {catalogLoading ? (
                    <p className="mt-1 text-sm text-slate-500">Chargement des formats disponibles…</p>
                  ) : catalogError ? (
                    <p className="mt-1 text-sm text-slate-600">Le catalogue pourra être consulté dans le parcours campagne.</p>
                  ) : catalog?.rateCard ? (
                    <p className="mt-1 text-sm text-slate-700">
                      {catalog.lines.length} option{catalog.lines.length > 1 ? 's' : ''} actuellement renseignée{catalog.lines.length > 1 ? 's' : ''}.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">Les formats seront présentés par l’équipe GTV.</p>
                  )}
                  {catalog?.rateCard?.name.includes('DEMO_FICTIF') && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-800">Catalogue de démonstration · données fictives</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="nos-formats" className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#009A44]">L’offre GTV</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Explorez les formats disponibles.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Les options ci-dessous proviennent du catalogue actif. Sélectionnez celles qui vous intéressent pour construire votre brief.
              </p>
            </div>
            <Link to="/campagne" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[#003189] px-5 text-sm font-bold text-white transition hover:bg-[#002570]">
              Composer ma sélection
            </Link>
          </div>

          {catalogError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              Le catalogue est momentanément indisponible. Vous pourrez tout de même transmettre votre brief à l’équipe GTV.
            </div>
          ) : catalogLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Aucun format n’est publié dans le catalogue pour le moment. Envoyez votre brief; un commercial GTV pourra vous présenter les options disponibles.
            </div>
          ) : (
            <>
              {catalog?.rateCard?.name.includes('DEMO_FICTIF') && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  Aperçu de démonstration : tarifs et données d’audience fictifs, à ne pas utiliser comme grille commerciale réelle.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <article key={category.category} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#003189]/20 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#009A44]">Format publicitaire</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{category.label}</h3>
                      </div>
                      <span className="rounded-full bg-[#eef3fb] px-2.5 py-1 text-[11px] font-bold text-[#003189]">
                        {category.optionCount} option{category.optionCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-4 flex-1 space-y-3">
                      {category.formats.slice(0, 3).map((format) => (
                        <div key={format.formatId} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">{format.label}</p>
                          {format.durationSec && <p className="mt-1 text-xs text-slate-500">Durée : {format.durationSec} secondes</p>}
                          <p className="mt-1 text-xs leading-5 text-slate-500">{format.options.join(' · ')}</p>
                        </div>
                      ))}
                      {category.formats.length > 3 && (
                        <p className="text-xs font-medium text-slate-500">Et {category.formats.length - 3} autre(s) format(s) dans cette catégorie.</p>
                      )}
                    </div>
                    <Link to="/campagne" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#003189] transition group-hover:gap-3">
                      Choisir dans le catalogue <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section id="comment-ca-marche" className="border-y border-slate-200 bg-[#f7f9fc]">
          <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-16">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#009A44]">Votre parcours</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">De la découverte à la demande de devis.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Vous choisissez les formats; l’équipe GTV examine votre brief et confirme les disponibilités et les conditions.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <article key={step.number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef3fb] text-xs font-bold text-[#003189]">{step.number}</span>
                  <h3 className="mt-4 text-base font-bold text-slate-800">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{step.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="font-bold text-blue-950">Prêt à préparer votre campagne ?</p>
                <p className="mt-1 text-sm leading-5 text-blue-900/75">Aucun compte requis. Votre demande ne vaut pas réservation ni commande ferme.</p>
              </div>
              <Link to="/campagne" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[#003189] px-5 text-sm font-bold text-white transition hover:bg-[#002570]">
                Commencer
              </Link>
            </div>
          </div>
        </section>
      </main>
    </VisitorShell>
  );
}
