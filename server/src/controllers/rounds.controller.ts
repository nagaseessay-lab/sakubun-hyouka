import { Request, Response, NextFunction } from 'express';
import * as roundsService from '../services/rounds.service';

export async function listRounds(req: Request, res: Response, next: NextFunction) {
  try {
    const rounds = await roundsService.listRounds(req.user!.role);
    res.json(rounds);
  } catch (err) { next(err); }
}

export async function getRound(req: Request, res: Response, next: NextFunction) {
  try {
    const round = await roundsService.getRound(parseInt(req.params.id));
    res.json(round);
  } catch (err) { next(err); }
}

export async function createRound(req: Request, res: Response, next: NextFunction) {
  try {
    const round = await roundsService.createRound({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(round);
  } catch (err) { next(err); }
}

export async function updateRound(req: Request, res: Response, next: NextFunction) {
  try {
    const round = await roundsService.updateRound(parseInt(req.params.id), req.body);
    res.json(round);
  } catch (err) { next(err); }
}

export async function deleteRound(req: Request, res: Response, next: NextFunction) {
  try {
    await roundsService.deleteRound(parseInt(req.params.id));
    res.json({ message: '評価回を削除しました' });
  } catch (err) { next(err); }
}

export async function transitionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const round = await roundsService.transitionStatus(parseInt(req.params.id), req.body.status);
    res.json(round);
  } catch (err) { next(err); }
}

export async function getProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const progress = await roundsService.getProgress(parseInt(req.params.id));
    res.json(progress);
  } catch (err) { next(err); }
}

export async function getRankings(req: Request, res: Response, next: NextFunction) {
  try {
    const rankings = await roundsService.getRankings(parseInt(req.params.id));
    res.json(rankings);
  } catch (err) { next(err); }
}
