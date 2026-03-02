import { gasPost } from './client';

export async function getMyAvailability() {
  return gasPost('availability.getMy');
}

export async function upsertAvailability(entries: Array<{ date: string; capacity: number }>) {
  return gasPost('availability.upsert', { entries });
}

export async function getRoundAvailability(roundId: number) {
  return gasPost('availability.summary', { roundId });
}

export async function getAvailabilitySummary(roundId: number) {
  return gasPost('availability.summary', { roundId });
}
