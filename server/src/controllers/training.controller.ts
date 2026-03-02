import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import * as trainingService from '../services/training.service';
import { env } from '../config/env';

export async function listTrainings(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.query.round_id ? parseInt(req.query.round_id as string) : undefined;
    const trainings = await trainingService.listTrainings(roundId);
    res.json(trainings);
  } catch (err) { next(err); }
}

export async function getTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const training = await trainingService.getTraining(parseInt(req.params.id));
    res.json(training);
  } catch (err) { next(err); }
}

export async function createTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const training = await trainingService.createTraining({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(training);
  } catch (err) { next(err); }
}

export async function deleteTraining(req: Request, res: Response, next: NextFunction) {
  try {
    await trainingService.deleteTraining(parseInt(req.params.id));
    res.json({ message: '研修を削除しました' });
  } catch (err) { next(err); }
}

export async function addTrainingItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await trainingService.addTrainingItem(parseInt(req.params.id), req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function addTrainingItemWithPdf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'PDFファイルが必要です' });
      return;
    }
    // Move file to training directory
    const trainingDir = path.join(env.UPLOAD_DIR, 'training');
    fs.mkdirSync(trainingDir, { recursive: true });
    const destPath = path.join(trainingDir, req.file.filename);
    fs.renameSync(req.file.path, destPath);

    const item = await trainingService.addTrainingItem(parseInt(req.params.id), {
      pdfPath: `training/${req.file.filename}`,
      displayOrder: parseInt(req.body.displayOrder) || 1,
      correctScore: req.body.correctScore ? parseInt(req.body.correctScore) : undefined,
      correctCriteriaScores: req.body.correctCriteriaScores ? JSON.parse(req.body.correctCriteriaScores) : undefined,
      tolerance: req.body.tolerance ? parseInt(req.body.tolerance) : 0,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function getTrainingItemPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await trainingService.getTrainingItemById(parseInt(req.params.itemId));
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: '研修問題が見つかりません' });
      return;
    }
    const item = rows[0];

    if (item.essay_id) {
      // Redirect to essay PDF endpoint
      res.redirect(`/api/v1/essays/${item.essay_id}/pdf`);
      return;
    }
    if (item.pdf_path) {
      const pdfFullPath = path.join(env.UPLOAD_DIR, item.pdf_path);
      if (fs.existsSync(pdfFullPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(pdfFullPath);
        return;
      }
    }
    res.status(404).json({ error: 'PDFが見つかりません' });
  } catch (err) { next(err); }
}

export async function updateTrainingItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await trainingService.updateTrainingItem(parseInt(req.params.itemId), req.body);
    res.json(item);
  } catch (err) { next(err); }
}

export async function deleteTrainingItem(req: Request, res: Response, next: NextFunction) {
  try {
    await trainingService.deleteTrainingItem(parseInt(req.params.itemId));
    res.json({ message: '研修問題を削除しました' });
  } catch (err) { next(err); }
}

// ---- Publish / Assignment endpoints ----

export async function togglePublish(req: Request, res: Response, next: NextFunction) {
  try {
    const training = await trainingService.togglePublish(
      parseInt(req.params.id),
      req.body.isPublished
    );
    res.json(training);
  } catch (err) { next(err); }
}

export async function assignTrainingUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await trainingService.assignTrainingToUsers(
      parseInt(req.params.id),
      req.body.userIds,
      req.user!.userId
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function getTrainingAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await trainingService.getTrainingAssignments(parseInt(req.params.id));
    res.json(assignments);
  } catch (err) { next(err); }
}

export async function removeTrainingAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    await trainingService.removeTrainingAssignment(
      parseInt(req.params.id),
      parseInt(req.params.userId)
    );
    res.json({ message: '割り当てを削除しました' });
  } catch (err) { next(err); }
}

export async function assignTrainingUsersByCsv(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSVファイルが必要です' });
    }
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l);
    const loginIds: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const id = cols[0].trim().replace(/"/g, '');
      // Skip header
      if (i === 0 && (id.toLowerCase() === 'login_id' || id === 'ログインID')) continue;
      if (id) loginIds.push(id);
    }
    const result = await trainingService.assignTrainingByLoginIds(
      parseInt(req.params.id),
      loginIds,
      req.user!.userId
    );
    try { fs.unlinkSync(req.file.path); } catch {}
    res.json(result);
  } catch (err) { next(err); }
}

export async function exportCompletions(req: Request, res: Response, next: NextFunction) {
  try {
    const trainingId = req.body.trainingId ? parseInt(req.body.trainingId) : undefined;
    const filename = await trainingService.generateCompletionExport(trainingId);
    res.json({ filename, downloadUrl: `/api/v1/exports/${filename}` });
  } catch (err) { next(err); }
}

// ---- Evaluator endpoints ----

export async function getMyTrainings(req: Request, res: Response, next: NextFunction) {
  try {
    const trainings = await trainingService.getMyTrainings(req.user!.userId);
    res.json(trainings);
  } catch (err) { next(err); }
}

export async function startAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const attempt = await trainingService.startAttempt(parseInt(req.params.id), req.user!.userId);
    res.json(attempt);
  } catch (err) { next(err); }
}

export async function submitResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await trainingService.submitResponse(
      parseInt(req.params.attemptId),
      req.body.itemId,
      req.body
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function completeAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await trainingService.completeAttempt(parseInt(req.params.attemptId));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getTrainingCompletions(req: Request, res: Response, next: NextFunction) {
  try {
    const trainingId = req.query.training_id ? parseInt(req.query.training_id as string) : undefined;
    const completions = await trainingService.getTrainingCompletions(trainingId);
    res.json(completions);
  } catch (err) { next(err); }
}
