// =============================================================================
// GTV Media Sales — Composant : QuoteSummaryTable
// Tableau récapitulatif du plan média pour la page de soumission.
// Lecture seule — aucune interaction, conçu pour impression/export.
// =============================================================================

import React from 'react';
import { ScoreBadge } from '../ui/ScoreBadge';
import { lineNetPrice, lineGrossPrice } from '../../../engine/simulatorEngine';
import type { SimulatorLine } from '../../../types/simulator';

interface QuoteSummaryTableProps {
  lines: SimulatorLine[];
  totalGross: number;
  totalNet: number;
  budgetTarget: number;
}

export function QuoteSummaryTable({
  lines,
  totalGross,
  totalNet,
  budgetTarget,
}: QuoteSummaryTableProps) {
  const savings = totalGross - totalNet;

  return (
    <div className="surface-card overflow-x-auto print:border-0">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Format / Écran</th>
            <th className="px-4 py-2 text-center">Score</th>
            <th className="px-4 py-2 text-center">Qté</th>
            <th className="px-4 py-2 text-right">PU Brut (XAF)</th>
            <th className="px-4 py-2 text-right">Remise</th>
            <th className="px-4 py-2 text-right">Montant Net (XAF)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium">{line.formatLabel}</div>
                <div className="text-xs text-gray-500">
                  {line.channel} · {line.daypart}
                  {line.isLocked && (
                    <span className="ml-1 text-gray-400" title="Ligne verrouillée">🔒</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2 text-center">
                <ScoreBadge scoring={line.scoring} />
              </td>
              <td className="px-4 py-2 text-center font-mono">{line.quantity}</td>
              <td className="px-4 py-2 text-right font-mono">
                {fmt(line.grossPriceUnit)}
              </td>
              <td className="px-4 py-2 text-right">
                {line.discountPct > 0 ? (
                  <span className="text-emerald-600 font-medium">-{line.discountPct}%</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right font-mono font-semibold">
                {fmt(lineNetPrice(line))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 bg-gray-50 text-sm">
          <tr>
            <td colSpan={5} className="px-4 py-2 text-right text-gray-500">Total brut</td>
            <td className="px-4 py-2 text-right font-mono text-gray-500">{fmt(totalGross)}</td>
          </tr>
          {savings > 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-emerald-600">Économies remises</td>
              <td className="px-4 py-2 text-right font-mono text-emerald-600">-{fmt(savings)}</td>
            </tr>
          )}
          <tr className="font-bold text-base">
            <td colSpan={5} className="px-4 py-2 text-right">Total net</td>
            <td className="px-4 py-2 text-right font-mono">{fmt(totalNet)}</td>
          </tr>
          {budgetTarget > 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-xs">
                Budget cible client
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                {fmt(budgetTarget)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
