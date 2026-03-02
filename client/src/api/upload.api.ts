import { gasPost } from './client';

export async function uploadPdfs(roundId: number, files: File[], onProgress?: (pct: number) => void) {
  // GAS版ではファイルをBase64に変換して順次送信
  const results: any[] = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const base64 = await fileToBase64(file);
    const result = await gasPost('essays.upload', {
      roundId,
      fileName: file.name,
      mimeType: file.type,
      base64Data: base64,
    });
    results.push(result);
    if (onProgress) {
      onProgress(Math.round(((i + 1) * 100) / total));
    }
  }

  return { uploaded: results.length, results };
}

// Legacy single-file upload (kept for compatibility)
export async function uploadPdf(roundId: number, file: File, onProgress?: (pct: number) => void) {
  return uploadPdfs(roundId, [file], onProgress);
}

export async function listUploads(roundId: number) {
  // GAS版ではエッセイ一覧をアップロード一覧として返す
  const result = await gasPost<any>('essays.list', { roundId, limit: 200 });
  // essays.list は { data: [...], total, page, limit, totalPages } を返す
  return result.data || result;
}

export async function deleteUpload(uploadId: number) {
  // エッセイのステータスを pending に戻す（削除ではなく未割当に戻す）
  return gasPost('essays.updateStatus', { essayId: uploadId, status: 'pending' });
}

// ファイルをBase64文字列に変換するヘルパー
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
