import { Router } from 'express';
import { z } from 'zod';
import * as roundsController from '../controllers/rounds.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const createRoundSchema = z.object({
  name: z.string().min(1).max(200),
  phaseType: z.enum(['first_only', 'second_only', 'both']),
  pagesPerEssay: z.number().int().min(1).max(20),
  secondEvaluatorCount: z.number().int().min(1).max(3).default(1),
  firstPhaseTopCount: z.number().int().min(1).default(300),
  isDemo: z.boolean().optional(),
});

const updateRoundSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phaseType: z.enum(['first_only', 'second_only', 'both']).optional(),
  pagesPerEssay: z.number().int().min(1).max(20).optional(),
  secondEvaluatorCount: z.number().int().min(1).max(3).optional(),
  firstPhaseTopCount: z.number().int().min(1).optional(),
  isDemo: z.boolean().optional(),
});

const statusSchema = z.object({
  status: z.enum(['draft', 'uploading', 'first_phase', 'first_complete', 'second_phase', 'second_complete', 'archived']),
});

router.use(authenticate);
router.get('/', roundsController.listRounds);
router.get('/:id', roundsController.getRound);
router.get('/:id/progress', roundsController.getProgress);
router.get('/:id/rankings', requireRole('leader'), roundsController.getRankings);

router.post('/', requireRole('leader'), validate(createRoundSchema), roundsController.createRound);
router.put('/:id', requireRole('leader'), validate(updateRoundSchema), roundsController.updateRound);
router.put('/:id/status', requireRole('leader'), validate(statusSchema), roundsController.transitionStatus);
router.delete('/:id', requireRole('leader'), roundsController.deleteRound);

export default router;
