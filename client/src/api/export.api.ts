import { gasPost } from './client';

export async function generateExport(roundId: number) {
  const result = await gasPost<{ csv: string; filename: string }>('export.roundData', { roundId });
  // CSV文字列をダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', result.filename || `round_${roundId}_export.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return result;
}

export async function downloadExport(filename: string) {
  // GAS版ではgenerateExportが直接ダウンロードするため、この関数は互換用
  console.warn('downloadExport is deprecated in GAS version. Use generateExport instead.');
}

export async function getEvaluatorStats(params: { dateFrom?: string; dateTo?: string; roundId?: number }) {
  return gasPost('export.evaluatorStats', params);
}

export async function exportEvaluatorStats(body: { dateFrom?: string; dateTo?: string; roundId?: number }) {
  const result = await gasPost<{ csv: string; filename: string }>('export.evaluatorStats', { ...body, format: 'csv' });
  // CSV文字列をダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', result.filename || 'evaluator_stats.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return result;
}

export async function listUsers(role?: string) {
  return gasPost('users.list', role ? { role } : {});
}

export async function createUser(body: { loginId: string; displayName: string; email: string; role: string }) {
  return gasPost('users.create', body);
}

export async function bulkCreateUsers(users: Array<{ loginId: string; displayName: string; email: string; role: string }>) {
  return gasPost('users.bulkCreate', { users });
}

export async function updateUser(id: number, body: any) {
  return gasPost('users.update', { userId: id, ...body });
}

export async function resetUserPassword(id: number) {
  // GAS版ではGoogle Sign-Inのためパスワードリセットは不要
  console.warn('resetUserPassword is not applicable in Google Sign-In version');
  return { message: 'Google Sign-In版ではパスワードリセットは不要です' };
}

export async function deleteUser(id: number) {
  return gasPost('users.delete', { userId: id });
}

export async function changeMyPassword(_currentPassword: string, _newPassword: string) {
  // GAS版ではGoogle Sign-Inのためパスワード変更は不要
  throw new Error('Google Sign-In版ではパスワード変更は不要です');
}
