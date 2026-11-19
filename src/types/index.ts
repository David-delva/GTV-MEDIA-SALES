// =============================================================================
// GTV Media Sales — Contrats de types partagés (front + back)
// =============================================================================

export type Daypart = 'PRIME' | 'DAY' | 'NUIT' | 'WEEKEND';
export type FormatCategory = 'SPOT' | 'PARRAINAGE' | 'HABILLAGE' | 'AUTRE';
export type RateCardStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ProjectStatus = 'DRAFT' | 'SUBMITTED' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

// Mode de calcul du scoring selon la disponibilité des données
export type ScoringMode = 'COMPLET' | 'DÉGRADÉ_PARTIEL' | 'DÉGRADÉ_TOTAL' | 'INDISPONIBLE';

export interface RateCardLine {
  id: string;
  rateCardId: string;
  formatId: string;
  daypart: Daypart;
  channel: string;
  grossPrice: number;
  discountMaxPct: number;
  currency: string;
  isNegotiable: boolean;
}

export interface AudienceDataset {
  id: string;
  formatId: string;
  daypart: Daypart;
  channel: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  targetSegment: string;
  grp: number | null;
  reachPct: number | null;
  affinityIndex: number | null;
}

// Entrée du moteur de scoring
export interface ScoringInput {
  formatId: string;
  daypart: Daypart;
  channel: string;
  targetSegment: string;
}

// Détail d'un critère dans le résultat de scoring
export interface CriterionDetail {
  score: number | null;   // null = donnée absente
  weight: number;         // poids final après redistribution
  rawValue: number | null; // valeur brute pour transparence
}

// Résultat complet du moteur de scoring
export interface ScoringResult {
  score: number | null;   // score final sur 100, null si DÉGRADÉ_TOTAL
  mode: ScoringMode;
  missingCriteria: string[];
  detail: {
    affinite: CriterionDetail;
    reach: CriterionDetail;
    efficacite: CriterionDetail;
    dispo: CriterionDetail;
  };
  dataFreshness: string | null; // date period_end de l'audience utilisée
  reasons: string[];
}
