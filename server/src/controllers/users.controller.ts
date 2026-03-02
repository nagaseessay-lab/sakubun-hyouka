import { Request, Response, NextFunction } from 'express';
import * as usersService from '../services/users.service';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.query.role as string | undefined;
    const users = await usersService.listUsers(role);
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function bulkCreateUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.bulkCreateUsers(req.body.users);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.updateUser(parseInt(req.params.id), req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.resetPassword(parseInt(req.params.id));
    res.json({ message: 'パスワードをログインIDにリセットしました' });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.deleteUser(parseInt(req.params.id));
    res.json({ message: 'ユーザーを削除しました' });
  } catch (err) {
    next(err);
  }
}
