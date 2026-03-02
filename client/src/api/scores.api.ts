import { gasPost } from './client';

export async function getScore(assignmentId: number) {
  return gasPost('scores.get', { assignmentId });
}

export async function saveScore(assignmentId: number, body: any) {
  return gasPost('scores.save', { assignmentId, ...body });
}

export async function submitScore(assignmentId: number) {
  return gasPost('scores.submit', { assignmentId });
}
