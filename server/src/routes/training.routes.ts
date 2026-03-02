import { Router } from 'express';
import * as trainingController from '../controllers/training.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadPdf, uploadCsv } from '../middleware/upload';

const router = Router();
router.use(authenticate);

// Leader management routes
router.get('/trainings', trainingController.listTrainings);
router.get('/trainings/:id', trainingController.getTraining);
router.post('/trainings', requireRole('leader'), trainingController.createTraining);
router.delete('/trainings/:id', requireRole('leader'), trainingController.deleteTraining);
router.post('/trainings/:id/items', requireRole('leader'), trainingController.addTrainingItem);
router.post('/trainings/:id/items/upload', requireRole('leader'), uploadPdf.single('pdf'), trainingController.addTrainingItemWithPdf);
router.put('/trainings/items/:itemId', requireRole('leader'), trainingController.updateTrainingItem);
router.delete('/trainings/items/:itemId', requireRole('leader'), trainingController.deleteTrainingItem);
router.get('/trainings/items/:itemId/pdf', trainingController.getTrainingItemPdf);
router.get('/trainings/completions/list', requireRole('leader'), trainingController.getTrainingCompletions);
router.post('/trainings/completions/export', requireRole('leader'), trainingController.exportCompletions);

// Publish and assignment routes (leader only)
router.put('/trainings/:id/publish', requireRole('leader'), trainingController.togglePublish);
router.post('/trainings/:id/assign-users', requireRole('leader'), trainingController.assignTrainingUsers);
router.get('/trainings/:id/assignments', requireRole('leader'), trainingController.getTrainingAssignments);
router.delete('/trainings/:id/assign-users/:userId', requireRole('leader'), trainingController.removeTrainingAssignment);
router.post('/trainings/:id/assign-users/csv', requireRole('leader'), uploadCsv.single('csv'), trainingController.assignTrainingUsersByCsv);

// Evaluator routes
router.get('/trainings/me/list', trainingController.getMyTrainings);
router.post('/trainings/:id/attempt', trainingController.startAttempt);
router.post('/trainings/attempts/:attemptId/respond', trainingController.submitResponse);
router.post('/trainings/attempts/:attemptId/complete', trainingController.completeAttempt);

export default router;
