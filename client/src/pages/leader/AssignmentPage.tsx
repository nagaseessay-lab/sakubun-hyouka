import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRounds } from '../../api/rounds.api';
import { getRoundAssignments, autoAssign, previewAutoAssign, confirmAutoAssign, manualAssign, reassign, removeAssignment, reopenAssignment, generateMapping, confirmAutoAssignWithMapping } from '../../api/assignments.api';
import { getAvailabilitySummary } from '../../api/availability.api';
import { listUsers } from '../../api/export.api';
import type { EvaluationRound } from '../../types';

interface EvaluatorInfo {
  id: number;
  login_id: string;
  display_name: string;
  role: string;
  total_capacity: number;
  assigned_count: number;
  completed_count: number;
}

export default function AssignmentPage() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [phase, setPhase] = useState<string>('first');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [evaluators, setEvaluators] = useState<EvaluatorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deadline, setDeadline] = useState('');

  // Manual assignment state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEssayId, setManualEssayId] = useState('');
  const [manualUserId, setManualUserId] = useState<number>(0);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<{ success: number; failed: string[] } | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Auto-assign preview state
  const [previewData, setPreviewData] = useState<any>(null);
  const [adjustedCounts, setAdjustedCounts] = useState<Record<number, number>>({});

  // Mapping detail state
  const [mappingData, setMappingData] = useState<Array<{ essayId: number; receiptNumber: string; studentNumber: string; userId: number; displayName: string; loginId: string }> | null>(null);
  const [mappingFilter, setMappingFilter] = useState('');
  const [mappingLoading, setMappingLoading] = useState(false);

  // Expandable groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Reassignment state
  const [reassignId, setReassignId] = useState<number | null>(null);
  const [reassignUserId, setReassignUserId] = useState<number>(0);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (r.length > 0) setSelectedRound(r[0].id);
    });
    // Fetch both evaluators and leaders (leaders can also evaluate)
    Promise.all([listUsers('evaluator'), listUsers('leader')]).then(([evaluators, leaders]) => {
      setAllUsers([...evaluators, ...leaders]);
    });
  }, []);

  useEffect(() => {
    if (!selectedRound) return;
    loadAssignments();
    loadEvaluators();
  }, [selectedRound, phase]);

  async function loadAssignments() {
    setLoading(true);
    try {
      const data = await getRoundAssignments(selectedRound, phase);
      setAssignments(data);
    } catch (err: any) {
      setError(err?.message || err || '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function loadEvaluators() {
    try {
      const data = await getAvailabilitySummary(selectedRound);
      setEvaluators(data);
    } catch { /* ignore */ }
  }

  function showMsg(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleAutoAssign() {
    setError('');
    try {
      const result = await previewAutoAssign(selectedRound, phase);
      setPreviewData(result);
      const counts: Record<number, number> = {};
      result.evaluators.forEach((e: any) => { counts[e.userId] = e.proposedCount; });
      setAdjustedCounts(counts);
    } catch (err: any) {
      setError(err?.message || err || 'プレビューの取得に失敗しました');
    }
  }

  async function handleConfirmAssign() {
    if (!previewData) return;
    const assignments = Object.entries(adjustedCounts)
      .filter(([, count]) => count > 0)
      .map(([userId, count]) => ({ userId: Number(userId), count }));
    try {
      const result = await confirmAutoAssign(selectedRound, phase, assignments, deadline || undefined);
      setSuccess(`${result.assigned}件を振り分けました${result.unassigned > 0 ? ` (未割当: ${result.unassigned}件)` : ''}`);
      setPreviewData(null);
      loadAssignments();
      loadEvaluators();
    } catch (err: any) {
      setError(err?.message || err || '振り分けに失敗しました');
    }
  }

  async function handleGenerateMapping() {
    if (!previewData) return;
    const assignments = Object.entries(adjustedCounts)
      .filter(([, count]) => count > 0)
      .map(([userId, count]) => ({ userId: Number(userId), count }));
    setMappingLoading(true);
    try {
      const result = await generateMapping(selectedRound, phase, assignments);
      setMappingData(result.mapping);
      setMappingFilter('');
    } catch (err: any) {
      setError(err?.message || err || 'マッピング生成に失敗しました');
    } finally {
      setMappingLoading(false);
    }
  }

  function handleMappingEvaluatorChange(essayId: number, newUserId: number) {
    if (!mappingData) return;
    const user = allUsers.find(u => u.id === newUserId);
    if (!user) return;
    setMappingData(prev => prev!.map(m =>
      m.essayId === essayId ? { ...m, userId: newUserId, displayName: user.display_name, loginId: user.login_id } : m
    ));
  }

  async function handleConfirmMapping() {
    if (!mappingData) return;
    try {
      const mapping = mappingData.map(m => ({ essayId: m.essayId, userId: m.userId }));
      const result = await confirmAutoAssignWithMapping(selectedRound, mapping, deadline || undefined);
      setSuccess(`${result.assigned}件を振り分けました`);
      setMappingData(null);
      setPreviewData(null);
      loadAssignments();
      loadEvaluators();
    } catch (err: any) {
      setError(err?.message || err || '振り分けに失敗しました');
    }
  }

  async function handleManualAssign() {
    if (!manualEssayId || !manualUserId) return;
    setError('');
    setManualResult(null);
    const ids = manualEssayId.split(/[,\n\r\s]+/).map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    setManualLoading(true);
    let successCount = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await manualAssign({
          roundId: selectedRound,
          receiptNumber: id,
          userId: manualUserId,
          phase,
        });
        successCount++;
      } catch (err: any) {
        failed.push(`${id}: ${err?.message || err || 'エラー'}`);
      }
    }
    setManualLoading(false);
    setManualResult({ success: successCount, failed });
    if (successCount > 0) {
      showMsg(`${successCount}件を割り当てました${failed.length > 0 ? ` (失敗: ${failed.length}件)` : ''}`);
      loadAssignments();
      loadEvaluators();
    }
    if (failed.length === 0) {
      setShowManualModal(false);
      setManualEssayId('');
      setManualUserId(0);
      setManualResult(null);
    }
  }

  async function handleReassign() {
    if (!reassignId || !reassignUserId) return;
    // Check if the assignment is in_progress or completed -> force mode
    const target = assignments.find(a => a.id === reassignId);
    const needsForce = target && (target.status === 'in_progress' || target.status === 'completed');
    if (needsForce) {
      if (!confirm('途中のスコアが削除されます。続けますか？')) return;
    }
    try {
      await reassign(reassignId, reassignUserId, needsForce ? true : undefined);
      showMsg('担当者を変更しました');
      setReassignId(null);
      setReassignUserId(0);
      loadAssignments();
      loadEvaluators();
    } catch (err: any) {
      setError(err?.message || err || '変更に失敗しました');
    }
  }

  async function handleRemove(id: number) {
    if (!confirm('この割り当てを削除しますか？')) return;
    try {
      await removeAssignment(id);
      loadAssignments();
      loadEvaluators();
    } catch (err: any) {
      alert(err?.message || err || '削除に失敗しました');
    }
  }

  // Group by evaluator (use login_id as key to avoid name collisions)
  const byEvaluator = new Map<string, { name: string; loginId: string; items: any[] }>();
  assignments.forEach((a) => {
    const key = a.evaluator_login_id || a.evaluator_name || '不明';
    if (!byEvaluator.has(key)) byEvaluator.set(key, { name: a.evaluator_name || '不明', loginId: a.evaluator_login_id || '', items: [] });
    byEvaluator.get(key)!.items.push(a);
  });

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleAllGroups() {
    const allKeys = [...byEvaluator.keys()].filter(k => byEvaluator.get(k)!.items.length > 10);
    if (allKeys.every(k => expandedGroups.has(k))) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(allKeys));
    }
  }

  const activeEvaluators = allUsers.filter(u => u.is_active);
  const hasCollapsible = [...byEvaluator.values()].some(g => g.items.length > 10);
  const allExpanded = hasCollapsible && [...byEvaluator.keys()].filter(k => byEvaluator.get(k)!.items.length > 10).every(k => expandedGroups.has(k));

  return (
    <div>
      <div className="page-header">
        <h1>振り分け管理</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))} style={{ width: 200 }}>
            {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ width: 120 }}>
            <option value="first">1周目</option>
            <option value="second">2周目</option>
          </select>
          <button className="btn-primary" onClick={handleAutoAssign}>自動振り分け</button>
          <button className="btn-secondary" onClick={() => setShowManualModal(true)}>手動割り当て</button>
        </div>
      </div>

      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{success}</span>
        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
          onClick={() => navigate('/leader/essays')}>
          受付答案一覧で確認
        </button>
      </div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{assignments.length}</div>
          <div className="stat-label">割り当て済み</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{byEvaluator.size}</div>
          <div className="stat-label">担当者数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{assignments.filter((a) => a.status === 'completed').length}</div>
          <div className="stat-label">完了済み</div>
        </div>
      </div>

      {/* Evaluator capacity overview */}
      {evaluators.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8, fontSize: 14 }}>評価者キャパシティ</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {evaluators.map(ev => {
              const cap = parseInt(String(ev.total_capacity));
              const asg = parseInt(String(ev.assigned_count));
              const pct = cap > 0 ? Math.round((asg / cap) * 100) : 0;
              return (
                <div key={ev.id} style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{ev.display_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({ev.login_id})</span></div>
                  <div style={{ color: '#64748b' }}>{asg}/{cap} ({pct}%)</div>
                  <div style={{ background: '#e2e8f0', height: 4, borderRadius: 2, marginTop: 4 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? '#dc2626' : '#2563eb', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? <div className="loading">読み込み中...</div> : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>評価者別割り当て</h2>
            {hasCollapsible && (
              <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={toggleAllGroups}>
                {allExpanded ? 'すべて折りたたむ' : 'すべて展開'}
              </button>
            )}
          </div>
          {byEvaluator.size === 0 && (
            <p style={{ color: '#64748b', fontSize: 13 }}>まだ振り分けがありません</p>
          )}
          {[...byEvaluator.entries()].map(([key, group]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                {group.name} {group.loginId && <span style={{ color: '#94a3b8', fontWeight: 400 }}>({group.loginId})</span>}
                <span className="badge badge-blue" style={{ marginLeft: 8 }}>{group.items.length}件</span>
                <span className="badge badge-green" style={{ marginLeft: 4 }}>
                  完了: {group.items.filter((a: any) => a.status === 'completed').length}
                </span>
              </h3>
              <table>
                <thead>
                  <tr><th>受付番号</th><th>状態</th><th>提出期限</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {(expandedGroups.has(key) ? group.items : group.items.slice(0, 10)).map((a: any) => (
                    <tr key={a.id}>
                      <td>{a.receipt_number}</td>
                      <td><span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'in_progress' ? 'badge-blue' : 'badge-yellow'}`}>
                        {a.status === 'completed' ? '完了' : a.status === 'in_progress' ? '進行中' : '未着手'}
                      </span></td>
                      <td style={{ fontSize: 12 }}>{a.deadline ? new Date(a.deadline).toLocaleDateString('ja-JP') : '-'}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => { setReassignId(a.id); setReassignUserId(0); }}>
                          担当変更
                        </button>
                        {a.status !== 'completed' ? (
                          <button className="btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => handleRemove(a.id)}>削除</button>
                        ) : (
                          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={async () => {
                              if (!confirm('この作文を再評価可能にしますか？スコアがリセットされます。')) return;
                              try {
                                await reopenAssignment(a.id);
                                showMsg('再評価可能にしました');
                                loadAssignments();
                              } catch (err: any) {
                                setError(err?.message || err || '再評価設定に失敗しました');
                              }
                            }}>
                            再評価
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {group.items.length > 10 && (
                    <tr>
                      <td colSpan={4} style={{ color: '#2563eb', cursor: 'pointer', fontSize: 13 }} onClick={() => toggleGroup(key)}>
                        {expandedGroups.has(key) ? '▲ 折りたたむ' : `▼ 他 ${group.items.length - 10} 件を表示...`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Manual assignment modal */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => { if (!manualLoading) { setShowManualModal(false); setManualResult(null); } }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>手動割り当て</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              受付番号を指定して、特定の評価者に割り当てます。カンマ・改行区切りで複数指定できます。
            </p>
            <div className="form-group">
              <label>受付番号（複数可）</label>
              <textarea value={manualEssayId}
                onChange={(e) => setManualEssayId(e.target.value)}
                placeholder="例: R001-00001, R001-00002&#10;R001-00003"
                rows={4}
                style={{ width: '100%', resize: 'vertical' }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {manualEssayId.split(/[,\n\r\s]+/).filter(s => s.trim()).length}件の受付番号
              </span>
            </div>
            <div className="form-group">
              <label>評価者</label>
              <select value={manualUserId} onChange={(e) => setManualUserId(Number(e.target.value))}>
                <option value={0}>選択してください</option>
                {activeEvaluators.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.login_id})</option>
                ))}
              </select>
            </div>
            {manualResult && (
              <div style={{ marginBottom: 12 }}>
                {manualResult.success > 0 && (
                  <div style={{ background: '#dcfce7', color: '#16a34a', padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 4 }}>
                    {manualResult.success}件 成功
                  </div>
                )}
                {manualResult.failed.length > 0 && (
                  <div style={{ background: '#fef2f2', color: '#dc2626', padding: 8, borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>失敗 ({manualResult.failed.length}件):</div>
                    {manualResult.failed.map((msg, i) => <div key={i}>{msg}</div>)}
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowManualModal(false); setManualResult(null); }} disabled={manualLoading}>キャンセル</button>
              <button className="btn-primary" onClick={handleManualAssign}
                disabled={!manualEssayId.trim() || !manualUserId || manualLoading}>
                {manualLoading ? '処理中...' : '割り当て'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment modal */}
      {reassignId && (
        <div className="modal-overlay" onClick={() => setReassignId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>担当者変更</h2>
            <div className="form-group">
              <label>新しい評価者</label>
              <select value={reassignUserId} onChange={(e) => setReassignUserId(Number(e.target.value))}>
                <option value={0}>選択してください</option>
                {activeEvaluators.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.login_id})</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setReassignId(null)}>キャンセル</button>
              <button className="btn-primary" onClick={handleReassign}
                disabled={!reassignUserId}>変更</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-assign preview modal */}
      {previewData && (
        <div className="modal-overlay" onClick={() => setPreviewData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>自動振り分けプレビュー</h2>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ background: '#f0f9ff', padding: '8px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>作文総数</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{previewData.totalEssays}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '8px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>割当可能</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{previewData.assignableCount}</div>
              </div>
              {previewData.unassignedCount > 0 && (
                <div style={{ background: '#fef2f2', padding: '8px 16px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>未割当（容量不足）</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{previewData.unassignedCount}</div>
                </div>
              )}
            </div>

            {previewData.unassignedCount > 0 && (
              <div style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                容量不足のため、{previewData.unassignedCount}件が未割当のまま残ります。
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13 }}>提出期限</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: 200 }} />
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>※ 省略可。設定すると評価者に表示されます</span>
            </div>

            {/* Evaluator distribution table */}
            <table>
              <thead>
                <tr>
                  <th>評価者</th>
                  <th>残余容量</th>
                  <th>割当件数</th>
                  <th>割当後残り</th>
                </tr>
              </thead>
              <tbody>
                {previewData.evaluators.map((e: any) => {
                  const count = adjustedCounts[e.userId] || 0;
                  const afterRemaining = e.remainingCapacity - count;
                  const isOverCapacity = count > e.remainingCapacity;
                  return (
                    <tr key={e.userId} style={{ background: isOverCapacity ? '#fef2f2' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{e.displayName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{e.loginId}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{e.remainingCapacity}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          max={e.remainingCapacity}
                          value={count}
                          onChange={(ev) => setAdjustedCounts(prev => ({ ...prev, [e.userId]: Math.max(0, parseInt(ev.target.value) || 0) }))}
                          style={{ width: 70, textAlign: 'center', padding: 4, fontSize: 14, fontWeight: 600 }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: isOverCapacity ? '#dc2626' : afterRemaining === 0 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
                        {afterRemaining}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td>合計</td>
                  <td style={{ textAlign: 'center' }}>{previewData.evaluators.reduce((s: number, e: any) => s + e.remainingCapacity, 0)}</td>
                  <td style={{ textAlign: 'center', color: Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) > previewData.assignableCount ? '#dc2626' : undefined }}>
                    {Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) > previewData.assignableCount && (
              <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>
                割当合計が割当可能数を超えています。{previewData.assignableCount}件以下に調整してください。
              </div>
            )}

            {previewData.evaluators.some((e: any) => (adjustedCounts[e.userId] || 0) > e.remainingCapacity) && (
              <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                残余容量を超えている評価者がいます。
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setPreviewData(null)}>キャンセル</button>
              <button
                className="btn-secondary"
                onClick={handleGenerateMapping}
                disabled={
                  Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) > previewData.assignableCount ||
                  Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) === 0 ||
                  previewData.evaluators.some((e: any) => (adjustedCounts[e.userId] || 0) > e.remainingCapacity) ||
                  mappingLoading
                }
              >
                {mappingLoading ? '生成中...' : '詳細一覧を表示'}
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmAssign}
                disabled={
                  Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) > previewData.assignableCount ||
                  Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0) === 0 ||
                  previewData.evaluators.some((e: any) => (adjustedCounts[e.userId] || 0) > e.remainingCapacity)
                }
              >
                確定（{Object.values(adjustedCounts).reduce((s: number, c) => s + (c as number), 0)}件を振り分け）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping detail modal */}
      {mappingData && (
        <div className="modal-overlay" onClick={() => setMappingData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>振り分け詳細一覧（個別調整可）</h2>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
              <input
                type="text"
                value={mappingFilter}
                onChange={(e) => setMappingFilter(e.target.value)}
                placeholder="受付番号・評価者で絞り込み"
                style={{ width: 250, padding: '4px 8px', fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: '#64748b' }}>{mappingData.length}件</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>受付番号</th>
                    <th>生徒番号</th>
                    <th>評価者</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingData
                    .filter(m => {
                      if (!mappingFilter) return true;
                      const f = mappingFilter.toLowerCase();
                      return m.receiptNumber.toLowerCase().includes(f) ||
                        m.studentNumber.toLowerCase().includes(f) ||
                        m.displayName.toLowerCase().includes(f) ||
                        m.loginId.toLowerCase().includes(f);
                    })
                    .map((m, idx) => (
                      <tr key={m.essayId}>
                        <td style={{ color: '#94a3b8', fontSize: 11 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{m.receiptNumber}</td>
                        <td style={{ fontSize: 12 }}>{m.studentNumber || '-'}</td>
                        <td>
                          <select
                            value={m.userId}
                            onChange={(e) => handleMappingEvaluatorChange(m.essayId, Number(e.target.value))}
                            style={{ fontSize: 12, padding: '2px 4px', width: '100%' }}
                          >
                            {activeEvaluators.map(u => (
                              <option key={u.id} value={u.id}>{u.display_name} ({u.login_id})</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setMappingData(null)}>戻る</button>
              <button className="btn-primary" onClick={handleConfirmMapping}>
                この内容で確定（{mappingData.length}件）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
