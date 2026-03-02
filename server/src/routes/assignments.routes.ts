import { Router } from 'express';
import * as assignmentsController from '../controllers/assignments.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/assignments/me', assignmentsController.getMyAssignments);
router.get('/rounds/:roundId/assignments', requireRole('leader'), assignmentsController.getRoundAssignments);
router.post('/rounds/:roundId/auto-assign', requireRole('leader'), assignmentsController.autoAssign);
router.post('/rounds/:roundId/auto-assign/preview', requireRole('leader'), assignmentsController.previewAutoAssign);
router.post('/rounds/:roundId/auto-assign/confirm', requireRole('leader'), assignmentsController.confirmAutoAssign);
router.post('/rounds/:roundId/auto-assign/generate-mapping', requireRole('leader'), assignmentsController.generateMapping);
router.post('/rounds/:roundId/auto-assign/confirm-mapping', requireRole('leader'), assignmentsController.confirmAutoAssignWithMapping);
router.post('/assignments', requireRole('leader'), assignmentsController.manualAssign);
router.put('/assignments/:id', requireRole('leader'), assignmentsController.reassign);
router.put('/assignments/:id/reopen', requireRole('leader'), assignmentsController.reopenAssignment);
router.delete('/assignments/:id', requireRole('leader'), assignmentsController.removeAssignment);

router.post('/rounds/:roundId/bulk-reassign', requireRole('leader'), assignmentsController.bulkReassign);

export default router;
