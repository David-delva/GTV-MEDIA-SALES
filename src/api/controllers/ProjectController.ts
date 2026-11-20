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

  listFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.role === 'COMMERCIAL' ? req.user!.id : undefined;
      const followUps = await this.projectRepo.findFollowUps(ownerId);
      res.json({ success: true, data: followUps });
    } catch (err) {
      next(err);
    }
  };

  listProjectFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      const project = await this.projectRepo.findById(id);
      if (!project) return next(Errors.notFound('project', id));
      if (req.user!.role === 'COMMERCIAL' && project.ownerId !== req.user!.id) {
        return next(Errors.forbidden('accès à un projet d\'un autre commercial'));
      }

      const followUps = await this.projectRepo.findProjectFollowUps(id);
      res.json({ success: true, data: followUps });
    } catch (err) {
      next(err);
    }
  };

  createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      const dueDate = req.body.dueDate;
      if (!note || note.length > 2000) {
        return next(Errors.validation({ field: 'note', maxLength: 2000 }));
      }
      if (typeof dueDate !== 'string' || !isDateOnly(dueDate)) {
        return next(Errors.validation({ field: 'dueDate' }));
      }

      const project = await this.projectRepo.findById(id);
      if (!project) return next(Errors.notFound('project', id));
      if (req.user!.role === 'COMMERCIAL' && project.ownerId !== req.user!.id) {
        return next(Errors.forbidden('accès à un projet d\'un autre commercial'));
      }

      const followUp = await this.projectRepo.createFollowUp({
        projectId: id,
        authorId: req.user!.id,
        note,
        dueDate,
      });
      res.status(201).json({ success: true, data: followUp });
    } catch (err) {
      next(err);
    }
  };

  setFollowUpCompletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, followUpId } = req.params;
      if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(followUpId)) {
        return next(Errors.validation({ field: 'id' }));
      }
      if (!req.body || typeof req.body.completed !== 'boolean') {
        return next(Errors.validation({ field: 'completed' }));
      }

      const project = await this.projectRepo.findById(id);
      if (!project) return next(Errors.notFound('project', id));
      if (req.user!.role === 'COMMERCIAL' && project.ownerId !== req.user!.id) {
        return next(Errors.forbidden('accès à un projet d\'un autre commercial'));
      }

      const updated = await this.projectRepo.setFollowUpCompletion(id, followUpId, req.body.completed);
      if (!updated) return next(Errors.notFound('project_follow_up', followUpId));
      res.json({ success: true, data: { id: followUpId, completed: req.body.completed } });
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
      if (!await this.projectRepo.hasActiveClient(clientId)) {
        return next(Errors.notFound('client', clientId));
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
      if (!id) return next(Errors.notFound('client', clientId));

      res.status(201).json({ success: true, data: { id } } satisfies ApiResponse<{ id: string }>);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }

      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const clientId = req.body.clientId;
      const campaignStart = optionalDate(req.body.campaignStart);
      const campaignEnd = optionalDate(req.body.campaignEnd);
      const budgetTarget = optionalBudget(req.body.budgetTarget);
      if (!title || title.length > 200) return next(Errors.validation({ field: 'title', maxLength: 200 }));
      if (typeof clientId !== 'string' || !UUID_PATTERN.test(clientId)) {
        return next(Errors.validation({ field: 'clientId' }));
      }
      if (campaignStart === undefined || campaignEnd === undefined) {
        return next(Errors.validation({ field: 'campaignDate' }));
      }
      if (campaignStart && campaignEnd && campaignEnd < campaignStart) {
        return next(Errors.validation({ field: 'campaignEnd', message: 'La date de fin doit être postérieure ou égale à la date de début.' }));
      }
      if (budgetTarget === undefined) return next(Errors.validation({ field: 'budgetTarget' }));

      const project = await this.projectRepo.findById(id);
      if (!project) return next(Errors.notFound('project', id));
      if (req.user!.role === 'COMMERCIAL' && project.ownerId !== req.user!.id) {
        return next(Errors.forbidden('modification d\'un projet d\'un autre commercial'));
      }
      if (project.status !== 'DRAFT') {
        return next(new AppError('PROJECT_NOT_EDITABLE', 'Seuls les projets en brouillon peuvent être modifiés.', 409));
      }
      if (!await this.projectRepo.hasActiveClient(clientId)) {
        return next(Errors.notFound('client', clientId));
      }

      const updated = await this.projectRepo.update(id, {
        title,
        clientId,
        campaignStart,
        campaignEnd,
        budgetTarget,
      });
      if (!updated) {
        return next(new AppError('PROJECT_UPDATE_CONFLICT', 'Le projet a changé ou son annonceur n’est plus actif. Actualisez la page.', 409));
      }
      res.json({ success: true, data: { id } });
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

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' && isDateOnly(value) ? value : undefined;
}

function optionalBudget(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
