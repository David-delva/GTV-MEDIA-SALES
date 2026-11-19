// =============================================================================
// GTV Media Sales — Routeur principal (version complète Phase 4)
// =============================================================================

import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { AudienceRepository } from '../repositories/AudienceRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { RateCardController } from '../controllers/RateCardController';
import { ScoringController } from '../controllers/ScoringController';
import { ProjectController } from '../controllers/ProjectController';
import { AudienceController } from '../controllers/AudienceController';
import { AuthController } from '../controllers/AuthController';
import { PublicVisitorController } from '../controllers/PublicVisitorController';
import { PublicVisitorRepository } from '../repositories/PublicVisitorRepository';
import { AdminUserController } from '../controllers/AdminUserController';
import { AdminUserRepository } from '../repositories/AdminUserRepository';

export function buildRouter(db: Pool): Router {
  const router = Router();

  // Repositories
  const rateCardRepo = new RateCardRepository(db);
  const audienceRepo = new AudienceRepository(db);
  const projectRepo  = new ProjectRepository(db);

  // Controllers
  const authCtrl     = new AuthController(db);
  const rateCardCtrl = new RateCardController(rateCardRepo);
  const scoringCtrl  = new ScoringController(rateCardRepo, audienceRepo);
  const projectCtrl  = new ProjectController(projectRepo, rateCardRepo);
  const audienceCtrl = new AudienceController(audienceRepo);
  const visitorCtrl = new PublicVisitorController(new PublicVisitorRepository(db));
  const adminUserCtrl = new AdminUserController(new AdminUserRepository(db));

  // ── Auth (public) ────────────────────────────────────────────────────────────
  router.post('/auth/login', authCtrl.login);

  // ── Administration ──────────────────────────────────────────────────────────
  router.get('/admin/users', authenticate(db), authorize('ADMIN'), adminUserCtrl.list);
  router.post('/admin/users', authenticate(db), authorize('ADMIN'), adminUserCtrl.create);
  router.patch('/admin/users/:id/active', authenticate(db), authorize('ADMIN'), adminUserCtrl.setActive);
  router.get('/admin/rate-cards', authenticate(db), authorize('ADMIN'), rateCardCtrl.listAll);
  router.post('/admin/rate-cards/:id/lines', authenticate(db), authorize('ADMIN'), rateCardCtrl.addLine);
  router.patch('/admin/rate-cards/:id/lines/:lineId', authenticate(db), authorize('ADMIN'), rateCardCtrl.updateLine);
  router.delete('/admin/rate-cards/:id/lines/:lineId', authenticate(db), authorize('ADMIN'), rateCardCtrl.deleteLine);

  // ── Espace visiteur (public, sans compte obligatoire) ────────────────────────
  router.get('/public/catalog', visitorCtrl.catalog);
  router.post('/public/scoring/batch', visitorCtrl.score);
  router.post('/public/quote-requests', visitorCtrl.submitRequest);
  router.get('/public/quote-requests/:token', visitorCtrl.trackRequest);

  // Boîte de réception des demandes publiques pour l'équipe commerciale
  router.get(
    '/visitor/quote-requests',
    authenticate(db),
    authorize('COMMERCIAL', 'ADMIN'),
    visitorCtrl.inbox
  );
  router.patch(
    '/visitor/quote-requests/:reference/status',
    authenticate(db),
    authorize('COMMERCIAL', 'ADMIN'),
    visitorCtrl.updateStatus
  );

  // ── Formats (lecture seule, tous rôles) ──────────────────────────────────────
  router.get('/formats', authenticate(db), async (_req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT id, code, label, category, duration_sec FROM format WHERE is_active = true ORDER BY category, label`
      );
      res.json({ success: true, data: rows.map((r) => ({
        id: r.id, code: r.code, label: r.label,
        category: r.category, durationSec: r.duration_sec,
      }))});
    } catch (err) { next(err); }
  });

  // ── Rate Cards ───────────────────────────────────────────────────────────────
  router.get('/rate-cards/active',         authenticate(db), rateCardCtrl.getActive);
  router.post('/rate-cards',               authenticate(db), authorize('ADMIN'), rateCardCtrl.create);
  router.patch('/rate-cards/:id/activate', authenticate(db), authorize('ADMIN'), rateCardCtrl.activate);

  // ── Audience ─────────────────────────────────────────────────────────────────
  router.get('/audience/segments/all', authenticate(db), audienceCtrl.allSegments);

  // ── Scoring ──────────────────────────────────────────────────────────────────
  router.post('/scoring',       authenticate(db), authorize('COMMERCIAL', 'ADMIN'), scoringCtrl.score);
  router.post('/scoring/batch', authenticate(db), authorize('COMMERCIAL', 'ADMIN'), scoringCtrl.scoreBatch);

  // ── Clients ──────────────────────────────────────────────────────────────────
  router.get('/clients', authenticate(db), async (_req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT id, name, sector FROM client ORDER BY name`
      );
      res.json({
        success: true,
        data: rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          sector: row.sector as string | null,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Projects ─────────────────────────────────────────────────────────────────
  router.get('/projects',             authenticate(db), projectCtrl.list);
  router.get('/projects/:id',         authenticate(db), projectCtrl.getOne);
  router.post('/projects',            authenticate(db), authorize('COMMERCIAL', 'ADMIN'), projectCtrl.create);
  router.post('/projects/:id/submit', authenticate(db), authorize('COMMERCIAL', 'ADMIN'), projectCtrl.submit);
  router.patch('/projects/:id/status', authenticate(db), authorize('ADMIN'), projectCtrl.updateStatus);

  return router;
}
