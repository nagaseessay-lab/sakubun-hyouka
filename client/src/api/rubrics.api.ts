import { gasPost } from './client';

export async function listRubrics(params?: { phase?: string; template?: boolean }) {
  return gasPost('rubrics.list', params || {});
}

export async function getRubric(id: number) {
  return gasPost('rubrics.get', { rubricId: id });
}

export async function createRubric(body: any) {
  return gasPost('rubrics.create', body);
}

export async function updateRubric(id: number, body: any) {
  return gasPost('rubrics.update', { rubricId: id, ...body });
}

export async function cloneRubric(id: number) {
  return gasPost('rubrics.clone', { rubricId: id });
}

export async function deleteRubric(id: number) {
  return gasPost('rubrics.delete', { rubricId: id });
}

export async function assignRubricToRound(roundId: number, rubricId: number, phase: string) {
  return gasPost('rubrics.assignToRound', { roundId, rubricId, phase });
}

export async function getRoundRubric(roundId: number, phase: string) {
  return gasPost('rubrics.getForRound', { roundId, phase });
}
