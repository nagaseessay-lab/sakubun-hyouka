import { Router } from 'express';
import { z } from 'zod';
import * as usersController from '../controllers/users.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const createUserSchema = z.object({
  loginId: z.string().length(6),
  displayName: z.string().min(1).max(100),
  role: z.enum(['evaluator', 'leader']),
});

const bulkCreateSchema = z.object({
  users: z.array(z.object({
    loginId: z.string().length(6),
    displayName: z.string().min(1).max(100),
    role: z.enum(['evaluator', 'leader']),
  })).min(1).max(500),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(['evaluator', 'leader']).optional(),
  isActive: z.boolean().optional(),
});

router.use(authenticate, requireRole('leader'));

router.get('/', usersController.listUsers);
router.post('/', validate(createUserSchema), usersController.createUser);
router.post('/bulk', validate(bulkCreateSchema), usersController.bulkCreateUsers);
router.put('/:id', validate(updateUserSchema), usersController.updateUser);
router.put('/:id/password', usersController.resetPassword);
router.delete('/:id', usersController.deleteUser);

export default router;
