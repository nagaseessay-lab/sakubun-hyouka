import { gasPost } from './client';

export async function getMyAssignments(params?: { round_id?: number; phase?: string; status?: string }) {
  return gasPost('assignments.listMy', params || {});
}

export async function getRoundAssignments(roundId: number, phase?: string) {
  return gasPost('assignments.listForRound', { roundId, phase });
}

export async function autoAssign(roundId: number, phase: string) {
  return gasPost('assignments.confirm', { roundId, phase });
}

export async function previewAutoAssign(roundId: number, phase: string) {
  return gasPost('assignments.preview', { roundId, phase });
}

export async function confirmAutoAssign(roundId: number, phase: string, assignments: Array<{ userId: number; count: number }>, deadline?: string) {
  return gasPost('assignments.confirm', { roundId, phase, assignments, deadline });
}

export async function manualAssign(body: { roundId: number; essayId?: number; receiptNumber?: string; userId: number; phase: string; deadline?: string; force?: boolean }) {
  return gasPost('assignments.manual', body);
}

export async function reassign(id: number, userId: number, force?: boolean) {
  return gasPost('assignments.reassign', { assignmentId: id, userId, force });
}

export async function reopenAssignment(id: number) {
  return gasPost('assignments.reopen', { assignmentId: id });
}

export async function removeAssignment(id: number) {
  return gasPost('assignments.remove', { assignmentId: id });
}

export async function generateMapping(roundId: number, phase: string, assignments: Array<{ userId: number; count: number }>) {
  return gasPost('assignments.generateMapping', { roundId, phase, assignments });
}

export async function confirmAutoAssignWithMapping(roundId: number, mapping: Array<{ essayId: number; userId: number }>, deadline?: string) {
  return gasPost('assignments.confirmMapping', { roundId, mapping, deadline });
}

export async function bulkReassign(roundId: number, body: { identifiers: string[]; userId: number; phase: string; deadline?: string; force?: boolean }) {
  return gasPost('assignments.bulkReassign', { roundId, ...body });
}
