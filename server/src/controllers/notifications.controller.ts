import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await notificationService.getNotifications(req.user!.userId, unreadOnly);
    const unreadCount = await notificationService.getUnreadCount(req.user!.userId);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAsRead(parseInt(req.params.id), req.user!.userId);
    res.json({ message: '既読にしました' });
  } catch (err) { next(err); }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    res.json({ message: '全て既読にしました' });
  } catch (err) { next(err); }
}
