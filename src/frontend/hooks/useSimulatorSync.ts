// =============================================================================
// GTV Media Sales — Hook : useSimulatorSync
// Synchronise le store Zustand avec les données du projet chargé depuis l'API.
// Utilisé quand on rouvre un projet existant (status DRAFT) pour restaurer
// l'état du simulateur depuis le scoring_snapshot.
// =============================================================================

import { useEffect } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import type { ProjectDto } from '../services/api';
import type { SimulatorLine } from '../../types/simulator';

export function useSimulatorSync(project: ProjectDto | null) {
  const { setBudgetTarget, reset } = useSimulatorStore();

  useEffect(() => {
    if (!project) return;

    // Réinitialise le simulateur à chaque changement de projet
    reset();

    if (project.budgetTarget) {
      setBudgetTarget(project.budgetTarget);
    }

    // Si le projet a un snapshot (projet rouvert), on restaure les lignes
    // Le snapshot contient les lignes sérialisées au moment de la dernière sauvegarde
    if (project.scoringSnapshot) {
      const snapshot = project.scoringSnapshot as { lines?: SimulatorLine[] };
      if (Array.isArray(snapshot.lines)) {
        const { addLine } = useSimulatorStore.getState();
        snapshot.lines.forEach((line) => addLine(line));
      }
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
