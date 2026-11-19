// =============================================================================
// GTV Media Sales — Moteur de scoring complet (6 critères C1→C6)
// Conforme CDCF §5.3 — déterministe, explicable, paramétrable en back-office
//
// POURQUOI 6 critères et non 4 :
// Le CDCF impose C1 (matrice objectif×format), C5 (répétition finançable)
// et C6 (contexte sectoriel) en plus des critères d'audience.
// Ces critères sont les plus importants pour la pertinence commerciale.
// =============================================================================

import type { Daypart } from '../types';

// =============================================================================
// Types d'entrée du moteur
// =============================================================================

export type CampaignObjective =
  | 'NOTORIETE' | 'TRAFIC' | 'LANCEMENT' | 'PROMOTION'
  | 'IMAGE' | 'SENSIBILISATION' | 'RECRUTEMENT' | 'EVENEMENT';

export type FormatCategory = 'SPOT' | 'PARRAINAGE' | 'HABILLAGE' | 'BANDEAU' | 'DIGITAL' | 'COMMUNIQUE';

// Réponses normalisées du questionnaire (§5.2)
export interface CampaignBrief {
  objective:      CampaignObjective;
  targetSegment:  string;           // ex: FEMMES_25_49
  budgetHT:       number;           // budget indicatif HT en XAF
  flexibility:    0 | 0.10 | 0.20;  // strict / ±10% / ±20%
  periodStart:    string;           // ISO date
  periodEnd:      string;           // ISO date
  sectorCode:     string;           // ex: BRASSERIE, TELECOM
  wantsExclusivity: boolean;
}

// Format candidat enrichi pour le scoring
export interface ScoringCandidate {
  formatId:       string;
  formatCategory: FormatCategory;
  channel:        string;
  daypart:        Daypart;
  grossPriceUnit: number;           // prix unitaire brut (grille validée)
  minOrder:       int;              // minimum de commande
  leadTimeDays:   number;           // délai de livraison créative
  isPublished:    boolean;
  // Données d'audience (nullable → mode dégradé)
  affinityIndex:  number | null;    // base 100
  reachPct:       number | null;
  grp:            number | null;
  // Contexte éditorial
  sectorAffinities: string[];       // secteurs avec affinité positive
  sectorExclusions: string[];       // secteurs incompatibles
}

// Jeu de pondérations chargé depuis scoring_weight_set (base de données)
export interface ScoringWeightSet {
  id:               string;
  versionLabel:     string;
  weights: {
    C1: number;  // adéquation objectif     défaut: 0.30
    C2: number;  // adéquation cible        défaut: 0.25
    C3: number;  // compatibilité budget    défaut: 0.20
    C4: number;  // disponibilité période   défaut: 0.10
    C5: number;  // potentiel répétition    défaut: 0.10
    C6: number;  // contexte sectoriel      défaut: 0.05
  };
  // Matrice objectif × catégorie de format pour C1
  // ex: { "NOTORIETE": { "SPOT": 1.0, "PARRAINAGE": 0.8 } }
  objectiveMatrix: Record<CampaignObjective, Partial<Record<FormatCategory, number>>>;
  // Nombre de passages recommandé par objectif pour C5
  repetitionTargets: Record<CampaignObjective, number>;
}

// Résultat de scoring pour un format
export interface ScoringResultFull {
  formatId:   string;
  score:      number;             // 0–100
  rank:       number;
  isExcluded: boolean;
  exclusionReason?: string;
  criteriaScores: {
    C1: CriterionScore; C2: CriterionScore; C3: CriterionScore;
    C4: CriterionScore; C5: CriterionScore; C6: CriterionScore;
  };
  // Top 3 raisons en langage naturel (EX-A04)
  reasons: string[];
  // Drapeaux de données manquantes (EX-A03)
  flags: ScoringFlag[];
}

export interface CriterionScore {
  value:    number | null;  // null = donnée absente → neutralisé à 0.5
  weight:   number;
  isNeutral: boolean;       // true si donnée absente
  label:    string;         // libellé pour l'affichage
}

export type ScoringFlag =
  | 'AUDIENCE_NON_COMMUNIQUEE'
  | 'AFFINITE_NON_COMMUNIQUEE'
  | 'DONNEE_PARTIELLE';

// =============================================================================
// FILTRES ÉLIMINATOIRES (appliqués avant scoring — §5.3)
// =============================================================================

export interface EliminationResult {
  passed: boolean;
  reason?: string;
}

export function applyEliminationFilters(
  candidate: ScoringCandidate,
  brief: CampaignBrief,
  campaignDurationDays: number
): EliminationResult {
  if (!candidate.isPublished)
    return { passed: false, reason: 'Format non publié' };

  // Délai de livraison incompatible avec la période
  if (candidate.leadTimeDays >= campaignDurationDays)
    return { passed: false, reason: `Délai de livraison (${candidate.leadTimeDays}j) incompatible avec la durée de campagne` };

  // Secteur interdit ou incompatible
  if (candidate.sectorExclusions.includes(brief.sectorCode))
    return { passed: false, reason: `Incompatibilité sectorielle déclarée : ${brief.sectorCode}` };

  // Exclusivité sectorielle : si demandée, on ne peut pas scorer (géré en amont)
  // Le filtre d'exclusivité est appliqué au niveau du catalogue, pas ici

  // Coût d'entrée > budget × (1 + flexibilité) → exclu
  const budgetMax = brief.budgetHT * (1 + brief.flexibility);
  if (candidate.grossPriceUnit * candidate.minOrder > budgetMax)
    return { passed: false, reason: `Coût d'entrée (${candidate.grossPriceUnit * candidate.minOrder} XAF) dépasse le budget maximum (${Math.round(budgetMax)} XAF)` };

  return { passed: true };
}

// =============================================================================
// CALCULS DES 6 CRITÈRES
// =============================================================================

/**
 * C1 — Adéquation à l'objectif
 * Source : matrice objectif × catégorie de format (éditée en back-office)
 * Valeur entre 0 et 1 selon la matrice validée par GTV
 */
function scoreC1(
  candidate: ScoringCandidate,
  brief: CampaignBrief,
  matrix: ScoringWeightSet['objectiveMatrix']
): CriterionScore {
  const row = matrix[brief.objective];
  const value = row?.[candidate.formatCategory] ?? 0.5; // neutre si absent
  const isNeutral = row?.[candidate.formatCategory] === undefined;
  return {
    value,
    weight: 0, // sera remplacé par le poids du weight_set
    isNeutral,
    label: isNeutral
      ? 'Adéquation à l\'objectif non définie pour ce format'
      : `Adéquation à l\'objectif "${brief.objective}" : ${Math.round(value * 100)}%`,
  };
}

/**
 * C2 — Adéquation à la cible
 * Source : indice d'affinité depuis audience_dataset (base 100)
 * Si absent → neutralité 0.5 + flag AUDIENCE_NON_COMMUNIQUEE
 * POURQUOI 0.5 et non 0 : §5.3 impose la neutralité, pas la pénalité
 */
function scoreC2(candidate: ScoringCandidate): CriterionScore {
  if (candidate.affinityIndex === null) {
    return {
      value: 0.5,
      weight: 0,
      isNeutral: true,
      label: 'Audience non communiquée par la régie',
    };
  }
  // Normalisation : base 100 → [0,1], plage [50,150]
  const value = Math.max(0, Math.min(1, (candidate.affinityIndex - 50) / 100));
  return {
    value,
    weight: 0,
    isNeutral: false,
    label: `Affinité cible : indice ${candidate.affinityIndex} (base 100)`,
  };
}

/**
 * C3 — Compatibilité budgétaire
 * 1 si coût d'entrée ≤ budget ; décroissance linéaire jusqu'à 0
 * au-delà de budget × (1 + flexibilité)
 */
function scoreC3(candidate: ScoringCandidate, brief: CampaignBrief): CriterionScore {
  const coutEntree = candidate.grossPriceUnit * candidate.minOrder;
  const budgetMax  = brief.budgetHT * (1 + brief.flexibility);

  if (
    !Number.isFinite(coutEntree) ||
    !Number.isFinite(brief.budgetHT) ||
    brief.budgetHT <= 0 ||
    !Number.isFinite(budgetMax) ||
    budgetMax <= brief.budgetHT
  ) {
    return {
      value: null,
      weight: 0,
      isNeutral: true,
      label: 'Compatibilité budgétaire non calculable avec les données disponibles',
    };
  }

  let value: number;
  if (coutEntree <= brief.budgetHT) {
    value = 1.0;
  } else if (coutEntree <= budgetMax) {
    // Décroissance linéaire entre budget et budgetMax
    value = 1 - (coutEntree - brief.budgetHT) / (budgetMax - brief.budgetHT);
  } else {
    value = 0; // ne devrait pas arriver (filtre éliminatoire)
  }

  return {
    value,
    weight: 0,
    isNeutral: false,
    label: value === 1
      ? 'Accessible dans votre budget'
      : `Accessible avec une flexibilité de ${Math.round(brief.flexibility * 100)}%`,
  };
}

/**
 * C4 — Disponibilité sur la période (critère éliminatoire binaire)
 * 1 si disponible et délai respecté, 0 sinon
 * Note : les formats non disponibles sont déjà filtrés en amont
 * Ce critère confirme la disponibilité après filtrage
 */
function scoreC4(candidate: ScoringCandidate, campaignDurationDays: number): CriterionScore {
  if (!Number.isFinite(candidate.leadTimeDays) || !Number.isFinite(campaignDurationDays) ||
      campaignDurationDays <= 0) {
    return {
      value: null,
      weight: 0,
      isNeutral: true,
      label: 'Disponibilité sur la période non communiquée',
    };
  }
  const value = candidate.leadTimeDays < campaignDurationDays ? 1.0 : 0.0;
  return {
    value,
    weight: 0,
    isNeutral: false,
    label: value === 1
      ? 'Disponible sur votre période de campagne'
      : 'Délai de livraison incompatible',
  };
}

/**
 * C5 — Potentiel de répétition
 * Nombre de passages finançables / nombre de passages recommandé pour l'objectif
 * Plafonné à 1 (on ne récompense pas la sur-répétition)
 */
function scoreC5(
  candidate: ScoringCandidate,
  brief: CampaignBrief,
  repetitionTargets: Record<CampaignObjective, number>
): CriterionScore {
  const effectiveUnitPrice = candidate.grossPriceUnit; // brut, sans remise à ce stade
  if (!Number.isFinite(effectiveUnitPrice) || effectiveUnitPrice <= 0 ||
      !Number.isFinite(brief.budgetHT) || brief.budgetHT <= 0) {
    return {
      value: null,
      weight: 0,
      isNeutral: true,
      label: 'Potentiel de répétition non calculable avec les données disponibles',
    };
  }
  const passagesFinancables = effectiveUnitPrice > 0
    ? Math.floor(brief.budgetHT / effectiveUnitPrice)
    : 0;
  const passagesCibles = repetitionTargets[brief.objective];
  if (!Number.isFinite(passagesCibles) || passagesCibles <= 0) {
    return {
      value: null,
      weight: 0,
      isNeutral: true,
      label: 'Nombre de passages recommandé non communiqué',
    };
  }
  const value = Math.min(1, passagesFinancables / passagesCibles);

  return {
    value,
    weight: 0,
    isNeutral: false,
    label: `${passagesFinancables} passages finançables sur ${passagesCibles} recommandés pour cet objectif`,
  };
}

/**
 * C6 — Contexte éditorial et sectoriel
 * Bonus si affinité secteur × programme
 * Malus ou exclusion si incompatibilité déclarée (déjà filtrée en amont)
 */
function scoreC6(candidate: ScoringCandidate, brief: CampaignBrief): CriterionScore {
  const hasAffinity = candidate.sectorAffinities.includes(brief.sectorCode);
  const value = hasAffinity ? 1.0 : 0.5; // neutre si pas d'affinité déclarée

  return {
    value,
    weight: 0,
    isNeutral: !hasAffinity,
    label: hasAffinity
      ? `Affinité éditoriale avec le secteur ${brief.sectorCode}`
      : 'Contexte éditorial neutre pour ce secteur',
  };
}

// =============================================================================
// FONCTION PRINCIPALE : scoreCampaignOptionFull
// =============================================================================

export function scoreCampaignOptionFull(
  candidate: ScoringCandidate,
  brief: CampaignBrief,
  weightSet: ScoringWeightSet,
  campaignDurationDays: number
): ScoringResultFull {
  // Filtres éliminatoires
  const elimination = applyEliminationFilters(candidate, brief, campaignDurationDays);
  if (!elimination.passed) {
    return buildExcludedResult(candidate.formatId, elimination.reason!);
  }

  // Calcul des 6 critères
  const rawScores = {
    C1: scoreC1(candidate, brief, weightSet.objectiveMatrix),
    C2: scoreC2(candidate),
    C3: scoreC3(candidate, brief),
    C4: scoreC4(candidate, campaignDurationDays),
    C5: scoreC5(candidate, brief, weightSet.repetitionTargets),
    C6: scoreC6(candidate, brief),
  };

  // Injection des poids depuis le weight_set et redistribution des critères absents.
  const keys = ['C1','C2','C3','C4','C5','C6'] as const;
  const activeKeys = keys.filter((k) =>
    rawScores[k].value !== null &&
    !rawScores[k].isNeutral &&
    Number.isFinite(weightSet.weights[k]) &&
    weightSet.weights[k] > 0
  );
  const activeWeightSum = activeKeys.reduce(
    (sum, k) => sum + weightSet.weights[k],
    0
  );

  keys.forEach((k) => {
    rawScores[k].weight = activeKeys.includes(k) && activeWeightSum > 0
      ? weightSet.weights[k] / activeWeightSum
      : 0;
  });

  const score = activeWeightSum > 0
    ? 100 * activeKeys.reduce(
        (sum, k) => sum + rawScores[k].weight * (rawScores[k].value as number),
        0
      )
    : 0;

  // Drapeaux de données manquantes
  const flags: ScoringFlag[] = [];
  if (rawScores.C2.isNeutral) flags.push('AUDIENCE_NON_COMMUNIQUEE');
  if (rawScores.C1.isNeutral) flags.push('DONNEE_PARTIELLE');

  // Top 3 raisons (critères les plus contributeurs)
  const reasons = keys
    .map((k) => ({
      k,
      contribution: rawScores[k].weight * (rawScores[k].value ?? 0),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(({ k }) => rawScores[k].label);

  return {
    formatId: candidate.formatId,
    score:    Math.round(score * 10) / 10,
    rank:     0, // assigné après tri
    isExcluded: false,
    criteriaScores: rawScores,
    reasons,
    flags,
  };
}

/**
 * Recommande et classe N formats pour un brief donné.
 * Conforme EX-A01 (déterminisme), EX-A05 (pas de résultat vide).
 */
export function recommend(
  candidates: ScoringCandidate[],
  brief: CampaignBrief,
  weightSet: ScoringWeightSet,
  campaignDurationDays: number
): { results: ScoringResultFull[]; hasAssouplissement: boolean; assouplissementMessage?: string } {
  const results = candidates.map((c) =>
    scoreCampaignOptionFull(c, brief, weightSet, campaignDurationDays)
  );

  const eligible = results
    .filter((r) => !r.isExcluded)
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // EX-A05 : si aucun résultat, proposer un assouplissement explicite
  if (eligible.length === 0) {
    return {
      results: [],
      hasAssouplissement: true,
      assouplissementMessage: buildAssouplissementMessage(brief),
    };
  }

  return { results: eligible, hasAssouplissement: false };
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function buildExcludedResult(formatId: string, reason: string): ScoringResultFull {
  const neutral: CriterionScore = { value: null, weight: 0, isNeutral: true, label: reason };
  return {
    formatId, score: 0, rank: 0, isExcluded: true, exclusionReason: reason,
    criteriaScores: { C1: neutral, C2: neutral, C3: neutral, C4: neutral, C5: neutral, C6: neutral },
    reasons: [reason], flags: [],
  };
}

/**
 * EX-A05 — Message d'assouplissement si aucun format ne passe les filtres
 * Propose des pistes concrètes plutôt qu'un résultat vide
 */
function buildAssouplissementMessage(brief: CampaignBrief): string {
  const suggestions: string[] = [];
  if (brief.flexibility < 0.20)
    suggestions.push(`augmenter la flexibilité budgétaire à ±20% (budget actuel : ${brief.budgetHT.toLocaleString('fr-FR')} XAF)`);
  suggestions.push('élargir la période de campagne pour inclure plus de formats disponibles');
  suggestions.push('contacter directement la régie pour une offre sur mesure');
  return `Aucun format ne correspond exactement à vos critères. Vous pourriez : ${suggestions.join(' · ')}.`;
}

// Type helper
type int = number;
