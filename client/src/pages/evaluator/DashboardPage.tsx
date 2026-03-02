import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMyAssignments } from '../../api/assignments.api';
import { getScore } from '../../api/scores.api';
import { listRounds } from '../../api/rounds.api';
import { getEssayPdfBlob } from '../../api/essays.api';
import type { Assignment, EvaluationRound } from '../../types';

export default function EvaluatorDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);
  const [viewingScore, setViewingScore] = useState<any>(null);
  const [viewPdfUrl, setViewPdfUrl] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/leader') ? '/leader' : '/evaluator';

  useEffect(() => {
    listRounds().then(setRounds).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (selectedRound) params.round_id = selectedRound;
    getMyAssignments(params)
      .then((data) => {
        setAssignments(data);
      })
      .catch((err) => {
        console.error('[DashboardPage] Failed to load assignments:', err);
        setAssignments([]);
      })
      .finally(() => setLoading(false));
  }, [selectedRound]);

  const pending = assignments.filter((a) => a.status !== 'completed');
  const completed = assignments.filter((a) => a.status === 'completed');

  async function handleViewCompleted(a: Assignment) {
    try {
      const s = await getScore(a.id);
      setViewingAssignment(a);
      setViewingScore(s);
      // Load PDF via Google Drive preview URL
      const pdfUrl = await getEssayPdfBlob(a.essay_id);
      setViewPdfUrl(pdfUrl);
    } catch {
      setViewingAssignment(a);
      setViewingScore(null);
    }
  }

  function closeViewer() {
    if (viewPdfUrl) URL.revokeObjectURL(viewPdfUrl);
    setViewPdfUrl('');
    setViewingAssignment(null);
    setViewingScore(null);
  }

  return (
    <div>
      <div className="page-header">
        <h1>マイ担当一覧</h1>
        <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))}
          style={{ width: 250 }}>
          <option value={0}>すべての評価回</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{pending.length}</div>
          <div className="stat-label">未完了</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completed.length}</div>
          <div className="stat-label">完了済み</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{assignments.length}</div>
          <div className="stat-label">合計</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 12, fontSize: 16 }}>未完了の作文</h2>
            {pending.length === 0 ? (
              <p style={{ color: '#64748b' }}>割り当てられた作文はありません</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>受付番号</th>
                    <th>評価回</th>
                    <th>フェーズ</th>
                    <th>状態</th>
                    <th>提出期限</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((a) => (
                    <tr key={a.id}>
                      <td>{a.receipt_number}</td>
                      <td>{a.round_name}</td>
                      <td><span className={`badge ${a.phase === 'first' ? 'badge-blue' : 'badge-green'}`}>
                        {a.phase === 'first' ? '1周目' : '2周目'}
                      </span></td>
                      <td><span className={`badge ${a.status === 'pending' ? 'badge-yellow' : 'badge-blue'}`}>
                        {a.status === 'pending' ? '未着手' : '進行中'}
                      </span></td>
                      <td>
                        {a.deadline ? (
                          <span style={{
                            color: new Date(a.deadline) < new Date() ? '#dc2626' : '#64748b',
                            fontWeight: new Date(a.deadline) < new Date() ? 600 : 400,
                            fontSize: 12,
                          }}>
                            {new Date(a.deadline).toLocaleDateString('ja-JP')}
                            {new Date(a.deadline) < new Date() && ' (期限超過)'}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 13 }}
                          onClick={() => navigate(`${basePath}/evaluate/${a.id}`)}>
                          評価する
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Completed evaluations section */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>完了済みの作文</h2>
              <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }}
                onClick={() => setShowCompleted(!showCompleted)}>
                {showCompleted ? '閉じる' : `表示 (${completed.length}件)`}
              </button>
            </div>
            {showCompleted && (
              completed.length === 0 ? (
                <p style={{ color: '#64748b' }}>完了した評価はありません</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>受付番号</th>
                      <th>評価回</th>
                      <th>フェーズ</th>
                      <th>スコア</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((a) => (
                      <tr key={a.id}>
                        <td>{a.receipt_number}</td>
                        <td>{a.round_name}</td>
                        <td><span className={`badge ${a.phase === 'first' ? 'badge-blue' : 'badge-green'}`}>
                          {a.phase === 'first' ? '1周目' : '2周目'}
                        </span></td>
                        <td>
                          {a.phase === 'first' ? (a.first_score ?? '-') : (a.second_total ?? '-')}
                        </td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }}
                            onClick={() => handleViewCompleted(a)}>
                            閲覧
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </>
      )}

      {/* Completed assignment viewer modal */}
      {viewingAssignment && (
        <div className="modal-overlay" onClick={closeViewer}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 1200, width: '95vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>
                {viewingAssignment.receipt_number} - 評価閲覧
                <span className={`badge ${viewingAssignment.phase === 'first' ? 'badge-blue' : 'badge-green'}`}
                  style={{ marginLeft: 8 }}>
                  {viewingAssignment.phase === 'first' ? '1周目' : '2周目'}
                </span>
              </h2>
              <button className="btn-secondary" onClick={closeViewer}>✕ 閉じる</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16, flex: 1, overflow: 'hidden' }}>
              {/* PDF */}
              <div style={{ background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                {viewPdfUrl ? (
                  <iframe src={`${viewPdfUrl}#toolbar=1`} style={{ width: '100%', height: '100%', border: 'none' }} title="作文PDF" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>PDF読み込み中...</div>
                )}
              </div>
              {/* Score details */}
              <div style={{ overflowY: 'auto', padding: '0 4px' }}>
                {viewingScore ? (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: '#64748b' }}>生徒番号</div>
                      <div style={{ fontWeight: 600 }}>{viewingScore.student_number || '-'}</div>
                    </div>
                    {viewingScore.phase === 'first' ? (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, color: '#64748b' }}>スコア</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{viewingScore.score ?? '-'}</div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>観点別スコア</div>
                        {viewingScore.criteria_scores?.map((cs: any) => (
                          <div key={cs.criterion} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 13 }}>{cs.criterion}</span>
                            <span style={{ fontWeight: 600 }}>{cs.score}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 700, color: '#2563eb' }}>
                          <span>合計</span>
                          <span>{viewingScore.total_score ?? '-'}</span>
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: '#64748b' }}>作文概要</div>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{viewingScore.summary || '-'}</div>
                    </div>
                    {viewingScore.comment && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, color: '#64748b' }}>コメント</div>
                        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{viewingScore.comment}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#64748b' }}>スコアデータが見つかりません</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
