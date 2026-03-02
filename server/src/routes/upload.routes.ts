import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadPdf } from '../middleware/upload';

const router = Router();
router.use(authenticate);

// Upload multiple PDFs (up to 10 at once)
router.post('/rounds/:roundId/upload', requireRole('leader'), uploadPdf.array('pdfs', 10), uploadController.uploadPdf);

// List uploaded PDFs for a round
router.get('/rounds/:roundId/uploads', requireRole('leader'), uploadController.listUploads);

// Delete an uploaded PDF (cascades to its essays)
router.delete('/uploads/:uploadId', requireRole('leader'), uploadController.deleteUpload);

export default router;
