import { Router } from 'express';
import * as scoresController from '../controllers/scores.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/assignments/:assignmentId/score', scoresController.getScore);
router.put('/assignments/:assignmentId/score', scoresController.saveScore);
router.post('/assignments/:assignmentId/submit', scoresController.submitScore);

export default router;
