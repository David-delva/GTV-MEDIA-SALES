// =============================================================================
// GTV Media Sales — Moteur du Simulateur Budgétaire
// Algorithme : rééquilibrage proportionnel avec verrous
// POURQUOI ce fichier est pur (pas d'effets de bord) :
// toutes les fonctions sont déterministes → testables unitairement à 100%
// =============================================================================

import type {
  SimulatorLine,
  SimulatorState,
  SimulatorComputed,
  SimulatorWarning,
} from '../types/simulator';

// Tolérance pour considérer le budget comme équilibré (en XAF)
const BALANCE_TOLERANCE = 1;

// =============================================================================
// CALCULS DÉRIVÉS
// =============================================================================

/** Prix net d'une ligne après remise */
export function lineNetPrice(line: SimulatorLine): number {
  return line.grossPriceUnit * line.quantity * (1 - line.discountPct / 100);
}

/** Prix brut d'une ligne sans remise */
export function lineGrossPrice(line: SimulatorLine): number {
  return line.grossPriceUnit * line.quantity;
}

/**
 * Calcule toutes les valeurs dérivées de l'état.
 * Appelée après chaque mutation — jamais stockée, toujours recalculée.
 * POURQUOI : évite les états incohérents (source unique de vérité = les lignes).
 */
export function computeSimulator(
  lines: SimulatorLine[],
  budgetTarget: number
): SimulatorComputed {
  const warnings: SimulatorWarning[] = [];

  if (lines.length === 0) {
    warnings.push({ type: 'NO_LINES', message: 'Aucune ligne dans le plan média.' });
  }

  const totalGross = lines.reduce((acc, l) => acc + lineGrossPrice(l), 0);
  const totalNet   = lines.reduce((acc, l) => acc + lineNetPrice(l), 0);
  const budgetRemaining = budgetTarget - totalNet;
  const budgetUsagePct  = budgetTarget > 0 ? (totalNet / budgetTarget) * 100 : 0;
  const isBalanced      = Math.abs(budgetRemaining) <= BALANCE_TOLERANCE;
  const canRebalance    = lines.some((l) => !l.isLocked);

  // Avertissements
  if (totalNet > budgetTarget + BALANCE_TOLERANCE) {
    warnings.push({ type: 'OVER_BUDGET', message: `Dépassement de ${fmt(totalNet - budgetTarget)} XAF.` });
  }
  if (budgetTarget > 0 && totalNet < budgetTarget * 0.8) {
    warnings.push({ type: 'UNDER_BUDGET', message: `Budget sous-utilisé à ${budgetUsagePct.toFixed(1)}%.` });
  }
  if (lines.length > 0 && !canRebalance) {
    warnings.push({ type: 'ALL_LOCKED', message: 'Toutes les lignes sont verrouillées. Rééquilibrage impossible.' });
  }

  return {
    totalGross,
    totalNet,
    totalBudgetAllocated: totalNet,
    budgetRemaining,
    budgetUsagePct,
    isBalanced,
    canRebalance,
    warnings,
  };
}

// =============================================================================
// ALGORITHME DE RÉÉQUILIBRAGE PROPORTIONNEL
// =============================================================================

/**
 * Rééquilibre les lignes libres après modification d'une ligne cible.
 *
 * Invariant maintenu : Σ lineNetPrice(l) = budgetTarget
 *
 * Stratégie de redistribution :
 *   Chaque ligne libre absorbe une fraction du delta proportionnelle
 *   à son poids budgétaire actuel parmi les lignes libres.
 *
 * Gestion des arrondis :
 *   La dernière ligne libre absorbe le résidu d'arrondi pour garantir
 *   que la somme est exactement égale au budget cible.
 *
 * @returns nouvelles lignes, ou null si le rééquilibrage est impossible
 */
export function rebalanceLines(
  lines: SimulatorLine[],
  changedLineId: string,
  newNetBudget: number,  // budget net souhaité pour la ligne modifiée
  budgetTarget: number
): SimulatorLine[] | null {
  const changedLine = lines.find((l) => l.id === changedLineId);
  if (!changedLine) return null;

  const freeLines = lines.filter((l) => l.id !== changedLineId && !l.isLocked);

  // Bloquant : impossible de rééquilibrer sans lignes libres
  if (freeLines.length === 0) return null;

  const currentNetChanged = lineNetPrice(changedLine);
  const delta = newNetBudget - currentNetChanged; // positif = la ligne augmente

  const sumFreeNet = freeLines.reduce((acc, l) => acc + lineNetPrice(l), 0);

  // Impossible si les lignes libres n'ont pas assez de budget à absorber
  // (on ne peut pas descendre en dessous de 0)
  if (sumFreeNet - delta < 0) return null;

  // Redistribution proportionnelle
  let residual = delta;
  const updatedFree = freeLines.map((line, idx) => {
    const isLast = idx === freeLines.length - 1;
    const currentNet = lineNetPrice(line);

    // Poids de cette ligne parmi les lignes libres
    const weight = sumFreeNet > 0 ? currentNet / sumFreeNet : 1 / freeLines.length;

    // Nouveau budget net pour cette ligne
    const newNet = isLast
      ? currentNet - residual  // absorbe le résidu d'arrondi
      : currentNet - delta * weight;

    residual -= delta * weight;

    // Recalcul de la quantité depuis le nouveau budget net
    // net = grossPriceUnit × qty × (1 - discount/100)
    // qty = net / (grossPriceUnit × (1 - discount/100))
    const effectiveUnitPrice = line.grossPriceUnit * (1 - line.discountPct / 100);
    const newQuantity = effectiveUnitPrice > 0
      ? Math.max(0, Math.round(newNet / effectiveUnitPrice))
      : line.quantity;

    return { ...line, quantity: newQuantity };
  });

  // Reconstruction du tableau complet avec les lignes mises à jour
  const freeIds = new Set(freeLines.map((l) => l.id));
  const updatedFreeMap = new Map(updatedFree.map((l) => [l.id, l]));

  // Mise à jour de la ligne modifiée : recalcul de la quantité depuis newNetBudget
  const effectiveUnitPriceChanged = changedLine.grossPriceUnit * (1 - changedLine.discountPct / 100);
  const newQuantityChanged = effectiveUnitPriceChanged > 0
    ? Math.max(0, Math.round(newNetBudget / effectiveUnitPriceChanged))
    : changedLine.quantity;

  return lines.map((l) => {
    if (l.id === changedLineId) return { ...l, quantity: newQuantityChanged };
    if (freeIds.has(l.id))     return updatedFreeMap.get(l.id)!;
    return l;                  // lignes verrouillées : inchangées
  });
}

// =============================================================================
// VALIDATIONS MÉTIER
// =============================================================================

/** Vérifie qu'une remise ne dépasse pas le plafond autorisé */
export function validateDiscount(line: SimulatorLine, newDiscountPct: number): SimulatorWarning | null {
  if (newDiscountPct > line.discountMaxPct) {
    return {
      type: 'DISCOUNT_EXCEEDED',
      lineId: line.id,
      message: `Remise ${newDiscountPct}% dépasse le plafond autorisé de ${line.discountMaxPct}% pour "${line.formatLabel}".`,
    };
  }
  return null;
}

// Utilitaire d'affichage interne
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
