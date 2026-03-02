import { Router } from 'express';
import * as essaysController from '../controllers/essays.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadPdf } from '../middleware/upload';

const router = Router();
router.use(authenticate);

router.get('/rounds/:roundId/essays', essaysController.listEssays);
router.get('/rounds/:roundId/essays/csv', requireRole('leader'), essaysController.exportEssaysCsv);
router.put('/rounds/:roundId/essays/bulk-status', requireRole('leader'), essaysController.bulkUpdateStatus);
router.get('/essays/defective', requireRole('leader'), essaysController.getDefectiveEssays);
router.get('/essays/:id', essaysController.getEssay);
router.get('/essays/:id/pdf', essaysController.getEssayPdf);
router.put('/essays/:id/status', requireRole('leader'), essaysController.updateEssayStatus);
router.post('/essays/:id/resolve-defective', requireRole('leader'), essaysController.resolveDefectiveEssay);
router.post('/essays/:id/replace-pdf', requireRole('leader'), uploadPdf.single('pdf'), essaysController.replaceEssayPdf);
router.post('/rounds/:roundId/promote', requireRole('leader'), essaysController.promoteToSecondPhase);

export default router;
