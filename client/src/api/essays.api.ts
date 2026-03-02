import { gasPost } from './client';

export async function listEssays(roundId: number, params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  score_min?: number;
  score_max?: number;
  score_phase?: string;
}) {
  return gasPost('essays.list', { roundId, ...params });
}

export async function getEssay(id: number) {
  return gasPost('essays.get', { essayId: id });
}

export function getEssayPdfUrl(_id: number) {
  // GAS版ではGoogle Drive URLを返す（essays.getPdfUrlで取得）
  // この関数は同期的にURLを返す旧互換用。実際にはgetEssayPdfBlobを使う
  return '';
}

export async function getEssayPdfBlob(id: number): Promise<string> {
  // GAS版ではGoogle Drive プレビューURLを返す
  const result = await gasPost<{ previewUrl: string; viewUrl: string; downloadUrl: string }>('essays.getPdfUrl', { essayId: id });
  return result.previewUrl || result.viewUrl || '';
}

export async function updateEssayStatus(id: number, status: string) {
  return gasPost('essays.updateStatus', { essayId: id, status });
}

export async function promoteToSecondPhase(roundId: number, topCount: number) {
  return gasPost('essays.confirmPromotion', { roundId, topCount });
}

export async function getDefectiveEssays(roundId?: number) {
  return gasPost('essays.getDefective', roundId ? { roundId } : {});
}

export async function resolveDefectiveEssay(essayId: number, action: 'reassign' | 'dismiss') {
  return gasPost('essays.resolveDefective', { essayId, action });
}

export async function exportEssaysCsv(roundId: number, params?: Record<string, string>) {
  const result = await gasPost<{ csv: string; filename: string }>('essays.exportCsv', { roundId, ...params });
  // GAS版はCSV文字列を返すので、フロント側でダウンロード処理
  const bom = '\uFEFF';
  const blob = new Blob([bom + result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || `essays_round${roundId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function bulkUpdateEssayStatus(roundId: number, identifiers: string[], status: string) {
  return gasPost('essays.bulkUpdateStatus', { roundId, identifiers, status });
}

export async function replaceEssayPdf(essayId: number, file: File, action: string) {
  // GAS版ではファイルをBase64に変換して専用アクションで送信
  const base64 = await fileToBase64(file);
  return gasPost('essays.replacePdf', {
    essayId,
    action,
    fileName: file.name,
    mimeType: file.type,
    base64Data: base64,
  });
}

// ファイルをBase64文字列に変換するヘルパー
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:application/pdf;base64,XXXX の形式からbase64部分を抽出
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
