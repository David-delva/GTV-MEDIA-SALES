// =============================================================================
// GTV Media Sales — Modèle de calcul complet du simulateur (§6.3 CDCF)
// Implémente les formules (1) à (5) du CDCF avec précision décimale stricte
//
// POURQUOI pas de Number natif pour les montants (ENF-13) :
// Les flottants binaires IEEE 754 produisent des erreurs d'arrondi
// (ex: 0.1 + 0.2 ≠ 0.3). On utilise des entiers en centimes (×100)
// pour tous les calculs monétaires, puis on divise à l'affichage.
// =============================================================================

import type { Daypart } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface SimulationLineInput {
  formatId:     string;
  supportId:    string;
  daypart:      Daypart;
  durationSec:  number;
  quantity:     number;           // entier ≥ minOrder
  periodStart:  string;           // ISO date
  periodEnd:    string;           // ISO date
  isLocked:     boolean;
}

// Données de référence pour une ligne (depuis rate_card_line + coefficients)
export interface LineReferenceData {
  tarifBase:          number;     // prix unitaire brut HT (grille validée)
  minOrder:           number;
  coefTranche:        number | null;  // depuis table coefficient type='daypart'
  coefSaisonnalite:   number | null;  // depuis table coefficient type='seasonality'
  discountRules:      DiscountRule[];
  // Données d'audience (nullable)
  audienceAbsolue:    number | null;  // contacts absolus par passage
  partAudiencePct:    number | null;  // part d'audience % pour GRP
}

export interface DiscountRule {
  type:         'volume' | 'conditional';
  thresholdQty: number;
  ratePct:      number;
}

export interface SimulationLineOutput {
  formatId:       string;
  coutBrutCentimes:  number;      // en centimes pour précision
  tauxRemise:     number;         // 0 à 1
  coutNetCentimes:   number;      // en centimes
  coutBrutHT:     number;         // affiché (÷100)
  coutNetHT:      number;         // affiché (÷100)
  weightPct:      number;         // poids dans le total
  // Indicateurs média (null si données absentes)
  contacts:       number | null;
  grp:            number | null;
  dataFlags:      SimulationFlag[];
}

export type SimulationFlag =
  | 'AUDIENCE_NON_COMMUNIQUEE'
  | 'COEF_TRANCHE_ABSENT'
  | 'COEF_SAISONNALITE_ABSENT';

export interface SimulationOutput {
  lines:          SimulationLineOutput[];
  totalHT:        number;
  tvaRate:        number;         // paramétré par GTV
  totalTTC:       number;
  budgetGap:      number;         // totalHT - budgetTarget (négatif = sous budget)
  budgetStatus:   'within' | 'over_soft' | 'over_hard'; // ≤100% / 100-110% / >110%
  // Indicateurs globaux
  grpTotal:       number | null;
  cpmTotal:       number | null;
  totalContacts:  number | null;
  dataFlags:      SimulationFlag[];
  disclaimer:     string;
}

// =============================================================================
// FORMULE (1) — Coût brut d'une ligne
// CoutBrut = TarifBase × NbPassages × CoefTranche × CoefSaisonnalite
// =============================================================================

/**
 * Calcule le coût brut en centimes pour éviter les erreurs de flottants.
 * Les coefficients absents sont traités comme 1.0 avec un flag.
 */
export function computeCoutBrut(
  tarifBase: number,
  quantity: number,
  coefTranche: number | null,
  coefSaisonnalite: number | null
): { coutBrutCentimes: number; flags: SimulationFlag[] } {
  const flags: SimulationFlag[] = [];

  // Coefficients absents → 1.0 (neutre) + flag
  const ct = coefTranche ?? (flags.push('COEF_TRANCHE_ABSENT'), 1.0);
  const cs = coefSaisonnalite ?? (flags.push('COEF_SAISONNALITE_ABSENT'), 1.0);

  // Calcul en centimes : ×100 pour éviter les flottants
  // On arrondit à l'entier le plus proche (centimes)
  const tarifCentimes = Math.round(tarifBase * 100);
  const coutBrutCentimes = Math.round(tarifCentimes * quantity * ct * cs);

  return { coutBrutCentimes, flags };
}

// =============================================================================
// FORMULE (2) — Remises applicables (RG-05)
// Seules les remises présentes dans la grille validée s'appliquent
// =============================================================================

export function computeTauxRemise(
  quantity: number,
  discountRules: DiscountRule[]
): number {
  if (discountRules.length === 0) return 0;

  // Remises volume : on prend le palier le plus élevé applicable
  const volumeRules = discountRules
    .filter((r) => r.type === 'volume' && quantity >= r.thresholdQty)
    .sort((a, b) => b.thresholdQty - a.thresholdQty);

  const bestVolumeRate = volumeRules[0]?.ratePct ?? 0;

  // Les remises conditionnelles sont évaluées séparément (non cumulables par défaut)
  // Elles sont passées en paramètre si leurs conditions sont remplies
  const conditionalRules = discountRules.filter((r) => r.type === 'conditional');
  const bestConditionalRate = conditionalRules.length > 0
    ? Math.max(...conditionalRules.map((r) => r.ratePct))
    : 0;

  // On prend le meilleur taux (non cumulable sauf règle explicite dans la grille)
  return Math.max(bestVolumeRate, bestConditionalRate) / 100;
}

// =============================================================================
// FORMULE (3) — Totaux
// =============================================================================

export function computeTotals(
  lines: SimulationLineOutput[],
  tvaRate: number,
  budgetTarget: number
): Pick<SimulationOutput, 'totalHT' | 'totalTTC' | 'budgetGap' | 'budgetStatus'> {
  // Somme en centimes pour précision
  const totalHT_centimes = lines.reduce((acc, l) => acc + l.coutNetCentimes, 0);
  const totalHT = totalHT_centimes / 100;

  const tva = Math.round(totalHT_centimes * tvaRate) / 100;
  const totalTTC = totalHT + tva;

  const budgetGap = totalHT - budgetTarget;
  const ratio = budgetTarget > 0 ? totalHT / budgetTarget : 0;
  const budgetStatus: SimulationOutput['budgetStatus'] =
    ratio <= 1.0  ? 'within' :
    ratio <= 1.10 ? 'over_soft' : 'over_hard';

  return { totalHT, totalTTC, budgetGap, budgetStatus };
}

// =============================================================================
// FORMULE (4) — Indicateurs média
// Calculés SEULEMENT si audience validée disponible (§6.3)
// =============================================================================

export function computeMediaKpis(lines: SimulationLineOutput[]): {
  grpTotal: number | null;
  cpmTotal: number | null;
  totalContacts: number | null;
} {
  const allHaveContacts = lines.every((l) => l.contacts !== null);
  const allHaveGrp      = lines.every((l) => l.grp !== null);

  if (!allHaveContacts) {
    return { grpTotal: null, cpmTotal: null, totalContacts: null };
  }

  const totalContacts = lines.reduce((acc, l) => acc + (l.contacts ?? 0), 0);
  const grpTotal      = allHaveGrp ? lines.reduce((acc, l) => acc + (l.grp ?? 0), 0) : null;
  const totalHT       = lines.reduce((acc, l) => acc + l.coutNetHT, 0);
  const cpmTotal      = totalContacts > 0 ? (totalHT / totalContacts) * 1000 : null;

  return { grpTotal, cpmTotal, totalContacts };
}

// =============================================================================
// FONCTION PRINCIPALE : computeSimulation
// =============================================================================

export function computeSimulation(
  lineInputs: SimulationLineInput[],
  referenceData: Map<string, LineReferenceData>, // clé: formatId
  budgetTarget: number,
  tvaRate: number
): SimulationOutput {
  const allFlags = new Set<SimulationFlag>();

  // Calcul ligne par ligne
  const lineOutputs: SimulationLineOutput[] = lineInputs.map((input) => {
    const ref = referenceData.get(input.formatId);

    if (!ref) {
      // Format sans données de référence → ligne à 0 avec flag
      return buildEmptyLine(input.formatId);
    }

    // (1) Coût brut
    const { coutBrutCentimes, flags: brutFlags } = computeCoutBrut(
      ref.tarifBase, input.quantity, ref.coefTranche, ref.coefSaisonnalite
    );
    brutFlags.forEach((f) => allFlags.add(f));

    // (2) Remises
    const tauxRemise = computeTauxRemise(input.quantity, ref.discountRules);
    const coutNetCentimes = Math.round(coutBrutCentimes * (1 - tauxRemise));

    // (4) Indicateurs média
    let contacts: number | null = null;
    let grp: number | null = null;
    const lineFlags: SimulationFlag[] = [...brutFlags];

    if (ref.audienceAbsolue !== null) {
      contacts = ref.audienceAbsolue * input.quantity;
    } else {
      lineFlags.push('AUDIENCE_NON_COMMUNIQUEE');
      allFlags.add('AUDIENCE_NON_COMMUNIQUEE');
    }

    if (ref.partAudiencePct !== null) {
      grp = ref.partAudiencePct * input.quantity;
    }

    return {
      formatId:          input.formatId,
      coutBrutCentimes,
      tauxRemise,
      coutNetCentimes,
      coutBrutHT:        coutBrutCentimes / 100,
      coutNetHT:         coutNetCentimes / 100,
      weightPct:         0, // calculé après
      contacts,
      grp,
      dataFlags:         lineFlags,
    };
  });

  // Calcul des poids (après avoir tous les totaux)
  const totalNetCentimes = lineOutputs.reduce((acc, l) => acc + l.coutNetCentimes, 0);
  lineOutputs.forEach((l) => {
    l.weightPct = totalNetCentimes > 0
      ? Math.round((l.coutNetCentimes / totalNetCentimes) * 10000) / 100
      : 0;
  });

  // (3) Totaux
  const totals = computeTotals(lineOutputs, tvaRate, budgetTarget);

  // (4) KPIs globaux
  const kpis = computeMediaKpis(lineOutputs);

  return {
    lines:        lineOutputs,
    tvaRate,
    ...totals,
    ...kpis,
    dataFlags:    Array.from(allFlags),
    disclaimer:   'Estimation indicative non contractuelle, soumise à validation de la régie GTV.',
  };
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function buildEmptyLine(formatId: string): SimulationLineOutput {
  return {
    formatId, coutBrutCentimes: 0, tauxRemise: 0, coutNetCentimes: 0,
    coutBrutHT: 0, coutNetHT: 0, weightPct: 0,
    contacts: null, grp: null,
    dataFlags: ['AUDIENCE_NON_COMMUNIQUEE'],
  };
}
