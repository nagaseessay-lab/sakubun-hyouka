import { Request, Response, NextFunction } from 'express';
import * as availabilityService from '../services/availability.service';

export async function getMyAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await availabilityService.getMyAvailability(req.user!.userId);
    res.json(data);
  } catch (err) { next(err); }
}

export async function upsertAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    if (!Array.isArray(req.body.entries) || req.body.entries.length === 0) {
      return res.status(400).json({ error: '登録するデータがありません' });
    }
    await availabilityService.upsertAvailability(req.user!.userId, req.body.entries);
    res.json({ message: '担当可能数を更新しました' });
  } catch (err) { next(err); }
}

export async function getRoundAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await availabilityService.getRoundAvailability(parseInt(req.params.roundId));
    res.json(data);
  } catch (err) { next(err); }
}

export async function getAvailabilitySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await availabilityService.getAvailabilitySummary(parseInt(req.params.roundId));
    res.json(data);
  } catch (err) { next(err); }
}
