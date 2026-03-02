import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/notifications', notificationsController.getNotifications);
router.put('/notifications/:id/read', notificationsController.markAsRead);
router.put('/notifications/read-all', notificationsController.markAllAsRead);

export default router;
