// =============================================================================
// GTV Media Sales — Moteur de scoring de l'Assistant de Campagne
// Algorithme : Weighted Scoring Model multi-critères avec mode dégradé
// =============================================================================

import type {
  RateCardLine,
  AudienceDataset,
  ScoringInput,
  ScoringResult,
  CriterionDetail,
} from '../types';

// -----------------------------------------------------------------------------
// Configuration des poids — modifiable par GTV sans toucher à la logique
// -----------------------------------------------------------------------------
export interface ScoringWeights {
  affinite: number;
  reach: number;
  efficacite: number;
  dispo: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  affinite:   0.40,
  reach:      0.30,
  efficacite: 0.20,
  dispo:      0.10,
};

// CPM de référence pour normaliser l'efficacité budgétaire [À REMPLIR PAR GTV]
// Doit être défini par channel×daypart en production (Phase 2 : table de config)
const CPM_REF_CONFIG: number = NaN; // NaN force le mode dégradé tant que non configuré

// -----------------------------------------------------------------------------
// Utilitaires
// -----------------------------------------------------------------------------

/** Borne une valeur entre min et max */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Arrondit à N décimales */
const round = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

// -----------------------------------------------------------------------------
// Calculs des scores bruts par critère
// Chaque fonction retourne null si la donnée est absente ou invalide
// -----------------------------------------------------------------------------

/**
 * Affinité cible : normalisation linéaire de l'index base 100
 * Plage [50, 150] → [0, 1] : 100 = neutre (0.5), 150 = excellent (1.0)
 */
function scoreAffinite(affinityIndex: number | null): number | null {
  if (affinityIndex === null || !Number.isFinite(affinityIndex)) return null;
  return clamp((affinityIndex - 50) / 100, 0, 1);
}

/**
 * Couverture : reach_pct est déjà en pourcentage, normalisation directe
 */
function scoreReach(reachPct: number | null): number | null {
  if (reachPct === null || !Number.isFinite(reachPct)) return null;
  return clamp(reachPct / 100, 0, 1);
}

/**
 * Efficacité budgétaire : CPM implicite inversé
 * Plus le CPM est bas par rapport à la référence GTV, meilleur est le score
 */
function scoreEfficacite(grossPrice: number, grp: number | null): number | null {
  if (
    !Number.isFinite(grossPrice) ||
    grp === null ||
    !Number.isFinite(grp) ||
    grp <= 0 ||
    !Number.isFinite(CPM_REF_CONFIG) ||
    CPM_REF_CONFIG <= 0
  ) return null;
  const cpmImplicite = grossPrice / grp;
  return clamp(1 - cpmImplicite / CPM_REF_CONFIG, 0, 1);
}

/**
 * Disponibilité : score binaire pondéré
 * is_negotiable = true → 1.0 (pleine flexibilité)
 * is_negotiable = false → 0.5 (valide mais rigide, pas pénalisé à 0)
 */
function scoreDispo(isNegotiable: boolean): number {
  return isNegotiable ? 1.0 : 0.5;
}

// -----------------------------------------------------------------------------
// Redistribution des poids (cœur du mode dégradé)
// Les critères sans donnée sont exclus et leurs poids redistribués
// proportionnellement aux critères actifs — Σ poids_finaux = 1
// -----------------------------------------------------------------------------
function redistributeWeights(
  scores: Record<keyof ScoringWeights, number | null>,
  weights: ScoringWeights
): Record<keyof ScoringWeights, number> {
  const keys = Object.keys(weights) as Array<keyof ScoringWeights>;
  const activeKeys = keys.filter((k) => scores[k] !== null);

  const sumActive = activeKeys.reduce((acc, k) => acc + weights[k], 0);

  return keys.reduce((acc, k) => {
    acc[k] = activeKeys.includes(k) && sumActive > 0
      ? round(weights[k] / sumActive, 6)
      : 0;
    return acc;
  }, {} as Record<keyof ScoringWeights, number>);
}

// -----------------------------------------------------------------------------
// Fonction principale exportée
// -----------------------------------------------------------------------------
export function scoreCampaignOption(
  input: ScoringInput,
  rateLine: RateCardLine | null,
  audience: AudienceDataset | null,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoringResult {

  // Bloquant dur : sans tarif, on ne peut pas calculer l'efficacité ni proposer l'option
  if (rateLine === null) {
    return {
      score: null,
      mode: 'INDISPONIBLE',
      missingCriteria: ['affinite', 'reach', 'efficacite', 'dispo'],
      detail: {
        affinite:   { score: null, weight: 0, rawValue: null },
        reach:      { score: null, weight: 0, rawValue: null },
        efficacite: { score: null, weight: 0, rawValue: null },
        dispo:      { score: null, weight: 0, rawValue: null },
      },
      dataFreshness: null,
      reasons: ['Tarif indisponible pour cette combinaison tarifaire'],
    };
  }

  // Calcul des scores bruts
  const scores = {
    affinite:   scoreAffinite(audience?.affinityIndex ?? null),
    reach:      scoreReach(audience?.reachPct ?? null),
    efficacite: scoreEfficacite(rateLine.grossPrice, audience?.grp ?? null),
    dispo:      scoreDispo(rateLine.isNegotiable), // toujours calculable
  };

  const missingCriteria = (Object.keys(scores) as Array<keyof typeof scores>)
    .filter((k) => scores[k] === null);

  // Cas dégradé total : seul dispo est calculable mais les 3 autres manquent
  // On vérifie si tous les critères basés sur l'audience sont absents
  const audienceCriteriaMissing = ['affinite', 'reach', 'efficacite'].every(
    (k) => scores[k as keyof typeof scores] === null
  );

  const finalWeights = redistributeWeights(scores, weights);

  // Calcul du score final pondéré
  const keys = Object.keys(scores) as Array<keyof typeof scores>;
  const scoreFinale = keys.reduce((acc, k) => {
    const s = scores[k];
    return s !== null ? acc + finalWeights[k] * s : acc;
  }, 0);

  // Construction du détail par critère pour la transparence algorithmique
  const detail: ScoringResult['detail'] = {
    affinite: {
      score: scores.affinite,
      weight: finalWeights.affinite,
      rawValue: audience?.affinityIndex ?? null,
    },
    reach: {
      score: scores.reach,
      weight: finalWeights.reach,
      rawValue: audience?.reachPct ?? null,
    },
    efficacite: {
      score: scores.efficacite,
      weight: finalWeights.efficacite,
      rawValue: audience?.grp ?? null,
    },
    dispo: {
      score: scores.dispo,
      weight: finalWeights.dispo,
      rawValue: rateLine.isNegotiable ? 1 : 0,
    },
  };

  return {
    score: round(scoreFinale * 100, 1),
    mode: audienceCriteriaMissing ? 'DÉGRADÉ_TOTAL' : missingCriteria.length > 0 ? 'DÉGRADÉ_PARTIEL' : 'COMPLET',
    missingCriteria,
    detail,
    dataFreshness: audience?.periodEnd ?? null,
    reasons: keys
      .filter((k) => scores[k] !== null)
      .sort((a, b) =>
        (finalWeights[b] * (scores[b] as number)) -
        (finalWeights[a] * (scores[a] as number))
      )
      .slice(0, 3)
      .map((k) => {
        if (k === 'affinite') return 'Affinité cible prise en compte';
        if (k === 'reach') return 'Couverture de l’audience prise en compte';
        if (k === 'efficacite') return 'Efficacité budgétaire prise en compte';
        return 'Disponibilité tarifaire prise en compte';
      }),
  };
}
