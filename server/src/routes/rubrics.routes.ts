import { Router } from 'express';
import * as rubricsController from '../controllers/rubrics.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/rubrics', rubricsController.listRubrics);
router.get('/rubrics/:id', rubricsController.getRubric);
router.get('/rounds/:roundId/rubric/:phase', rubricsController.getRoundRubric);

router.post('/rubrics', requireRole('leader'), rubricsController.createRubric);
router.put('/rubrics/:id', requireRole('leader'), rubricsController.updateRubric);
router.post('/rubrics/:id/clone', requireRole('leader'), rubricsController.cloneRubric);
router.delete('/rubrics/:id', requireRole('leader'), rubricsController.deleteRubric);
router.post('/rubrics/assign', requireRole('leader'), rubricsController.assignToRound);

export default router;
