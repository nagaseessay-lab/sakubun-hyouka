import { gasPost } from './client';

export async function listRounds() {
  return gasPost('rounds.list');
}

export async function getRound(id: number) {
  return gasPost('rounds.get', { roundId: id });
}

export async function createRound(body: any) {
  return gasPost('rounds.create', body);
}

export async function updateRound(id: number, body: any) {
  return gasPost('rounds.update', { roundId: id, ...body });
}

export async function deleteRound(id: number) {
  return gasPost('rounds.delete', { roundId: id });
}

export async function transitionStatus(id: number, status: string) {
  return gasPost('rounds.transition', { roundId: id, status });
}

export async function getProgress(id: number) {
  return gasPost('rounds.progress', { roundId: id });
}

export async function getRankings(id: number) {
  return gasPost('essays.getFirstPhaseRanked', { roundId: id });
}
