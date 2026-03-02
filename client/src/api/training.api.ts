import { gasPost } from './client';

// Leader APIs
export async function listTrainings(roundId?: number) {
  return gasPost('training.list', roundId ? { roundId } : {});
}

export async function getTraining(id: number) {
  return gasPost('training.get', { trainingId: id });
}

export async function createTraining(body: {
  roundId: number; phase: string; title: string; description?: string; passThresholdCount: number; rubricId?: number;
}) {
  return gasPost('training.create', body);
}

export async function deleteTraining(id: number) {
  return gasPost('training.delete', { trainingId: id });
}

export async function addTrainingItem(trainingId: number, body: {
  essayId?: number; displayOrder: number; correctScore?: number;
  correctCriteriaScores?: any; tolerance?: number;
}) {
  return gasPost('training.addItem', { trainingId, ...body });
}

export async function addTrainingItemWithPdf(trainingId: number, file: File, body: {
  displayOrder: number; correctScore?: number; tolerance?: number;
  correctCriteriaScores?: Array<{ criterion: string; score: number }>;
}) {
  // GAS版ではファイルをBase64に変換して送信
  const base64 = await fileToBase64(file);
  return gasPost('training.addItem', {
    trainingId,
    ...body,
    fileName: file.name,
    mimeType: file.type,
    base64Data: base64,
  });
}

export async function updateTrainingItem(itemId: number, body: any) {
  return gasPost('training.updateItem', { itemId, ...body });
}

export async function deleteTrainingItem(itemId: number) {
  return gasPost('training.deleteItem', { itemId });
}

export async function getTrainingCompletions(trainingId?: number) {
  return gasPost('training.getCompletions', trainingId ? { trainingId } : {});
}

// Publish / Assignment APIs
export async function toggleTrainingPublish(id: number, isPublished: boolean) {
  return gasPost('training.togglePublish', { trainingId: id, isPublished });
}

export async function assignTrainingUsers(id: number, userIds: number[]) {
  return gasPost('training.assignUsers', { trainingId: id, userIds });
}

export async function getTrainingAssignments(id: number) {
  return gasPost('training.getAssignments', { trainingId: id });
}

export async function removeTrainingAssignment(id: number, userId: number) {
  return gasPost('training.removeAssignment', { trainingId: id, userId });
}

export async function assignTrainingUsersByCsv(id: number, file: File) {
  // GAS版ではCSVをテキストとして読み込んで送信
  const text = await file.text();
  return gasPost('training.assignUsers', { trainingId: id, csvData: text });
}

export async function exportTrainingCompletions(trainingId?: number) {
  const result = await gasPost<{ csv: string; filename: string }>('training.exportCompletions', trainingId ? { trainingId } : {});
  // CSV文字列をダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || 'training_completions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Evaluator APIs
export async function getMyTrainings() {
  return gasPost('training.myList');
}

export async function startAttempt(trainingId: number) {
  return gasPost('training.startAttempt', { trainingId });
}

export async function submitTrainingResponse(attemptId: number, body: {
  itemId: number; givenScore?: number; givenCriteriaScores?: any;
}) {
  return gasPost('training.submitResponse', { attemptId, ...body });
}

export async function completeTrainingAttempt(attemptId: number) {
  return gasPost('training.completeAttempt', { attemptId });
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
