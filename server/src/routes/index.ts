import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import roundsRoutes from './rounds.routes';
import essaysRoutes from './essays.routes';
import uploadRoutes from './upload.routes';
import assignmentsRoutes from './assignments.routes';
import scoresRoutes from './scores.routes';
import availabilityRoutes from './availability.routes';
import rubricsRoutes from './rubrics.routes';
import notificationsRoutes from './notifications.routes';
import exportRoutes from './export.routes';
import trainingRoutes from './training.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/rounds', roundsRoutes);
router.use('/', essaysRoutes);
router.use('/', uploadRoutes);
router.use('/', assignmentsRoutes);
router.use('/', scoresRoutes);
router.use('/', availabilityRoutes);
router.use('/', rubricsRoutes);
router.use('/', notificationsRoutes);
router.use('/', exportRoutes);
router.use('/', trainingRoutes);

export default router;
