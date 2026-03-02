import { Request, Response, NextFunction } from 'express';
import * as assignmentService from '../services/assignment.service';

export async function getMyAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await assignmentService.getMyAssignments(req.user!.userId, req.query);
    res.json(assignments);
  } catch (err) { next(err); }
}

export async function getRoundAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await assignmentService.getRoundAssignments(
      parseInt(req.params.roundId),
      req.query.phase as string | undefined
    );
    res.json(assignments);
  } catch (err) { next(err); }
}

export async function autoAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const phase = req.body.phase || 'first';
    const result = phase === 'first'
      ? await assignmentService.autoAssignFirstPhase(roundId)
      : await assignmentService.autoAssignSecondPhase(roundId, req.body.deadline);
    res.json(result);
  } catch (err) { next(err); }
}

export async function previewAutoAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const phase = req.body.phase || 'first';
    const result = await assignmentService.previewAutoAssign(roundId, phase);
    res.json(result);
  } catch (err) { next(err); }
}

export async function confirmAutoAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const phase = req.body.phase || 'first';
    const assignments = req.body.assignments as Array<{ userId: number; count: number }>;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: '割り当てデータが必要です' });
    }
    const result = await assignmentService.confirmAutoAssign(roundId, phase, assignments, req.body.deadline);
    res.json(result);
  } catch (err) { next(err); }
}

export async function manualAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await assignmentService.manualAssign({
      ...req.body,
      assignedBy: req.user!.userId,
    });
    res.status(201).json(assignment);
  } catch (err) { next(err); }
}

export async function reassign(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await assignmentService.reassign(
      parseInt(req.params.id),
      req.body.userId,
      req.body.force || false
    );
    res.json(assignment);
  } catch (err) { next(err); }
}

export async function removeAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    await assignmentService.removeAssignment(parseInt(req.params.id));
    res.json({ message: '割り当てを削除しました' });
  } catch (err) { next(err); }
}

export async function reopenAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await assignmentService.reopenAssignment(parseInt(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

export async function generateMapping(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const phase = req.body.phase || 'first';
    const assignments = req.body.assignments as Array<{ userId: number; count: number }>;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: '割り当てデータが必要です' });
    }
    const result = await assignmentService.generateMapping(roundId, phase, assignments);
    res.json(result);
  } catch (err) { next(err); }
}

export async function confirmAutoAssignWithMapping(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const mapping = req.body.mapping as Array<{ essayId: number; userId: number }>;
    if (!Array.isArray(mapping) || mapping.length === 0) {
      return res.status(400).json({ error: 'マッピングデータが必要です' });
    }
    const result = await assignmentService.confirmAutoAssignWithMapping(roundId, mapping, req.body.deadline);
    res.json(result);
  } catch (err) { next(err); }
}

export async function bulkReassign(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const result = await assignmentService.bulkReassign({
      ...req.body,
      roundId,
      assignedBy: req.user!.userId,
    });
    res.json(result);
  } catch (err) { next(err); }
}
