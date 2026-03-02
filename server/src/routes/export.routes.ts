import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.post('/rounds/:roundId/export', authenticate, requireRole('leader'), exportController.generateExport);
router.get('/exports/:filename', authenticate, requireRole('leader'), exportController.downloadExport);
router.get('/evaluator-stats', authenticate, requireRole('leader'), exportController.getEvaluatorStats);
router.post('/evaluator-stats/export', authenticate, requireRole('leader'), exportController.exportEvaluatorStats);

export default router;
