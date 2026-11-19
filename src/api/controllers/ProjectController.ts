// =============================================================================
// GTV Media Sales — Controller : Projects
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { AppError, Errors } from '../errors/AppError';
import type { ApiResponse } from '../types';

const ADMIN_PROJECT_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'],
  NEGOTIATION: ['CLOSED_WON', 'CLOSED_LOST'],
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProjectController {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly rateCardRepo: RateCardRepository
  ) {}

  /** GET /api/projects */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Un COMMERCIAL ne voit que ses projets — un ADMIN voit tout
      const ownerId = req.user!.role === 'COMMERCIAL' ? req.user!.id : undefined;
      const status = req.query.status as string | undefined;

      const projects = await this.projectRepo.findAll({ ownerId, status });
      res.json({ success: true, data: projects, meta: { total: projects.length } });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/projects/:id */
  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await this.projectRepo.findById(req.params.id);
      if (!project) return next(Errors.notFound('project', req.params.id));

      // Un COMMERCIAL ne peut voir que ses propres projets
      if (req.user!.role === 'COMMERCIAL' && project.ownerId !== req.user!.id) {
        return next(Errors.forbidden('accès à un projet d\'un autre commercial'));
      }

      res.json({ success: true, data: project } satisfies ApiResponse<typeof project>);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const status = req.body?.status;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      if (typeof status !== 'string') return next(Errors.validation({ field: 'status' }));

      const project = await this.projectRepo.findById(id);
      if (!project) return next(Errors.notFound('project', id));
      if (!ADMIN_PROJECT_TRANSITIONS[project.status]?.includes(status)) {
        return next(Errors.validation({
          message: `Transition de statut impossible : ${project.status} → ${status}.`,
        }));
      }

      const updated = await this.projectRepo.updateStatus(id, project.status, status);
      if (!updated) {
        return next(new AppError('PROJECT_STATUS_CONFLICT', 'Le projet a été modifié. Actualisez la page.', 409));
      }
      res.json({ success: true, data: { id, status } } satisfies ApiResponse<{ id: string; status: string }>);
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/projects */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, clientId, campaignStart, campaignEnd, budgetTarget } = req.body as {
        title?: string;
        clientId?: string;
        campaignStart?: string;
        campaignEnd?: string;
        budgetTarget?: number;
      };

      if (!title || !clientId) {
        return next(Errors.validation({ required: ['title', 'clientId'] }));
      }

      // Résolution automatique de la grille active
      const activeCard = await this.rateCardRepo.findActive();
      if (!activeCard) return next(Errors.notFound('rate_card', 'active'));

      const id = await this.projectRepo.create({
        title,
        clientId,
        ownerId: req.user!.id,
        rateCardId: activeCard.id,
        campaignStart,
        campaignEnd,
        budgetTarget,
      });

      res.status(201).json({ success: true, data: { id } } satisfies ApiResponse<{ id: string }>);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/projects/:id/submit
   * Fige le scoring_snapshot et passe le projet en SUBMITTED.
   * Le snapshot est fourni par le frontend (résultat du dernier appel /scoring/batch).
   * POURQUOI le frontend envoie le snapshot : il a déjà les données calculées,
   * évite un double calcul serveur. Le backend valide juste la structure.
   */
  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await this.projectRepo.findById(req.params.id);
      if (!project) return next(Errors.notFound('project', req.params.id));

      if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
        return next(Errors.forbidden('soumission d\'un projet d\'un autre commercial'));
      }

      if (project.status !== 'DRAFT') {
        return next(Errors.validation({ message: `Impossible de soumettre un projet en statut ${project.status}` }));
      }

      await this.projectRepo.submit(req.params.id, req.body.scoringSnapshot ?? null);
      res.json({ success: true } satisfies ApiResponse<never>);
    } catch (err) {
      next(err);
    }
  };
}
