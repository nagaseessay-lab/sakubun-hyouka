import React, { useState, useEffect } from 'react';
import { listRounds } from '../../api/rounds.api';
import { listEssays, getEssayPdfBlob, updateEssayStatus, exportEssaysCsv, bulkUpdateEssayStatus } from '../../api/essays.api';
import { manualAssign, bulkReassign } from '../../api/assignments.api';
import { listUsers } from '../../api/export.api';
import type { EvaluationRound } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  unassigned: '未割当',
  assigned_first: '1周目割当済',
  first_complete: '1周目完了',
  assigned_second: '2周目割当済',
  second_complete: '2周目完了',
  leader_hold: 'リーダー保留',
};

const STATUS_COLORS: Record<string, string> = {
  unassigned: 'badge-gray',
  assigned_first: 'badge-yellow',
  first_complete: 'badge-green',
  assigned_second: 'badge-blue',
  second_complete: 'badge-green',
  leader_hold: 'badge-yellow',
};

type SortColumn = 'receipt_number' | 'first_score' | 'second_avg';
type SortOrder = 'asc' | 'desc';

export default function EssayListPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [essays, setEssays] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState<SortColumn>('receipt_number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Score filter state
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [scorePhase, setScorePhase] = useState<'first' | 'second'>('first');

  // PDF modal state (popup style like DefectiveEssaysPage)
  const [viewingPdf, setViewingPdf] = useState<{ id: number; url: string; receipt: string } | null>(null);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{ essayId: number; receiptNumber: string } | null>(null);
  const [assignUserId, setAssignUserId] = useState<number>(0);
  const [assignPhase, setAssignPhase] = useState<string>('first');
  const [assignForce, setAssignForce] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Bulk move modal state
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkIdentifiers, setBulkIdentifiers] = useState('');
  const [bulkUserId, setBulkUserId] = useState<number>(0);
  const [bulkPhase, setBulkPhase] = useState<string>('first');
  const [bulkForce, setBulkForce] = useState(false);
  const [bulkDeadline, setBulkDeadline] = useState('');
  const [bulkResult, setBulkResult] = useState<{ total: number; succeeded: number; failed: Array<{ identifier: string; error: string }> } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Status change modal
  const [statusModal, setStatusModal] = useState<{ essayId: number; receiptNumber: string; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState('');

  // Bulk status change modal
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkStatusIdentifiers, setBulkStatusIdentifiers] = useState('');
  const [bulkNewStatus, setBulkNewStatus] = useState('');
  const [bulkStatusResult, setBulkStatusResult] = useState<{ success: string[]; failed: Array<{ id: string; error: string }> } | null>(null);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);

  // CSV export loading
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (r.length > 0) setSelectedRound(r[0].id);
    });
    Promise.all([listUsers('evaluator'), listUsers('leader')]).then(([evaluators, leaders]) => {
      setAllUsers([...evaluators, ...leaders]);
    });
  }, []);

  useEffect(() => {
    if (selectedRound) {
      setPage(1);
      loadEssays(1);
    }
  }, [selectedRound, statusFilter, search, sortBy, sortOrder, scoreMin, scoreMax, scorePhase, limit]);

  async function loadEssays(p: number) {
    setLoading(true);
    try {
      const result = await listEssays(selectedRound, {
        page: p, limit,
        status: statusFilter || undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        score_min: scoreMin !== '' ? Number(scoreMin) : undefined,
        score_max: scoreMax !== '' ? Number(scoreMax) : undefined,
        score_phase: (scoreMin !== '' || scoreMax !== '') ? scorePhase : undefined,
      });
      setEssays(result.data);
      setTotal(result.total);
      setPage(p);
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

  // PDF modal handlers (popup pattern)
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

  // Sort handler
  function handleSort(column: SortColumn) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'receipt_number' ? 'asc' : 'desc');
    }
  }

  function sortIndicator(column: SortColumn) {
    if (sortBy !== column) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>{'\u2195'}</span>;
    return <span style={{ marginLeft: 4 }}>{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>;
  }

  async function handleAssign() {
    if (!assignModal || !assignUserId) return;
    try {
      await manualAssign({
        roundId: selectedRound,
        essayId: assignModal.essayId,
        userId: assignUserId,
        phase: assignPhase,
        force: assignForce,
      });
      setAssignModal(null);
      showMsg(`${assignModal.receiptNumber} を割り当てました`);
      loadEssays(page);
    } catch (err: any) {
      setError(err?.message || err || '割り当てに失敗しました');
    }
  }

  async function handleStatusChange() {
    if (!statusModal || !newStatus) return;
    try {
      await updateEssayStatus(statusModal.essayId, newStatus);
      setStatusModal(null);
      showMsg(`${statusModal.receiptNumber} の状態を変更しました`);
      loadEssays(page);
    } catch (err: any) {
      setError(err?.message || err || '状態変更に失敗しました');
    }
  }

  async function handleBulkReassign() {
    if (!bulkUserId || !bulkIdentifiers.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const identifiers = bulkIdentifiers.split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
      const result = await bulkReassign(selectedRound, {
        identifiers,
        userId: bulkUserId,
        phase: bulkPhase,
        deadline: bulkDeadline || undefined,
        force: bulkForce,
      });
      setBulkResult(result);
      loadEssays(page);
      if (result.succeeded > 0) {
        showMsg(`${result.succeeded}件の一括移動が完了しました`);
      }
    } catch (err: any) {
      setError(err?.message || err || '一括移動に失敗しました');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleCsvExport() {
    setCsvLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (sortBy) params.sort_by = sortBy;
      if (sortOrder) params.sort_order = sortOrder;
      if (scoreMin !== '') params.score_min = scoreMin;
      if (scoreMax !== '') params.score_max = scoreMax;
      if (scoreMin !== '' || scoreMax !== '') params.score_phase = scorePhase;
      await exportEssaysCsv(selectedRound, params);
      showMsg('CSVファイルをダウンロードしました');
    } catch (err: any) {
      setError(err?.message || err || 'CSV出力に失敗しました');
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleBulkStatusChange() {
    if (!bulkStatusIdentifiers.trim() || !bulkNewStatus) return;
    setBulkStatusLoading(true);
    setBulkStatusResult(null);
    try {
      const identifiers = bulkStatusIdentifiers.split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
      const result = await bulkUpdateEssayStatus(selectedRound, identifiers, bulkNewStatus);
      setBulkStatusResult(result);
      if (result.success.length > 0) {
        showMsg(`${result.success.length}件の状態を変更しました`);
        loadEssays(page);
      }
    } catch (err: any) {
      setError(err?.message || err || '一括状態変更に失敗しました');
    } finally {
      setBulkStatusLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  const selectedRoundData = rounds.find(r => r.id === selectedRound);
  const secondEvalCount = selectedRoundData?.second_evaluator_count || 1;

  return (
    <div>
      <div className="page-header">
        <h1>受付答案一覧</h1>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>評価回</label>
            <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))} style={{ width: 200 }}>
              {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>状態フィルタ</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">すべて</option>
              <option value="unassigned">未割当</option>
              <option value="assigned_first">1周目割当済</option>
              <option value="first_complete">1周目完了</option>
              <option value="assigned_second">2周目割当済</option>
              <option value="second_complete">2周目完了</option>
              <option value="leader_hold">リーダー保留</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>検索</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="受付番号 / 生徒番号（カンマ区切りで複数可）"
              style={{ width: 300 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>表示件数</label>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 80 }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Score range filter row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginTop: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>スコア範囲</label>
            <select value={scorePhase} onChange={(e) => setScorePhase(e.target.value as 'first' | 'second')} style={{ width: 120 }}>
              <option value="first">1周目スコア</option>
              <option value="second">2周目合計</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>最小</label>
            <input
              type="number"
              value={scoreMin}
              onChange={(e) => setScoreMin(e.target.value)}
              placeholder="min"
              style={{ width: 80 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>最大</label>
            <input
              type="number"
              value={scoreMax}
              onChange={(e) => setScoreMax(e.target.value)}
              placeholder="max"
              style={{ width: 80 }}
            />
          </div>
          {(scoreMin !== '' || scoreMax !== '') && (
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12, marginBottom: 2 }}
              onClick={() => { setScoreMin(''); setScoreMax(''); }}>
              クリア
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingBottom: 6 }}>
            <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={handleCsvExport} disabled={csvLoading}>
              {csvLoading ? '出力中...' : 'CSV出力'}
            </button>
            <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={() => { setBulkStatusModal(true); setBulkStatusIdentifiers(''); setBulkNewStatus(''); setBulkStatusResult(null); }}>
              一括状態変更
            </button>
            <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={() => { setBulkModal(true); setBulkIdentifiers(''); setBulkUserId(0); setBulkPhase('first'); setBulkForce(false); setBulkDeadline(''); setBulkResult(null); }}>
              一括移動
            </button>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total}件中 {Math.min((page - 1) * limit + 1, total)}〜{Math.min(page * limit, total)}件
            </span>
          </div>
        </div>
      </div>

      {/* Essay table */}
      <div className="card">
        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : essays.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
            作文が見つかりません
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('receipt_number')}>
                      受付番号{sortIndicator('receipt_number')}
                    </th>
                    <th>生徒番号</th>
                    <th>状態</th>
                    <th>1周目担当</th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('first_score')}>
                      1周目スコア{sortIndicator('first_score')}
                    </th>
                    {Array.from({ length: secondEvalCount }, (_, i) => (
                      <React.Fragment key={`sh-${i}`}>
                        <th>2周目担当{secondEvalCount > 1 ? `${i + 1}` : ''}</th>
                        <th>2周目スコア{secondEvalCount > 1 ? `${i + 1}` : ''}</th>
                      </React.Fragment>
                    ))}
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('second_avg')}>
                      2周目平均{sortIndicator('second_avg')}
                    </th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {essays.map((e) => (
                    <tr key={e.id} style={e.is_defective ? { background: '#fef2f2' } : undefined}>
                      <td style={{ fontWeight: 500 }}>
                        {e.receipt_number}
                        {e.is_defective && <span style={{ color: '#dc2626', fontSize: 10, marginLeft: 4 }}>不備</span>}
                      </td>
                      <td>{e.student_number || '-'}</td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[e.status] || 'badge-gray'}`}>
                          {STATUS_LABELS[e.status] || e.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {e.first_evaluator_name ? (
                          <span>
                            {e.first_evaluator_name}
                            <span style={{ color: '#94a3b8', marginLeft: 2 }}>({e.first_evaluator_login_id})</span>
                            {e.first_assignment_status === 'completed' && (
                              <span className="badge badge-green" style={{ marginLeft: 4, fontSize: 10 }}>完了</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {e.first_score_value != null ? (
                          <span style={{ color: e.first_is_draft ? '#b45309' : '#16a34a' }}>
                            {e.first_score_value}{e.first_is_draft ? ' (下書き)' : ''}
                          </span>
                        ) : '-'}
                      </td>
                      {Array.from({ length: secondEvalCount }, (_, i) => {
                        const evaluators = e.second_evaluators || [];
                        const ev = evaluators[i];
                        return (
                          <React.Fragment key={`sd-${i}`}>
                            <td style={{ fontSize: 12 }}>
                              {ev ? (
                                <span>
                                  {ev.display_name}
                                  <span style={{ color: '#94a3b8', marginLeft: 2 }}>({ev.login_id})</span>
                                  {ev.status === 'completed' && (
                                    <span className="badge badge-green" style={{ marginLeft: 4, fontSize: 10 }}>完了</span>
                                  )}
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {ev && ev.total_score != null ? (
                                <span style={{ color: ev.is_draft ? '#b45309' : '#16a34a' }}>
                                  {ev.total_score}{ev.is_draft ? ' (下書き)' : ''}
                                </span>
                              ) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td>
                        {e.second_phase_avg != null ? String(e.second_phase_avg) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => handleViewPdf(e)}>
                            PDF
                          </button>
                          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => {
                              setAssignModal({ essayId: e.id, receiptNumber: e.receipt_number });
                              setAssignPhase(e.status === 'first_complete' || e.status === 'assigned_second' || e.status === 'second_complete' ? 'second' : 'first');
                              setAssignUserId(0);
                              setAssignForce(false);
                            }}>
                            振分
                          </button>
                          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => {
                              setStatusModal({ essayId: e.id, receiptNumber: e.receipt_number, currentStatus: e.status });
                              setNewStatus('');
                            }}>
                            状態
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  disabled={page <= 1} onClick={() => loadEssays(page - 1)}>前へ</button>
                <span style={{ padding: '4px 12px', fontSize: 13, color: '#64748b' }}>{page} / {totalPages}</span>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  disabled={page >= totalPages} onClick={() => loadEssays(page + 1)}>次へ</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* PDF Viewer Modal (popup overlay) */}
      {viewingPdf && (
        <div className="modal-overlay" onClick={closePdfViewer}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 900, width: '90vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{viewingPdf.receipt} - PDFプレビュー</h2>
              <button className="btn-secondary" onClick={closePdfViewer}>閉じる</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8 }}>
              <iframe src={`${viewingPdf.url}#toolbar=1`} style={{ width: '100%', height: '100%', border: 'none' }} title="PDFプレビュー" />
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 16 }}>手動振り分け: {assignModal.receiptNumber}</h2>
            <div className="form-group">
              <label>フェーズ</label>
              <select value={assignPhase} onChange={(e) => setAssignPhase(e.target.value)}>
                <option value="first">1周目</option>
                <option value="second">2周目</option>
              </select>
            </div>
            <div className="form-group">
              <label>評価者</label>
              <select value={assignUserId} onChange={(e) => setAssignUserId(Number(e.target.value))}>
                <option value={0}>-- 選択 --</option>
                {allUsers.filter((u: any) => u.is_active).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.login_id}) {u.role === 'leader' ? '[リーダー]' : ''}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 12 }}>
              <input type="checkbox" checked={assignForce} onChange={(e) => setAssignForce(e.target.checked)} />
              強制変更（既存スコアを削除して再割当）
            </label>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setAssignModal(null)}>キャンセル</button>
              <button className="btn-primary" onClick={handleAssign} disabled={!assignUserId}>割り当て</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal && (
        <div className="modal-overlay" onClick={() => setStatusModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 16 }}>状態変更: {statusModal.receiptNumber}</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              現在の状態: <span className={`badge ${STATUS_COLORS[statusModal.currentStatus] || 'badge-gray'}`}>
                {STATUS_LABELS[statusModal.currentStatus] || statusModal.currentStatus}
              </span>
            </p>
            <div className="form-group">
              <label>新しい状態</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="">-- 選択 --</option>
                {Object.entries(STATUS_LABELS)
                  .filter(([key]) => key !== statusModal.currentStatus)
                  .map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', padding: 8, borderRadius: 6, marginBottom: 12 }}>
              ⚠️ 強制的に状態を変更します。関連する割り当てやスコアには影響しません。
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setStatusModal(null)}>キャンセル</button>
              <button className="btn-primary" onClick={handleStatusChange} disabled={!newStatus}>変更</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Change Modal */}
      {bulkStatusModal && (
        <div className="modal-overlay" onClick={() => setBulkStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 16 }}>一括状態変更</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              受付番号または生徒番号をカンマ区切り・改行区切りで入力してください。
            </p>
            <div className="form-group">
              <label>受付番号 / 生徒番号</label>
              <textarea
                value={bulkStatusIdentifiers}
                onChange={(e) => setBulkStatusIdentifiers(e.target.value)}
                rows={4}
                placeholder={"例: R001-00001, R001-00002\nR001-00003"}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {bulkStatusIdentifiers.split(/[,\n\r\t]+/).filter(s => s.trim()).length}件
              </span>
            </div>
            <div className="form-group">
              <label>新しい状態</label>
              <select value={bulkNewStatus} onChange={(e) => setBulkNewStatus(e.target.value)}>
                <option value="">-- 選択 --</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', padding: 8, borderRadius: 6, marginBottom: 12 }}>
              ⚠️ 強制的に状態を変更します。関連する割り当てやスコアには影響しません。
            </div>

            {bulkStatusResult && (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 6, background: bulkStatusResult.failed.length > 0 ? '#fef3c7' : '#dcfce7', fontSize: 13 }}>
                <div>成功: <strong>{bulkStatusResult.success.length}件</strong> / 失敗: <strong>{bulkStatusResult.failed.length}件</strong></div>
                {bulkStatusResult.failed.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {bulkStatusResult.failed.map((f, i) => (
                      <div key={i} style={{ color: '#dc2626' }}>・{f.id}: {f.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setBulkStatusModal(false)}>閉じる</button>
              <button className="btn-primary" onClick={handleBulkStatusChange}
                disabled={!bulkStatusIdentifiers.trim() || !bulkNewStatus || bulkStatusLoading}>
                {bulkStatusLoading ? '処理中...' : '一括変更実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {bulkModal && (
        <div className="modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 16 }}>一括移動</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              受付番号または生徒番号をカンマ区切り・改行区切りで入力してください。
            </p>
            <div className="form-group">
              <label>受付番号 / 生徒番号</label>
              <textarea
                value={bulkIdentifiers}
                onChange={(e) => setBulkIdentifiers(e.target.value)}
                rows={4}
                placeholder={"例: R001, R002, R003\nまたは生徒番号: S1001, S1002"}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>フェーズ</label>
                <select value={bulkPhase} onChange={(e) => setBulkPhase(e.target.value)}>
                  <option value="first">1周目</option>
                  <option value="second">2周目</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>移動先の評価者</label>
                <select value={bulkUserId} onChange={(e) => setBulkUserId(Number(e.target.value))}>
                  <option value={0}>-- 選択 --</option>
                  {allUsers.filter((u: any) => u.is_active).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.display_name} ({u.login_id}) {u.role === 'leader' ? '[リーダー]' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>提出期限（任意）</label>
              <input type="date" value={bulkDeadline} onChange={(e) => setBulkDeadline(e.target.value)} style={{ width: 200 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 12 }}>
              <input type="checkbox" checked={bulkForce} onChange={(e) => setBulkForce(e.target.checked)} />
              強制変更（既存スコアを削除して再割当）
            </label>

            {bulkResult && (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 6, background: bulkResult.failed.length > 0 ? '#fef3c7' : '#dcfce7', fontSize: 13 }}>
                <div>成功: <strong>{bulkResult.succeeded}件</strong> / 失敗: <strong>{bulkResult.failed.length}件</strong></div>
                {bulkResult.failed.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {bulkResult.failed.map((f, i) => (
                      <div key={i} style={{ color: '#dc2626' }}>・{f.identifier}: {f.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setBulkModal(false)}>閉じる</button>
              <button className="btn-primary" onClick={handleBulkReassign}
                disabled={!bulkUserId || !bulkIdentifiers.trim() || bulkLoading}>
                {bulkLoading ? '処理中...' : '一括移動実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
