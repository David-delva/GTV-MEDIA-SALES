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
    <>
      <div className="space-y-3 lg:hidden">
        {lines.map((line) => (
          <article key={line.id} className="surface-card min-w-0 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-bold text-slate-800">{line.formatLabel}</h3>
                <p className="mt-1 break-words text-xs text-slate-500">{line.channel} · {line.daypart}</p>
              </div>
              <ScoreBadge scoring={line.scoring} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3 text-sm">
              <SummaryItem label="Quantité" value={String(line.quantity)} />
              <SummaryItem label="Prix unitaire brut" value={`${fmt(line.grossPriceUnit)} XAF`} />
              <SummaryItem label="Remise" value={line.discountPct > 0 ? `-${line.discountPct}%` : '—'} />
              <SummaryItem label="Montant net" value={`${fmt(lineNetPrice(line))} XAF`} strong />
            </dl>
          </article>
        ))}
        <div className="surface-card space-y-2 p-4 text-sm">
          <SummaryTotal label="Total brut" value={totalGross} />
          {savings > 0 && <SummaryTotal label="Économies remises" value={-savings} tone="text-emerald-700" />}
          <SummaryTotal label="Total net" value={totalNet} strong />
          {budgetTarget > 0 && <SummaryTotal label="Budget cible" value={budgetTarget} tone="text-slate-500" />}
        </div>
      </div>

      <div className="surface-card hidden overflow-x-auto print:border-0 lg:block">
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
    </>
  );
}

function SummaryItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 break-words ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value}</dd>
    </div>
  );
}

function SummaryTotal({ label, value, tone = 'text-slate-700', strong = false }: {
  label: string;
  value: number;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${strong ? 'border-t border-slate-100 pt-2 text-base font-bold' : ''} ${tone}`}>
      <span>{label}</span>
      <span className="font-mono">{fmt(value)} XAF</span>
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
