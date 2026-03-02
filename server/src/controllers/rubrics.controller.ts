import { Request, Response, NextFunction } from 'express';
import * as rubricsService from '../services/rubrics.service';

export async function listRubrics(req: Request, res: Response, next: NextFunction) {
  try {
    const phase = req.query.phase as string | undefined;
    const template = req.query.template === 'true' ? true : req.query.template === 'false' ? false : undefined;
    const rubrics = await rubricsService.listRubrics(phase, template);
    res.json(rubrics);
  } catch (err) { next(err); }
}

export async function getRubric(req: Request, res: Response, next: NextFunction) {
  try {
    const rubric = await rubricsService.getRubric(parseInt(req.params.id));
    res.json(rubric);
  } catch (err) { next(err); }
}

export async function createRubric(req: Request, res: Response, next: NextFunction) {
  try {
    const rubric = await rubricsService.createRubric({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(rubric);
  } catch (err) { next(err); }
}

export async function updateRubric(req: Request, res: Response, next: NextFunction) {
  try {
    const rubric = await rubricsService.updateRubric(parseInt(req.params.id), req.body);
    res.json(rubric);
  } catch (err) { next(err); }
}

export async function cloneRubric(req: Request, res: Response, next: NextFunction) {
  try {
    const rubric = await rubricsService.cloneRubric(parseInt(req.params.id), req.user!.userId);
    res.json(rubric);
  } catch (err) { next(err); }
}

export async function deleteRubric(req: Request, res: Response, next: NextFunction) {
  try {
    await rubricsService.deleteRubric(parseInt(req.params.id));
    res.json({ message: 'ルーブリックを削除しました' });
  } catch (err) { next(err); }
}

export async function assignToRound(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await rubricsService.assignRubricToRound(req.body.roundId, req.body.rubricId, req.body.phase);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getRoundRubric(req: Request, res: Response, next: NextFunction) {
  try {
    const rubric = await rubricsService.getRoundRubric(parseInt(req.params.roundId), req.params.phase);
    res.json(rubric);
  } catch (err) { next(err); }
}
