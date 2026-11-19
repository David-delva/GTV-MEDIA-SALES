// =============================================================================
// GTV Media Sales — Composant : BudgetGauge
// Jauge visuelle du budget — accessible (WCAG AA : aria-valuenow, role=meter)
// =============================================================================

import React from 'react';

interface BudgetGaugeProps {
  totalNet: number;
  budgetTarget: number;
  budgetUsagePct: number;
  isOverBudget: boolean;
}

export function BudgetGauge({
  totalNet,
  budgetTarget,
  budgetUsagePct,
  isOverBudget,
}: BudgetGaugeProps) {
  const pct = Math.min(budgetUsagePct, 100); // la barre ne dépasse pas 100% visuellement

  const barColor = isOverBudget
    ? 'bg-red-500'
    : budgetUsagePct >= 90
    ? 'bg-amber-400'
    : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        <span>Budget utilisé</span>
        <span className={isOverBudget ? 'text-red-600 font-bold' : ''}>
          {budgetUsagePct.toFixed(1)}%
        </span>
      </div>

      {/* Barre de progression accessible */}
      <div
        role="meter"
        aria-valuenow={Math.round(budgetUsagePct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget utilisé : ${budgetUsagePct.toFixed(1)}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{fmt(totalNet)} XAF alloués</span>
        <span>Cible : {fmt(budgetTarget)} XAF</span>
      </div>

      {isOverBudget && (
        <p role="alert" className="text-xs text-red-600 font-medium">
          ⚠ Dépassement de {fmt(totalNet - budgetTarget)} XAF
        </p>
      )}
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
