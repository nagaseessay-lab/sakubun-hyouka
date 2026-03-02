import { Request, Response, NextFunction } from 'express';
import * as scoresService from '../services/scores.service';

export async function getScore(req: Request, res: Response, next: NextFunction) {
  try {
    const score = await scoresService.getScore(parseInt(req.params.assignmentId), req.user!.userId);
    res.json(score);
  } catch (err) { next(err); }
}

export async function saveScore(req: Request, res: Response, next: NextFunction) {
  try {
    const score = await scoresService.saveScore(parseInt(req.params.assignmentId), req.user!.userId, req.body);
    res.json(score);
  } catch (err) { next(err); }
}

export async function submitScore(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await scoresService.submitScore(parseInt(req.params.assignmentId), req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
}
