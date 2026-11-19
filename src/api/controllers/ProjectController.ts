// =============================================================================
// GTV Media Sales — Controller : Projects
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { Errors } from '../errors/AppError';
import type { ApiResponse } from '../types';

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
        campaignStart: campaignStart ? new Date(campaignStart) : undefined,
        campaignEnd:   campaignEnd   ? new Date(campaignEnd)   : undefined,
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
