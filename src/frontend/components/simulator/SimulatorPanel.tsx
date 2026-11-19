// =============================================================================
// GTV Media Sales — Composant : SimulatorPanel
// Panneau principal du simulateur budgétaire.
// Orchestre : tableau des lignes, jauge budget, avertissements.
// =============================================================================

import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { SimulatorLineRow } from './SimulatorLineRow';
import { BudgetGauge } from '../ui/BudgetGauge';
import { ScoreBadge } from '../ui/ScoreBadge';
import { lineNetPrice, lineGrossPrice } from '../../../engine/simulatorEngine';
import type { SimulatorLine } from '../../../types/simulator';

export function SimulatorPanel() {
  const { lines, budgetTarget, computed, setBudgetTarget } = useSimulatorStore();
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

  const isOverBudget = computed.warnings.some((w) => w.type === 'OVER_BUDGET');

  return (
    <section aria-label="Simulateur budgétaire" className="space-y-4">

      {/* En-tête : budget cible */}
      <div className="flex flex-col items-stretch gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:gap-4">
        <label htmlFor="budget-target" className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:whitespace-nowrap">
          Budget cible (XAF)
        </label>
        <input
          id="budget-target"
          type="number"
          min={0}
          value={budgetTarget || ''}
          onChange={(e) => setBudgetTarget(Number(e.target.value))}
          placeholder="[Budget client]"
          className="form-control w-full !font-mono sm:w-48"
        />
        <div className="w-full min-w-0 flex-1">
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
        <div className="surface-card hidden overflow-x-auto 2xl:block">
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
      {lines.length > 0 && (
        <div className="space-y-3 2xl:hidden">
          {lines.map((line) => (
            <SimulatorLineCard key={line.id} line={line} onRebalanceError={setRebalanceError} />
          ))}
          <div className="surface-card space-y-2 p-4 text-sm">
            <div className="flex justify-between gap-3 font-semibold">
              <span>Total net</span>
              <span className="font-mono">{fmt(computed.totalNet)} XAF</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Total brut</span>
              <span className="font-mono">{fmt(computed.totalGross)} XAF</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SimulatorLineCard({ line, onRebalanceError }: {
  line: SimulatorLine;
  onRebalanceError: (message: string) => void;
}) {
  const { updateQuantity, updateDiscount, toggleLock, rebalance } = useSimulatorStore();
  const [localNetBudget, setLocalNetBudget] = useState(String(Math.round(lineNetPrice(line))));
  const net = lineNetPrice(line);
  const gross = lineGrossPrice(line);

  const handleNetBudgetBlur = () => {
    const parsed = Number(localNetBudget.replace(/\s/g, ''));
    if (Number.isNaN(parsed) || parsed < 0) {
      setLocalNetBudget(String(Math.round(net)));
      return;
    }
    const result = rebalance(line.id, parsed);
    if (!result.success) {
      onRebalanceError(result.warning?.message ?? 'Rééquilibrage impossible.');
      setLocalNetBudget(String(Math.round(net)));
    }
  };

  return (
    <article className={`surface-card min-w-0 p-4 ${line.isLocked ? 'bg-slate-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-bold text-slate-800">{line.formatLabel}</h3>
          <p className="mt-1 break-words text-xs text-slate-500">{line.channel} · {line.daypart}</p>
        </div>
        <ScoreBadge scoring={line.scoring} />
        <button
          type="button"
          onClick={() => toggleLock(line.id)}
          aria-label={line.isLocked ? `Déverrouiller ${line.formatLabel}` : `Verrouiller ${line.formatLabel}`}
          aria-pressed={line.isLocked}
          className="shrink-0 text-lg"
        >
          {line.isLocked ? '🔒' : '🔓'}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-500">
          Quantité
          <input
            type="number"
            min={0}
            value={line.quantity}
            disabled={line.isLocked}
            onChange={(event) => updateQuantity(line.id, Number(event.target.value))}
            className="form-control mt-1 !min-h-[38px] !px-2 !py-1 text-center disabled:bg-slate-100"
            aria-label={`Quantité pour ${line.formatLabel}`}
          />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Remise (max. {line.discountMaxPct}%)
          <input
            type="number"
            min={0}
            max={line.discountMaxPct}
            value={line.discountPct}
            disabled={line.isLocked}
            onChange={(event) => updateDiscount(line.id, Number(event.target.value))}
            className="form-control mt-1 !min-h-[38px] !px-2 !py-1 text-center disabled:bg-slate-100"
            aria-label={`Remise pour ${line.formatLabel}`}
          />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Budget net (XAF)
          <input
            type="text"
            value={localNetBudget}
            disabled={line.isLocked}
            onChange={(event) => setLocalNetBudget(event.target.value)}
            onBlur={handleNetBudgetBlur}
            className="form-control mt-1 !min-h-[38px] !px-2 !py-1 text-right font-mono disabled:bg-slate-100"
            aria-label={`Budget net pour ${line.formatLabel}`}
          />
        </label>
        <div className="text-[11px] font-semibold text-slate-500">
          Budget brut (XAF)
          <p className="mt-1 flex min-h-[38px] items-center justify-end font-mono text-sm text-slate-700">{fmt(gross)}</p>
        </div>
      </div>
    </article>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
