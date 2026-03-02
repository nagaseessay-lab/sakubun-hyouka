import { useState, useEffect, useRef, useCallback } from 'react';
import { listRounds } from '../../api/rounds.api';
import { uploadPdfs, listUploads, deleteUpload } from '../../api/upload.api';
import type { EvaluationRound } from '../../types';

interface UploadedPdf {
  id: number;
  original_filename: string;
  total_pages: number;
  essay_count: number;
  current_essay_count: number;
  assignment_count: number;
  uploaded_by_name: string;
  created_at: string;
}

export default function UploadPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploads, setUploads] = useState<UploadedPdf[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRounds().then((r) => {
      const uploadable = r.filter((rd: EvaluationRound) =>
        ['uploading', 'first_phase', 'first_complete', 'second_phase'].includes(rd.status)
      );
      setRounds(r);
      if (uploadable.length > 0) setSelectedRound(uploadable[0].id);
      else if (r.length > 0) setSelectedRound(r[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedRound) loadUploads();
  }, [selectedRound]);

  async function loadUploads() {
    try {
      setUploads(await listUploads(selectedRound));
    } catch { /* ignore */ }
  }

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  const doUpload = useCallback(async (files: File[]) => {
    if (files.length === 0 || !selectedRound) return;

    setUploading(true);
    setError('');
    setResults(null);
    setProgress(0);

    try {
      const data = await uploadPdfs(selectedRound, files, setProgress);
      setResults(data);
      loadUploads();
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err?.message || err || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }, [selectedRound]);

  async function handleUpload() {
    const files = Array.from(fileRef.current?.files || []);
    doUpload(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!canUpload || uploading) return;
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.type === 'application/x-pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length > 0) {
      doUpload(files);
    } else {
      setError('PDFファイルをドロップしてください');
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (canUpload && !uploading) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleDeleteUpload(upload: UploadedPdf) {
    if (!confirm(`「${upload.original_filename}」を取り消しますか？\n関連する${upload.current_essay_count}件の作文も削除されます。`)) return;
    try {
      await deleteUpload(upload.id);
      loadUploads();
      showMsg(`${upload.original_filename} を取り消しました`);
    } catch (err: any) {
      setError(err?.message || err || '取り消しに失敗しました');
    }
  }

  const selectedRoundData = rounds.find(r => r.id === selectedRound);
  const canUpload = selectedRoundData && ['uploading', 'first_phase', 'first_complete', 'second_phase'].includes(selectedRoundData.status);

  return (
    <div>
      <div className="page-header">
        <h1>PDFアップロード</h1>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label>評価回を選択</label>
          <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))}>
            <option value={0}>選択してください</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.pages_per_essay}枚綴り) [{r.status}]
              </option>
            ))}
          </select>
        </div>

        {canUpload && (
          <>
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
                borderRadius: 12,
                padding: '32px 20px',
                textAlign: 'center',
                background: dragOver ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.2s',
                marginBottom: 16,
                cursor: 'pointer',
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{dragOver ? '📥' : '📄'}</div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                {dragOver ? 'ここにドロップ' : 'PDFファイルをドラッグ＆ドロップ'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                またはクリックしてファイルを選択（複数選択可 — 最大10ファイル）
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                同じファイル名は同一評価回に重複アップロードできません
              </p>
              <input type="file" accept=".pdf" ref={fileRef} multiple
                style={{ display: 'none' }}
                onChange={() => handleUpload()} />
            </div>

            {uploading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: '#e2e8f0', borderRadius: 8, height: 24, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progress}%`, height: '100%', background: '#2563eb',
                    transition: 'width 0.3s', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 600,
                  }}>
                    {progress}%
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  アップロード＆分割処理中...
                </p>
              </div>
            )}

            {results && (
              <div style={{ marginBottom: 16 }}>
                {results.results?.length > 0 && (
                  <div style={{ background: '#dcfce7', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                    <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>
                      {results.results.length}ファイル アップロード完了
                    </p>
                    {results.results.map((r: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                        {r.originalFilename}: {r.essayCount}件（{r.receipts?.[0]} 〜 {r.receipts?.[r.receipts.length - 1]}）
                      </div>
                    ))}
                  </div>
                )}
                {results.errors?.length > 0 && (
                  <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8, color: '#dc2626' }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>エラー:</p>
                    {results.errors.map((e: string, i: number) => (
                      <div key={i} style={{ fontSize: 13 }}>{e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {selectedRoundData && !canUpload && (
          <div style={{ color: '#64748b', fontSize: 13, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
            この評価回の状態（{selectedRoundData.status}）ではPDFのアップロードはできません。
            「アップロード中」「1周目評価中」「1周目完了」「2周目評価中」状態で追加できます。
          </div>
        )}
      </div>

      {/* Uploaded PDFs list */}
      {selectedRound > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>アップロード済みPDF一覧</h3>
          {uploads.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>まだPDFがアップロードされていません</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ファイル名</th>
                  <th>ページ数</th>
                  <th>作文数</th>
                  <th>アップロード者</th>
                  <th>日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((up) => {
                  const canDelete = parseInt(String(up.assignment_count)) === 0;
                  return (
                    <tr key={up.id}>
                      <td style={{ fontWeight: 500 }}>{up.original_filename}</td>
                      <td>{up.total_pages}P</td>
                      <td>{up.current_essay_count}件</td>
                      <td>{up.uploaded_by_name}</td>
                      <td style={{ fontSize: 12 }}>{new Date(up.created_at).toLocaleString('ja-JP')}</td>
                      <td>
                        {canDelete ? (
                          <button className="btn-danger"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => handleDeleteUpload(up)}>
                            取り消し
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>振り分け済み</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
