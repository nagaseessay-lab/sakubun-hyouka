import { useState, useEffect } from 'react';
import { listRounds } from '../../api/rounds.api';
import { getDefectiveEssays, resolveDefectiveEssay, replaceEssayPdf, getEssayPdfBlob } from '../../api/essays.api';
import type { EvaluationRound } from '../../types';

export default function DefectiveEssaysPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [essays, setEssays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewingPdf, setViewingPdf] = useState<{ id: number; url: string; receipt: string } | null>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceAction, setReplaceAction] = useState<'reassign_original' | 'reset_unassigned'>('reset_unassigned');
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
    });
    loadEssays();
  }, []);

  useEffect(() => {
    loadEssays();
  }, [selectedRound]);

  async function loadEssays() {
    setLoading(true);
    try {
      const data = await getDefectiveEssays(selectedRound || undefined);
      setEssays(data);
    } catch {
      setEssays([]);
    } finally {
      setLoading(false);
    }
  }

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleResolve(essayId: number, action: 'reassign' | 'dismiss') {
    const label = action === 'reassign' ? '再割り当て可能にしますか？' : '不備を解除して未割当に戻しますか？';
    if (!confirm(label)) return;
    try {
      const result = await resolveDefectiveEssay(essayId, action);
      showMsg(result.message);
      loadEssays();
    } catch (err: any) {
      setError(err?.message || err || '処理に失敗しました');
    }
  }

  async function handleViewPdf(essay: any) {
    try {
      const url = await getEssayPdfBlob(essay.id);
      setViewingPdf({ id: essay.id, url, receipt: essay.receipt_number });
    } catch {
      setError('PDFの読み込みに失敗しました');
    }
  }

  function closePdfViewer() {
    if (viewingPdf) URL.revokeObjectURL(viewingPdf.url);
    setViewingPdf(null);
  }

  function openReplaceModal(essayId: number) {
    setReplacingId(essayId);
    setReplaceFile(null);
    setReplaceAction('reset_unassigned');
  }

  function closeReplaceModal() {
    setReplacingId(null);
    setReplaceFile(null);
    setReplaceAction('reset_unassigned');
  }

  async function handleReplacePdf() {
    if (!replacingId || !replaceFile) return;
    setReplacing(true);
    try {
      await replaceEssayPdf(replacingId, replaceFile, replaceAction);
      showMsg('PDFを差し替えました');
      closeReplaceModal();
      loadEssays();
    } catch (err: any) {
      setError(err?.message || err || 'PDF差替に失敗しました');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>不備答案管理</h1>
        <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))} style={{ width: 250 }}>
          <option value={0}>すべての評価回</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{essays.length}</div>
          <div className="stat-label">不備答案数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{essays.filter(e => e.status === 'leader_hold').length}</div>
          <div className="stat-label">リーダー保留</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : essays.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          不備答案はありません
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>受付番号</th>
                <th>評価回</th>
                <th>状態</th>
                <th>不備理由</th>
                <th>報告者</th>
                <th>所見</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {essays.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.receipt_number}</td>
                  <td style={{ fontSize: 12 }}>{e.round_name}</td>
                  <td>
                    <span className={`badge ${e.status === 'leader_hold' ? 'badge-yellow' : 'badge-blue'}`}>
                      {e.status === 'leader_hold' ? 'リーダー保留' : e.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#dc2626' }}>{e.defective_reason || '-'}</td>
                  <td style={{ fontSize: 13 }}>
                    {e.evaluator_name || '-'}
                    {e.evaluator_login_id && <span style={{ color: '#94a3b8' }}> ({e.evaluator_login_id})</span>}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.comment || e.summary || '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleViewPdf(e)}>PDF確認</button>
                      <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11, background: '#f59e0b', color: '#fff', border: 'none' }}
                        onClick={() => openReplaceModal(e.id)}>PDF差替</button>
                      <button className="btn-primary" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleResolve(e.id, 'reassign')}>再割当</button>
                      <button className="btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleResolve(e.id, 'dismiss')}>不備解除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="modal-overlay" onClick={closePdfViewer}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 900, width: '90vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{viewingPdf.receipt} - 不備答案PDF</h2>
              <button className="btn-secondary" onClick={closePdfViewer}>閉じる</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8 }}>
              <iframe src={`${viewingPdf.url}#toolbar=1`} style={{ width: '100%', height: '100%', border: 'none' }} title="不備答案PDF" />
            </div>
          </div>
        </div>
      )}

      {/* PDF Replacement Modal */}
      {replacingId !== null && (
        <div className="modal-overlay" onClick={closeReplaceModal}>
          <div className="modal-content" onClick={(ev) => ev.stopPropagation()}
            style={{ maxWidth: 500, width: '90vw' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>PDF差替</h2>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#64748b' }}>
              作文ID: {replacingId} の不備PDFを新しいPDFに差し替えます。
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
                差替PDFファイル
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(ev) => setReplaceFile(ev.target.files?.[0] || null)}
                style={{ fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, fontSize: 14 }}>
                差替後の処理
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="replaceAction"
                    value="reset_unassigned"
                    checked={replaceAction === 'reset_unassigned'}
                    onChange={() => setReplaceAction('reset_unassigned')}
                  />
                  未割当に戻す（自動割当対象にする）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="replaceAction"
                    value="reassign_original"
                    checked={replaceAction === 'reassign_original'}
                    onChange={() => setReplaceAction('reassign_original')}
                  />
                  元の評価者に再割当する
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={closeReplaceModal} disabled={replacing}>
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={handleReplacePdf}
                disabled={!replaceFile || replacing}
              >
                {replacing ? '処理中...' : '差替実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
