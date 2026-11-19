// =============================================================================
// GTV Media Sales — Composant : ScoringRadarChart
// Visualisation radar des scores moyens par critère sur le plan média.
// POURQUOI un radar : permet de voir d'un coup d'œil les forces/faiblesses
// du plan (ex: bonne affinité mais faible reach) — argument visuel fort
// pour la soutenance et pour le commercial face au client.
//
// Implémentation : SVG natif sans dépendance externe.
// POURQUOI SVG natif : pas de bundle supplémentaire, contrôle total,
// accessible via aria-label.
// =============================================================================

import React from 'react';
import type { SimulatorLine } from '../../../types/simulator';

interface ScoringRadarChartProps {
  lines: SimulatorLine[];
}

const CRITERIA = [
  { key: 'affinite',   label: 'Affinité' },
  { key: 'reach',      label: 'Couverture' },
  { key: 'efficacite', label: 'Efficacité' },
  { key: 'dispo',      label: 'Disponibilité' },
] as const;

type CriterionKey = typeof CRITERIA[number]['key'];

export function ScoringRadarChart({ lines }: ScoringRadarChartProps) {
  // Calcul des scores moyens par critère sur toutes les lignes scorées
  const averages = computeAverages(lines);

  const SIZE   = 200;
  const CENTER = SIZE / 2;
  const RADIUS = 80;
  const N      = CRITERIA.length;

  // Coordonnées des axes (polygone régulier)
  const axes = CRITERIA.map((_, i) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return {
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });

  // Points du polygone de données
  const dataPoints = CRITERIA.map((c, i) => {
    const score = averages[c.key] ?? 0; // 0 si donnée absente
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = RADIUS * (score / 100);
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
    };
  });

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  // Grilles de fond (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <figure aria-label="Radar des scores moyens du plan média" className="flex flex-col items-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Graphique radar des critères de scoring"
      >
        {/* Grilles de fond */}
        {gridLevels.map((level) => {
          const pts = CRITERIA.map((_, i) => {
            const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
            return {
              x: CENTER + RADIUS * level * Math.cos(angle),
              y: CENTER + RADIUS * level * Math.sin(angle),
            };
          });
          return (
            <path
              key={level}
              d={toPath(pts)}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}

        {/* Axes */}
        {axes.map((pt, i) => (
          <line
            key={i}
            x1={CENTER} y1={CENTER}
            x2={pt.x}   y2={pt.y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Polygone de données */}
        <path
          d={toPath(dataPoints)}
          fill="rgba(0, 49, 137, 0.13)"
          stroke="rgb(0, 49, 137)"
          strokeWidth="2"
        />

        {/* Points de données */}
        {dataPoints.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="rgb(0, 49, 137)" />
        ))}

        {/* Labels des axes */}
        {CRITERIA.map((c, i) => {
          const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
          const labelR = RADIUS + 18;
          const x = CENTER + labelR * Math.cos(angle);
          const y = CENTER + labelR * Math.sin(angle);
          const score = averages[c.key];
          return (
            <text
              key={c.key}
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill={score === null ? '#9ca3af' : '#374151'}
            >
              {c.label}
              {score === null && ' *'}
            </text>
          );
        })}
      </svg>

      {/* Légende mode dégradé */}
      {Object.values(averages).some((v) => v === null) && (
        <p className="text-xs text-gray-400 mt-1">* Données non disponibles</p>
      )}
    </figure>
  );
}

// Calcul des moyennes par critère sur les lignes ayant un scoring
function computeAverages(
  lines: SimulatorLine[]
): Record<CriterionKey, number | null> {
  const result = {} as Record<CriterionKey, number | null>;

  for (const c of CRITERIA) {
    const scores = lines
      .map((l) => l.scoring?.detail[c.key]?.score)
      .filter((s): s is number => s !== null && s !== undefined);

    result[c.key] = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
      : null;
  }

  return result;
}
