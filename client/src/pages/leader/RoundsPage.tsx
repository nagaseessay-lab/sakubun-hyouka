import { useState, useEffect } from 'react';
import { listRounds, createRound, updateRound, deleteRound, transitionStatus } from '../../api/rounds.api';
import type { EvaluationRound } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  uploading: 'アップロード中',
  first_phase: '1周目評価中',
  first_complete: '1周目完了',
  second_phase: '2周目評価中',
  second_complete: '2周目完了',
  archived: 'アーカイブ',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-gray',
  uploading: 'badge-blue',
  first_phase: 'badge-blue',
  first_complete: 'badge-green',
  second_phase: 'badge-blue',
  second_complete: 'badge-green',
  archived: 'badge-gray',
};

const PHASE_TYPE_LABELS: Record<string, string> = {
  both: '1周目 + 2周目',
  first_only: '1周目のみ',
  second_only: '2周目のみ',
};

// Forward transitions
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['uploading'],
  uploading: ['first_phase', 'second_phase'],
  first_phase: ['first_complete'],
  first_complete: ['second_phase', 'archived'],
  second_phase: ['second_complete'],
  second_complete: ['archived'],
};

// Reverse transitions (for irregular rollback)
const PREV_STATUS: Record<string, string> = {
  uploading: 'draft',
  first_phase: 'uploading',
  first_complete: 'first_phase',
  second_phase: 'first_complete',
  second_complete: 'second_phase',
  archived: 'second_complete',
};

export default function RoundsPage() {
  const [rounds, setRounds] = useState<(EvaluationRound & { essay_count?: number })[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRound, setEditingRound] = useState<EvaluationRound | null>(null);
  const [form, setForm] = useState({
    name: '', phaseType: 'both' as string, pagesPerEssay: 2,
    secondEvaluatorCount: 1, firstPhaseTopCount: 300, isDemo: false,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadRounds(); }, []);

  async function loadRounds() {
    setRounds(await listRounds());
  }

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleCreate() {
    try {
      await createRound(form);
      setShowCreateModal(false);
      resetForm();
      loadRounds();
      showMsg('評価回を作成しました');
    } catch (err: any) {
      setError(err?.message || err || '作成に失敗しました');
    }
  }

  async function handleUpdate() {
    if (!editingRound) return;
    try {
      await updateRound(editingRound.id, form);
      setEditingRound(null);
      resetForm();
      loadRounds();
      showMsg('評価回を更新しました');
    } catch (err: any) {
      setError(err?.message || err || '更新に失敗しました');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      await deleteRound(id);
      loadRounds();
      showMsg('評価回を削除しました');
    } catch (err: any) {
      setError(err?.message || err || '削除に失敗しました');
    }
  }

  async function handleTransition(id: number, status: string, isReverse: boolean = false) {
    const label = STATUS_LABELS[status] || status;
    const msg = isReverse
      ? `⚠️ 状態を「${label}」に戻しますか？（イレギュラー操作）`
      : `状態を「${label}」に進めますか？`;
    if (!confirm(msg)) return;
    try {
      await transitionStatus(id, status);
      loadRounds();
      showMsg(`状態を「${label}」に変更しました`);
    } catch (err: any) {
      setError(err?.message || err || '状態変更に失敗しました');
    }
  }

  function resetForm() {
    setForm({ name: '', phaseType: 'both', pagesPerEssay: 2, secondEvaluatorCount: 1, firstPhaseTopCount: 300, isDemo: false });
  }

  function openEditModal(r: EvaluationRound) {
    setEditingRound(r);
    setForm({
      name: r.name,
      phaseType: r.phase_type,
      pagesPerEssay: r.pages_per_essay,
      secondEvaluatorCount: r.second_evaluator_count,
      firstPhaseTopCount: r.first_phase_top_count,
      isDemo: r.is_demo || false,
    });
  }

  function closeEditModal() {
    setEditingRound(null);
    resetForm();
  }

  return (
    <div>
      <div className="page-header">
        <h1>評価回管理</h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>新規作成</button>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      {/* Rounds list as cards for better layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rounds.map((r) => {
          const essayCount = parseInt(String(r.essay_count || 0));
          const nextStatuses = NEXT_STATUS[r.status] || [];
          const prevStatus = PREV_STATUS[r.status];

          return (
            <div key={r.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{r.name}</h3>
                    <span className={`badge ${STATUS_COLORS[r.status] || 'badge-gray'}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                    {r.is_demo && <span className="badge badge-yellow" style={{ marginLeft: 4 }}>デモ</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b' }}>
                    <span>タイプ: {PHASE_TYPE_LABELS[r.phase_type] || r.phase_type}</span>
                    <span>綴り枚数: {r.pages_per_essay}枚</span>
                    <span>2周目評価人数: {r.second_evaluator_count}人</span>
                    <span>上位抽出: {r.first_phase_top_count}件</span>
                    <span>作文数: {essayCount}件</span>
                  </div>
                </div>

                {/* Action buttons area */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {/* Edit button (only for draft) */}
                  {r.status === 'draft' && (
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => openEditModal(r)}>
                      編集
                    </button>
                  )}

                  {/* Delete button (if 0 essays, or demo round) */}
                  {(essayCount === 0 || r.is_demo) && (
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDelete(r.id, r.name)}>
                      削除
                    </button>
                  )}
                </div>
              </div>

              {/* Status transition buttons */}
              {(nextStatuses.length > 0 || prevStatus) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>状態変更:</span>

                  {/* Forward transitions */}
                  {nextStatuses.map((status) => (
                    <button key={status} className="btn-primary"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => handleTransition(r.id, status)}>
                      → {STATUS_LABELS[status]}
                    </button>
                  ))}

                  {/* Reverse transition */}
                  {prevStatus && (
                    <button className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 12, color: '#b45309', borderColor: '#fbbf24' }}
                      onClick={() => handleTransition(r.id, prevStatus, true)}>
                      ← {STATUS_LABELS[prevStatus]}に戻す
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rounds.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            評価回がまだありません。「新規作成」ボタンから作成してください。
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新しい評価回を作成</h2>
            {renderForm()}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>キャンセル</button>
              <button className="btn-primary" onClick={handleCreate} disabled={!form.name}>作成</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingRound && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>評価回を編集</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              下書き状態の評価回のみ編集できます
            </p>
            {renderForm()}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeEditModal}>キャンセル</button>
              <button className="btn-primary" onClick={handleUpdate} disabled={!form.name}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderForm() {
    return (
      <>
        <div className="form-group">
          <label>評価回名</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例: 2026年6月高校生1次評価" />
        </div>
        <div className="form-group">
          <label>フェーズタイプ</label>
          <select value={form.phaseType} onChange={(e) => setForm({ ...form, phaseType: e.target.value })}>
            <option value="both">1周目 + 2周目</option>
            <option value="first_only">1周目のみ</option>
            <option value="second_only">2周目のみ</option>
          </select>
        </div>
        <div className="form-group">
          <label>PDF綴り枚数</label>
          <input type="number" min={1} max={20} value={form.pagesPerEssay}
            onChange={(e) => setForm({ ...form, pagesPerEssay: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="form-group">
          <label>2周目評価人数</label>
          <select value={form.secondEvaluatorCount}
            onChange={(e) => setForm({ ...form, secondEvaluatorCount: parseInt(e.target.value) })}>
            <option value={1}>1人</option>
            <option value={2}>2人</option>
          </select>
        </div>
        <div className="form-group">
          <label>上位抽出数（2周目用）</label>
          <input type="number" min={1} value={form.firstPhaseTopCount}
            onChange={(e) => setForm({ ...form, firstPhaseTopCount: parseInt(e.target.value) || 300 })} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isDemo}
              onChange={(e) => setForm({ ...form, isDemo: e.target.checked })} />
            デモ評価回
          </label>
          <span style={{ fontSize: 12, color: '#64748b' }}>デモ評価回はデータがあっても削除できます</span>
        </div>
      </>
    );
  }
}
