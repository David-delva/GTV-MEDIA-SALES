// =============================================================================
// GTV Media Sales — Composant : SimulatorLineRow
// Une ligne du tableau du simulateur budgétaire.
// Gère : quantité, remise, verrou, rééquilibrage au blur.
// =============================================================================

import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { ScoreBadge } from '../ui/ScoreBadge';
import { lineNetPrice, lineGrossPrice } from '../../../engine/simulatorEngine';
import type { SimulatorLine } from '../../../types/simulator';

interface SimulatorLineRowProps {
  line: SimulatorLine;
  onRebalanceError: (message: string) => void;
}

export function SimulatorLineRow({ line, onRebalanceError }: SimulatorLineRowProps) {
  const { updateQuantity, updateDiscount, toggleLock, rebalance } = useSimulatorStore();

  // État local pour l'input budget net (contrôlé localement, rééquilibrage au blur)
  const [localNetBudget, setLocalNetBudget] = useState<string>(
    String(Math.round(lineNetPrice(line)))
  );

  const handleNetBudgetBlur = () => {
    const parsed = Number(localNetBudget.replace(/\s/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      setLocalNetBudget(String(Math.round(lineNetPrice(line))));
      return;
    }
    const result = rebalance(line.id, parsed);
    if (!result.success) {
      onRebalanceError(result.warning?.message ?? 'Rééquilibrage impossible.');
      setLocalNetBudget(String(Math.round(lineNetPrice(line)))); // reset
    }
  };

  const net   = lineNetPrice(line);
  const gross = lineGrossPrice(line);

  return (
    <tr className={`border-t border-slate-100 text-sm ${line.isLocked ? 'bg-slate-50' : 'bg-white'}`}>
      {/* Format / Daypart / Channel */}
      <td className="px-3 py-2">
        <div className="font-medium">{line.formatLabel}</div>
        <div className="text-xs text-gray-500">{line.channel} · {line.daypart}</div>
      </td>

      {/* Score */}
      <td className="px-3 py-2 text-center">
        <ScoreBadge scoring={line.scoring} />
      </td>

      {/* Quantité */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={line.quantity}
          disabled={line.isLocked}
          onChange={(e) => updateQuantity(line.id, Number(e.target.value))}
          className="form-control !min-h-[34px] w-16 !px-1 !py-1 text-center disabled:bg-slate-100"
          aria-label={`Quantité pour ${line.formatLabel}`}
        />
      </td>

      {/* Remise % */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={line.discountMaxPct}
            value={line.discountPct}
            disabled={line.isLocked}
            onChange={(e) => updateDiscount(line.id, Number(e.target.value))}
            className="form-control !min-h-[34px] w-14 !px-1 !py-1 text-center disabled:bg-slate-100"
            aria-label={`Remise pour ${line.formatLabel}`}
          />
          <span className="text-gray-400 text-xs">/ {line.discountMaxPct}%</span>
        </div>
      </td>

      {/* Budget net (rééquilibrage au blur) */}
      <td className="px-3 py-2">
        <input
          type="text"
          value={localNetBudget}
          disabled={line.isLocked}
          onChange={(e) => setLocalNetBudget(e.target.value)}
          onBlur={handleNetBudgetBlur}
          className="form-control !min-h-[34px] w-28 !px-2 !py-1 text-right disabled:bg-slate-100 font-mono"
          aria-label={`Budget net pour ${line.formatLabel}`}
        />
      </td>

      {/* Prix brut (lecture seule) */}
      <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
        {fmt(gross)}
      </td>

      {/* Verrou */}
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => toggleLock(line.id)}
          aria-label={line.isLocked ? `Déverrouiller ${line.formatLabel}` : `Verrouiller ${line.formatLabel}`}
          aria-pressed={line.isLocked}
          className="text-lg hover:scale-110 transition-transform"
          title={line.isLocked ? 'Déverrouiller' : 'Verrouiller'}
        >
          {line.isLocked ? '🔒' : '🔓'}
        </button>
      </td>
    </tr>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
