import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { VisitorShell } from '../components/ui/AppShell';
import { visitorApi } from '../services/api';
import { catalogChannelName, catalogDaypartName, catalogProductName } from '../utils/catalogDisplay';
import { mediaImageForCategory } from '../utils/mediaAssets';
import type {
  ScoredOptionDto,
  VisitorCatalogDto,
  VisitorCatalogLine,
  VisitorRequestPayload,
} from '../services/api';
import type { Daypart } from '../../types';

const OBJECTIVES = [
  ['NOTORIETE', 'Faire connaître ma marque'],
  ['TRAFIC', 'Générer du trafic'],
  ['LANCEMENT', 'Lancer un produit ou service'],
  ['PROMOTION', 'Communiquer sur une promotion'],
  ['IMAGE', 'Développer mon image de marque'],
  ['SENSIBILISATION', 'Sensibiliser le public'],
  ['RECRUTEMENT', 'Recruter ou mobiliser'],
  ['EVENEMENT', 'Promouvoir un événement'],
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  SPOT: 'Spots publicitaires',
  PARRAINAGE: 'Parrainage',
  HABILLAGE: 'Habillage antenne',
  AUTRE: 'Autres formats',
};
const CATEGORY_ORDER = ['SPOT', 'PARRAINAGE', 'HABILLAGE', 'AUTRE'];

type BriefState = {
  objective: string;
  targetSegment: string;
  budgetHT: string;
  periodStart: string;
  periodEnd: string;
  sectorCode: string;
};

type ContactState = {
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  consentMarketing: boolean;
};

const EMPTY_BRIEF: BriefState = {
  objective: '',
  targetSegment: '',
  budgetHT: '',
  periodStart: '',
  periodEnd: '',
  sectorCode: '',
};

const EMPTY_CONTACT: ContactState = {
  companyName: '',
  fullName: '',
  email: '',
  phone: '',
  city: '',
  consentMarketing: false,
};

const optionKey = (line: Pick<VisitorCatalogLine, 'formatId' | 'daypart' | 'channel'> & { rateCardId?: string }) =>
  `${line.rateCardId ?? ''}|${line.formatId}|${line.daypart}|${line.channel}`;

export function VisitorCampaignPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<VisitorCatalogDto | null>(null);
  const [brief, setBrief] = useState<BriefState>(EMPTY_BRIEF);
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState('TOUT');
  const [productSearch, setProductSearch] = useState('');
  const [scores, setScores] = useState<ScoredOptionDto[]>([]);
  const [step, setStep] = useState(1);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    visitorApi.catalog()
      .then(({ data }) => { if (active) setCatalog(data); })
      .catch(() => {
        if (active) setCatalogWarning('Les offres ne sont pas accessibles pour le moment. Vous pouvez poursuivre votre brief sans sélection de format.');
      })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, []);

  const selectedLines = useMemo(() => {
    if (!catalog) return [];
    return catalog.lines.flatMap((line) => {
      const quantity = selected[optionKey(line)];
      return quantity ? [{ line, quantity }] : [];
    });
  }, [catalog, selected]);

  const linesByCategory = useMemo(() => {
    return (catalog?.lines ?? []).reduce<Record<string, VisitorCatalogLine[]>>((groups, line) => {
      (groups[line.category] ??= []).push(line);
      return groups;
    }, {});
  }, [catalog]);

  const visibleLines = useMemo(() => {
    const search = productSearch.trim().toLocaleLowerCase('fr');
    return (catalog?.lines ?? [])
      .filter((line) => {
        const matchesCategory = activeCategory === 'TOUT' || line.category === activeCategory;
        const searchableText = [
          catalogProductName(line.formatLabel),
          line.rateCardName,
          catalogChannelName(line.channel),
          catalogDaypartName(line.daypart),
        ].join(' ').toLocaleLowerCase('fr');
        return matchesCategory && (!search || searchableText.includes(search));
      })
      .sort((left, right) =>
        CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category)
        || left.currency.localeCompare(right.currency)
        || left.grossPrice - right.grossPrice
      );
  }, [activeCategory, catalog, productSearch]);

  const indicativeTotals = selectedLines.reduce<Record<string, number>>((totals, item) => {
    totals[item.line.currency] = (totals[item.line.currency] ?? 0)
      + Math.round(item.line.grossPrice * 100) * item.quantity / 100;
    return totals;
  }, {});
  const indicativeTotalLabel = Object.entries(indicativeTotals)
    .map(([currency, total]) => formatMoney(total, currency))
    .join(' + ');
  const scoreByKey = new Map(
    scores.map((item) => [optionKey(item.option), item.scoring])
  );

  const runScoring = async () => {
    setError(null);
    if (!catalog?.rateCards.length || selectedLines.length === 0) {
      setStep(3);
      return;
    }
    setScoring(true);
    try {
      const result = await visitorApi.score(
        null,
        brief.targetSegment || null,
        selectedLines.map(({ line }) => ({
          rateCardId: line.rateCardId,
          formatId: line.formatId,
          daypart: line.daypart as Daypart,
          channel: line.channel,
        }))
      );
      setScores(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le classement est momentanément indisponible.');
    } finally {
      setScoring(false);
      setStep(3);
    }
  };

  const updateQuantity = (line: VisitorCatalogLine, value: string) => {
    const quantity = Number(value);
    const key = optionKey(line);
    setScores([]);
    setError(null);
    setSelected((current) => {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: Math.min(quantity, 100_000) };
    });
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!brief.objective) {
      setError('Choisissez l’objectif de votre campagne.');
      setStep(2);
      return;
    }
    if (!contact.companyName.trim() || !contact.fullName.trim() || !contact.email.trim()) {
      setError('Renseignez votre organisation, votre nom et votre adresse e-mail.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const selectedRateCardIds = [...new Set(selectedLines.map(({ line }) => line.rateCardId))];
    const payload: VisitorRequestPayload = {
      rateCardId: selectedRateCardIds.length === 1 ? selectedRateCardIds[0] : null,
      brief: {
        objective: brief.objective,
        targetSegment: brief.targetSegment || null,
        budgetHT: brief.budgetHT ? Number(brief.budgetHT) : null,
        periodStart: brief.periodStart || null,
        periodEnd: brief.periodEnd || null,
        sectorCode: brief.sectorCode.trim() || null,
      },
      contact: {
        companyName: contact.companyName.trim(),
        fullName: contact.fullName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || null,
        city: contact.city.trim() || null,
        consentMarketing: contact.consentMarketing,
      },
      selections: selectedLines.map(({ line, quantity }) => ({
        rateCardId: line.rateCardId,
        formatId: line.formatId,
        daypart: line.daypart,
        channel: line.channel,
        quantity,
      })),
      message: message.trim() || null,
    };

    try {
      const { data } = await visitorApi.submit(payload);
      navigate(`/demande/${encodeURIComponent(data.trackingToken)}`, {
        replace: true,
        state: { reference: data.reference },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La demande n’a pas pu être envoyée.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VisitorShell>
      <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
        <Link to="/" className="text-xs font-semibold text-slate-400 transition hover:text-[#0055B8]">
          ← Accueil
        </Link>
        <section className="relative mt-5 overflow-hidden rounded-2xl bg-[#00338D] px-6 py-7 text-white shadow-[0_20px_50px_rgba(7,27,58,0.16)] sm:px-9 sm:py-9">
          <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full border-[34px] border-white/[0.05]" />
          <div className="pointer-events-none absolute right-0 top-10 h-2 w-24 rounded-l-full bg-[#FCD116]" />
          <div className="pointer-events-none absolute right-0 top-16 h-2 w-36 rounded-l-full bg-[#009A44]" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FCD116]">Gabon Télévisions · Espace annonceurs</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Construisons votre prochaine campagne.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Découvrez les formats proposés dans notre catalogue, composez une première sélection et partagez votre brief. Un commercial GTV reviendra vers vous pour confirmer les options et préparer un devis.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Sans compte</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Tarifs indicatifs</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Demande sans engagement</span>
            </div>
          </div>
        </section>

        <div className="mt-6" aria-label={`Étape ${step} sur 4`}>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Votre parcours annonceur</span>
            <span>Étape {step} sur 4</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['Découvrir', 'Brief', 'Récapitulatif', 'Coordonnées'].map((label, index) => (
              <div key={label}>
                <div className={`h-1.5 rounded-full ${index + 1 <= step ? 'bg-[#0055B8]' : 'bg-slate-200'}`} />
                <p className={`mt-2 hidden text-[11px] font-semibold sm:block ${index + 1 === step ? 'text-[#0055B8]' : 'text-slate-400'}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 2 && (
          <section className="surface-card mt-6 p-5 sm:p-7">
            <SectionHeading number="02" title="Parlez-nous de votre campagne" description="Indiquez votre objectif et les informations que vous connaissez. Les champs facultatifs peuvent rester vides." />

            {loadingCatalog ? (
              <LoadingMessage text="Chargement des offres et segments disponibles…" />
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Objectif de campagne" required>
                  <select
                    className="form-control"
                    value={brief.objective}
                    onChange={(event) => setBrief({ ...brief, objective: event.target.value })}
                    required
                  >
                    <option value="">Choisir un objectif</option>
                    {OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Audience recherchée" optional>
                  <select
                    className="form-control"
                    value={brief.targetSegment}
                    onChange={(event) => setBrief({ ...brief, targetSegment: event.target.value })}
                  >
                    <option value="">Je ne sais pas / non communiqué</option>
                    {(catalog?.segments ?? []).map((segment) => <option key={segment} value={segment}>{segment}</option>)}
                  </select>
                </Field>
                <Field label="Budget indicatif (XAF)" optional>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={brief.budgetHT}
                    onChange={(event) => setBrief({ ...brief, budgetHT: event.target.value })}
                    placeholder="Non communiqué"
                  />
                </Field>
                <Field label="Secteur d’activité" optional>
                  <input
                    className="form-control"
                    value={brief.sectorCode}
                    onChange={(event) => setBrief({ ...brief, sectorCode: event.target.value })}
                    placeholder="Votre secteur"
                    maxLength={50}
                  />
                </Field>
                <Field label="Début souhaité" optional>
                  <input className="form-control" type="date" value={brief.periodStart} onChange={(event) => setBrief({ ...brief, periodStart: event.target.value })} />
                </Field>
                <Field label="Fin souhaitée" optional>
                  <input className="form-control" type="date" value={brief.periodEnd} onChange={(event) => setBrief({ ...brief, periodEnd: event.target.value })} />
                </Field>
              </div>
            )}

            {!loadingCatalog && catalog && catalog.rateCards.length > 0 && (
              <p className="mt-5 text-xs text-slate-400">
                {catalog.rateCards.length} grille{catalog.rateCards.length > 1 ? 's' : ''} tarifaire{catalog.rateCards.length > 1 ? 's' : ''} publiée{catalog.rateCards.length > 1 ? 's' : ''} dans le catalogue.
              </p>
            )}
            {catalogWarning && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                {catalogWarning}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Retour aux formats
              </button>
              <button
                type="button"
                disabled={loadingCatalog || !brief.objective || scoring}
                onClick={runScoring}
                className="h-11 rounded-lg bg-[#0055B8] px-5 text-sm font-bold text-white transition hover:bg-[#00338D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scoring ? 'Analyse de votre sélection…' : 'Voir le récapitulatif'}
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="mt-6">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#009A44]">Boutique publicitaire</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Choisissez vos espaces média</h2>
                <p className="mt-2 text-sm text-slate-500">Comparez les formats, les périodes et les tarifs avant de composer votre demande.</p>
              </div>
              {catalog?.rateCards.some((card) => card.name.includes('DEMO_FICTIF')) && (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Boutique démo · tarifs fictifs
                </span>
              )}
            </div>

            {loadingCatalog ? (
              <div className="surface-card min-w-0 p-5 sm:p-7">
                <SectionHeading number="01" title="Offres disponibles" description="Chargement du catalogue publicitaire…" />
                <LoadingMessage text="Chargement des formats disponibles…" />
              </div>
            ) : !catalog || catalog.rateCards.length === 0 || catalog.lines.length === 0 ? (
              <div className="surface-card p-5 sm:p-7">
                <SectionHeading number="01" title="Offres disponibles" description="Vous pouvez transmettre votre brief même sans choisir de format." />
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  La grille tarifaire n’est pas disponible pour le moment. L’équipe GTV pourra vous présenter les options adaptées à votre projet.
                </div>
                <button type="button" onClick={() => setStep(2)} className="mt-5 h-11 rounded-lg bg-[#0055B8] px-5 text-sm font-bold text-white transition hover:bg-[#00338D]">
                  Continuer sans sélection
                </button>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="surface-card min-w-0 p-5 sm:p-7">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">
                      <span className="font-bold text-slate-800">{catalog.lines.length} offres</span>
                      {' · '}{catalog.rateCards.length} grilles publiées
                    </p>
                    <label className="relative w-full sm:w-64">
                      <span className="sr-only">Rechercher un format</span>
                      <input
                        type="search"
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Rechercher un format…"
                        className="form-control !min-h-[40px] pl-9 text-sm"
                      />
                      <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400" aria-hidden="true">⌕</span>
                    </label>
                  </div>

                  <nav aria-label="Catégories de formats" className="mb-6 flex gap-2 overflow-x-auto pb-1">
                    {[['TOUT', 'Tout'], ...Object.entries(linesByCategory)
                      .sort(([left], [right]) => CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right))
                      .map(([category]) => [category, CATEGORY_LABELS[category] ?? category])]
                      .map(([category, label]) => (
                        <button
                          key={category}
                          type="button"
                          aria-pressed={activeCategory === category}
                          onClick={() => setActiveCategory(category)}
                          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${activeCategory === category ? 'bg-[#0055B8] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0055B8]/30 hover:text-[#0055B8]'}`}
                        >
                          {label}
                        </button>
                      ))}
                  </nav>

                  {visibleLines.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                      <p className="font-semibold text-slate-700">Aucune offre ne correspond à votre recherche.</p>
                      <button type="button" onClick={() => { setProductSearch(''); setActiveCategory('TOUT'); }} className="mt-2 text-sm font-bold text-[#0055B8]">
                        Effacer les filtres
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {visibleLines.map((line) => {
                        const key = optionKey(line);
                        const quantity = selected[key] ?? 0;
                        const categoryImage = mediaImageForCategory(line.category);
                        return (
                          <article key={key} className={`group overflow-hidden rounded-2xl border bg-white transition ${quantity ? 'border-[#0055B8]/40 shadow-[0_12px_30px_rgba(0,85,184,0.12)]' : 'border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-lg'}`}>
                            <div className="relative flex h-28 items-end justify-between overflow-hidden bg-[#00338D] p-4 text-white">
                              <img src={categoryImage.src} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-br from-[#00338D]/80 via-[#0055B8]/30 to-[#00338D]/65" />
                              <div className="absolute right-8 top-5 h-2 w-16 rounded-full bg-[#FCD116]" />
                              <div className="absolute right-8 top-9 h-2 w-24 rounded-full bg-[#009A44]" />
                              <span className="relative z-10 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                                {CATEGORY_LABELS[line.category] ?? line.category}
                              </span>
                              <span className="relative z-10 text-xs font-semibold text-white/75">GTV · MEDIA</span>
                            </div>
                            <div className="p-4">
                              <div className="flex min-h-[72px] items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-bold leading-5 text-slate-900">{catalogProductName(line.formatLabel)}</h3>
                                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                    {catalogChannelName(line.channel)} · {catalogDaypartName(line.daypart)}
                                    {line.durationSec ? ` · ${line.durationSec} s` : ''}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-400">{line.rateCardName}</p>
                                </div>
                                {quantity > 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Dans le panier</span>}
                              </div>
                              <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tarif indicatif</p>
                                  <p className="mt-0.5 text-lg font-extrabold tracking-tight text-[#0055B8]">{formatMoney(line.grossPrice, line.currency)}</p>
                                  <p className="text-[11px] text-slate-400">par diffusion</p>
                                </div>
                                <button
                                  type="button"
                                  aria-pressed={quantity > 0}
                                  onClick={() => updateQuantity(line, quantity ? '0' : '1')}
                                  className={`min-h-10 rounded-lg px-3 text-xs font-bold transition ${quantity ? 'border border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-600' : 'bg-[#0055B8] text-white hover:bg-[#00338D]'}`}
                                >
                                  {quantity ? 'Retirer' : 'Ajouter au panier'}
                                </button>
                              </div>
                              {quantity > 0 && (
                                <label className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                  Nombre de diffusions
                                  <input
                                    type="number"
                                    min="1"
                                    max="100000"
                                    value={quantity}
                                    onChange={(event) => updateQuantity(line, event.target.value)}
                                    className="form-control !min-h-[34px] !w-20 !py-1 text-right"
                                    aria-label={`Nombre de diffusions pour ${catalogProductName(line.formatLabel)}`}
                                  />
                                </label>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-5 text-xs leading-5 text-slate-400">
                    Les tarifs affichés sont indicatifs. La sélection constitue une demande de devis, pas une réservation; GTV confirmera les disponibilités et les conditions.
                  </p>
                </div>

                <aside className="surface-card min-w-0 p-5 lg:sticky lg:top-4" aria-label="Votre panier de sélection">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#009A44]">Votre sélection</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Panier de devis</h3>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef3fb] text-sm font-extrabold text-[#0055B8]">{selectedLines.length}</span>
                  </div>

                  {selectedLines.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-slate-700">Votre panier est vide</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Ajoutez les formats qui vous intéressent pour préparer votre devis.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
                        {selectedLines.map(({ line, quantity }) => (
                          <div key={optionKey(line)} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{catalogProductName(line.formatLabel)}</p>
                              <p className="mt-1 text-xs text-slate-500">{line.rateCardName} · {quantity} × {formatMoney(line.grossPrice, line.currency)}</p>
                            </div>
                            <button type="button" onClick={() => updateQuantity(line, '0')} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600" aria-label={`Retirer ${catalogProductName(line.formatLabel)} du panier`}>
                              Retirer
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                        <span className="text-sm font-semibold text-slate-600">Total indicatif</span>
                        <span className="text-lg font-extrabold text-slate-900">{indicativeTotalLabel}</span>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={loadingCatalog}
                    onClick={() => setStep(2)}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0055B8] px-4 text-sm font-bold text-white transition hover:bg-[#00338D] disabled:cursor-wait disabled:opacity-50"
                  >
                    Continuer vers mon brief <span aria-hidden="true">→</span>
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Devis sans engagement · aucun paiement en ligne</p>
                </aside>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="surface-card mt-6 p-5 sm:p-7">
            <SectionHeading
              number="03"
              title="Votre première sélection"
              description="Vérifiez les formats et les quantités avant de transmettre vos coordonnées."
            />

            {selectedLines.length === 0 ? (
              <div className="mt-6 rounded-xl border border-gtv-blue-light/20 bg-gtv-blue-light/10 p-4 text-sm leading-6 text-gtv-blue-dark">
                Vous n’avez sélectionné aucun format. Vous pouvez tout de même envoyer votre brief; un commercial GTV pourra vous orienter.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {selectedLines.map(({ line, quantity }) => {
                  const score = scoreByKey.get(optionKey(line));
                  const lineTotal = Math.round(line.grossPrice * 100) * quantity / 100;
                  return (
                    <article key={optionKey(line)} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800">{line.formatLabel}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {line.channel} · {line.daypart}
                          {line.durationSec ? ` · ${line.durationSec} s` : ''}
                          {' · '}{quantity} passage{quantity > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{formatMoney(lineTotal, line.currency)}</p>
                          <p className="text-[11px] text-slate-400">{formatMoney(line.grossPrice, line.currency)} / passage</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Score indicatif</span>
                          <ScoreBadge scoring={score ?? null} />
                        </div>
                      </div>
                    </article>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-600">
                    Total brut indicatif · {selectedLines.length} option{selectedLines.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {indicativeTotalLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
              Le classement et le montant sont indicatifs. Les scores reposent sur les données disponibles; l’équipe GTV confirmera les options, tarifs et disponibilités.
            </div>

            <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Modifier ma sélection
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="h-11 rounded-lg bg-[#0055B8] px-5 text-sm font-bold text-white transition hover:bg-[#00338D]"
              >
                Continuer vers mes coordonnées
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <form onSubmit={submitRequest} className="surface-card mt-6 p-5 sm:p-7">
            <SectionHeading number="04" title="Vos coordonnées" description="Un commercial GTV utilisera ces informations pour répondre à votre demande." />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Organisation" required>
                <input className="form-control" required maxLength={200} value={contact.companyName} onChange={(event) => setContact({ ...contact, companyName: event.target.value })} autoComplete="organization" />
              </Field>
              <Field label="Nom et prénom" required>
                <input className="form-control" required maxLength={150} value={contact.fullName} onChange={(event) => setContact({ ...contact, fullName: event.target.value })} autoComplete="name" />
              </Field>
              <Field label="Adresse e-mail" required>
                <input className="form-control" type="email" required maxLength={150} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} autoComplete="email" />
              </Field>
              <Field label="Téléphone" optional>
                <input className="form-control" type="tel" maxLength={30} value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" />
              </Field>
              <Field label="Ville" optional>
                <input className="form-control" maxLength={100} value={contact.city} onChange={(event) => setContact({ ...contact, city: event.target.value })} autoComplete="address-level2" />
              </Field>
            </div>

            <Field label="Précisions sur votre besoin" optional>
              <textarea
                className="form-control min-h-28 resize-y"
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Décrivez brièvement votre campagne ou vos questions."
                rows={4}
              />
            </Field>

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-500">
              <input
                type="checkbox"
                checked={contact.consentMarketing}
                onChange={(event) => setContact({ ...contact, consentMarketing: event.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#0055B8]"
              />
              <span>J’accepte de recevoir des informations et actualités commerciales de Gabon Télévisions. Cette autorisation est facultative.</span>
            </label>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Formats sélectionnés</span>
                <span className="font-bold text-slate-800">{selectedLines.length || 'Aucun'}</span>
              </div>
              {selectedLines.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Total indicatif brut</span>
                  <span className="font-bold text-slate-800">{indicativeTotalLabel}</span>
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-400">
                La transmission de cette demande n’engage ni vous ni GTV à réserver ou diffuser un espace publicitaire.
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button type="button" onClick={() => setStep(3)} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Retour au récapitulatif
              </button>
              <button type="submit" disabled={submitting} className="h-11 rounded-lg bg-[#0055B8] px-5 text-sm font-bold text-white transition hover:bg-[#00338D] disabled:cursor-wait disabled:opacity-60">
                {submitting ? 'Envoi en cours…' : 'Envoyer ma demande de devis'}
              </button>
            </div>
          </form>
        )}
      </main>
    </VisitorShell>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef3fb] text-xs font-bold text-[#0055B8]">{number}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, required, optional, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      <span className="mb-2 flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="font-normal text-slate-400">Facultatif</span>}
      </span>
      {children}
    </label>
  );
}

function LoadingMessage({ text }: { text: string }) {
  return <div className="mt-6 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}
