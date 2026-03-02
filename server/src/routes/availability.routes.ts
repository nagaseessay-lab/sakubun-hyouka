import { Router } from 'express';
import * as availabilityController from '../controllers/availability.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/availability/me', availabilityController.getMyAvailability);
router.put('/availability/me', availabilityController.upsertAvailability);
router.get('/rounds/:roundId/availability', requireRole('leader'), availabilityController.getRoundAvailability);
router.get('/rounds/:roundId/availability/summary', requireRole('leader'), availabilityController.getAvailabilitySummary);

export default router;
