// =============================================================================
// GTV Media Sales — Page : ProjectWorkspace (version connectée)
// Orchestre : chargement des données, sélection de segment, scoring batch,
// synchronisation du simulateur, navigation vers la soumission.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { CampaignAssistant } from '../components/assistant/CampaignAssistant';
import { SimulatorPanel } from '../components/simulator/SimulatorPanel';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { useSimulatorSync } from '../hooks/useSimulatorSync';
import { useSimulatorStore } from '../store/simulatorStore';
import { projectsApi } from '../services/api';
import type { ProjectDto } from '../services/api';
import { AppShell } from '../components/ui/AppShell';
import { ProjectFollowUps } from '../components/projects/ProjectFollowUps';
import { Link } from 'react-router-dom';

interface ProjectWorkspaceProps {
  projectId: string;
  onSubmitSuccess: () => void; // callback navigation post-soumission
}

export function ProjectWorkspace({ projectId, onSubmitSuccess }: ProjectWorkspaceProps) {
  const [project, setProject]           = useState<ProjectDto | null>(null);
  const [targetSegment, setSegment]     = useState('');
  const [loadingProject, setLoadingP]   = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const {
    availableSegments,
    scoredOptions,
    isLoadingRateCard,
    isLoadingOptions,
    error: dataError,
    fetchOptionsForSegment,
  } = useWorkspaceData(project?.rateCardId);

  // Synchronise le simulateur avec le projet chargé
  useSimulatorSync(project);

  const { lines, computed } = useSimulatorStore();

  // Chargement du projet
  useEffect(() => {
    let cancelled = false;
    setLoadingP(true);
    projectsApi.getOne(projectId)
      .then(({ data }) => { if (!cancelled) setProject(data); })
      .catch((err) => { if (!cancelled) setProjectError(err.message); })
      .finally(() => { if (!cancelled) setLoadingP(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  // Déclenche le scoring quand le segment change
  useEffect(() => {
    if (targetSegment) fetchOptionsForSegment(targetSegment);
  }, [targetSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = loadingProject || isLoadingRateCard;
  const error     = projectError ?? dataError;

  if (isLoading) return <WorkspaceLoader />;
  if (error)     return <WorkspaceError message={error} />;
  if (!project)  return null;

  const canSubmit = lines.length > 0 && project.status === 'DRAFT';

  return (
    <AppShell eyebrow="Projet média" title={project.title}>
      <div className="flex min-h-[calc(100vh-147px)] flex-col">
      <header className="border-b border-slate-200/80 bg-white px-5 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
        <Link to="/projects" className="mr-1 text-slate-400 transition hover:text-[#0055B8]" aria-label="Retour aux projets">
          ←
        </Link>
        <div className="min-w-[150px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{project.reference}</span>
          <div className="mt-1 text-xs text-slate-500">Configuration de la campagne</div>
        </div>

        {/* Sélecteur de segment */}
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:basis-auto lg:ml-4">
          <label htmlFor="segment-select" className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:whitespace-nowrap">
            Segment cible :
          </label>
          <select
            id="segment-select"
            value={targetSegment}
            onChange={(e) => setSegment(e.target.value)}
            className="form-control min-w-0 !min-h-[38px] w-full !py-1.5 sm:min-w-[180px] sm:w-auto"
            disabled={availableSegments.length === 0}
          >
            <option value="">-- Choisir un segment --</option>
            {availableSegments.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {availableSegments.length === 0 && (
            <span className="basis-full break-words text-xs text-amber-600">
              ⚠ Aucune donnée d'audience disponible [À REMPLIR PAR GTV]
            </span>
          )}
        </div>

        {/* Résumé budget + bouton soumettre */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:gap-4">
          {project.budgetTarget && (
            <div className="text-sm text-right">
              <div className="font-semibold">{fmt(computed.totalNet)} XAF</div>
              <div className="text-xs text-gray-500">
                sur {fmt(project.budgetTarget)} XAF cible
              </div>
            </div>
          )}
          <Link
            to={canSubmit ? `/projects/${projectId}/submit` : '#'}
            aria-disabled={!canSubmit}
            className={`flex h-10 items-center rounded-lg px-4 text-sm font-bold transition-colors ${
              canSubmit
                ? 'bg-[#0055B8] text-white shadow-[0_8px_18px_rgba(0,85,184,0.14)] hover:bg-[#00338D]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
          >
            Préparer le devis
          </Link>
        </div>
        </div>
      </header>

      {/* Layout split-panel */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-visible lg:flex-row lg:overflow-hidden">

        {/* Panneau gauche : Assistant */}
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-5 lg:w-[390px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Assistant de Campagne
          </h2>
          <CampaignAssistant
            options={scoredOptions}
            isLoading={isLoadingOptions}
            targetSegment={targetSegment}
          />
        </aside>

        {/* Panneau droit : Simulateur */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-6">
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Simulateur Budgétaire
          </h2>
          <SimulatorPanel />
        </div>
      </main>
      <div className="mx-auto w-full max-w-[1600px] px-5 pb-6">
        <ProjectFollowUps projectId={projectId} />
      </div>
      </div>
    </AppShell>
  );
}

// ── Sous-composants utilitaires ───────────────────────────────────────────────

function WorkspaceLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-gtv-blue-light border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm">Chargement du projet…</p>
      </div>
    </div>
  );
}

function WorkspaceError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
        <p className="text-red-700 font-medium">Erreur de chargement</p>
        <p className="text-red-600 text-sm mt-1">{message}</p>
      </div>
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
