// =============================================================================
// GTV Media Sales — Composant : SimulatorPanel
// Panneau principal du simulateur budgétaire.
// Orchestre : tableau des lignes, jauge budget, avertissements.
// =============================================================================

import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { SimulatorLineRow } from './SimulatorLineRow';
import { BudgetGauge } from '../ui/BudgetGauge';

export function SimulatorPanel() {
  const { lines, budgetTarget, computed, setBudgetTarget } = useSimulatorStore();
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

  const isOverBudget = computed.warnings.some((w) => w.type === 'OVER_BUDGET');

  return (
    <section aria-label="Simulateur budgétaire" className="space-y-4">

      {/* En-tête : budget cible */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <label htmlFor="budget-target" className="text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">
          Budget cible (XAF)
        </label>
        <input
          id="budget-target"
          type="number"
          min={0}
          value={budgetTarget || ''}
          onChange={(e) => setBudgetTarget(Number(e.target.value))}
          placeholder="[Budget client]"
          className="form-control w-48 !font-mono"
        />
        <div className="flex-1">
          <BudgetGauge
            totalNet={computed.totalNet}
            budgetTarget={budgetTarget}
            budgetUsagePct={computed.budgetUsagePct}
            isOverBudget={isOverBudget}
          />
        </div>
      </div>

      {/* Avertissements globaux */}
      {computed.warnings.length > 0 && (
        <div role="alert" className="space-y-1">
          {computed.warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded ${
                w.type === 'OVER_BUDGET' || w.type === 'ALL_LOCKED'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Erreur de rééquilibrage */}
      {rebalanceError && (
        <div role="alert" className="text-xs px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200">
          {rebalanceError}
          <button
            onClick={() => setRebalanceError(null)}
            className="ml-2 underline"
            aria-label="Fermer l'avertissement"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tableau des lignes */}
      {lines.length === 0 ? (
        <div className="surface-card py-12 text-center text-sm text-slate-400">
          <p className="font-semibold text-slate-600">Aucune ligne dans le plan média</p>
          <p className="mt-1 text-xs">Utilisez l'assistant pour ajouter des options.</p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Format / Écran</th>
                <th className="px-3 py-2 text-center">Score</th>
                <th className="px-3 py-2 text-center">Qté</th>
                <th className="px-3 py-2 text-center">Remise</th>
                <th className="px-3 py-2 text-right">Budget net (XAF)</th>
                <th className="px-3 py-2 text-right">Brut (XAF)</th>
                <th className="px-3 py-2 text-center">Verrou</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <SimulatorLineRow
                  key={line.id}
                  line={line}
                  onRebalanceError={setRebalanceError}
                />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold text-sm border-t-2">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmt(computed.totalNet)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">
                  {fmt(computed.totalGross)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
