import { useState, useEffect } from 'react';
import { listRubrics, createRubric, cloneRubric, updateRubric, deleteRubric, assignRubricToRound, getRoundRubric } from '../../api/rubrics.api';
import { listRounds } from '../../api/rounds.api';
import type { Rubric, SecondPhaseCriterion, EvaluationRound } from '../../types';

export default function RubricPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ roundId: 0, rubricId: 0, phase: 'second' });
  const [roundRubricMap, setRoundRubricMap] = useState<Record<string, string>>({});

  const emptyCriteria: SecondPhaseCriterion[] = [
    { name: '人生設計・夢志', description: '', score_min: 0, score_max: 3, weight: 1 },
    { name: '社会への影響', description: '', score_min: 0, score_max: 3, weight: 1 },
    { name: '行動・機会', description: '', score_min: 0, score_max: 3, weight: 1 },
    { name: '事実・データ', description: '', score_min: 0, score_max: 3, weight: 1 },
    { name: '未来の計画', description: '', score_min: 0, score_max: 3, weight: 1 },
  ];

  const [form, setForm] = useState({
    name: '',
    phase: 'second' as string,
    isTemplate: true,
    criteria: emptyCriteria,
  });

  useEffect(() => {
    loadRubrics();
    listRounds().then(setRounds);
  }, []);

  async function loadRubrics() {
    setRubrics(await listRubrics());
  }

  // Load round-rubric assignments for display
  useEffect(() => {
    if (rounds.length === 0) return;
    const map: Record<string, string> = {};
    Promise.all(
      rounds.map(async (r) => {
        try {
          const rubric = await getRoundRubric(r.id, 'second');
          if (rubric) map[`${r.id}_second`] = rubric.name;
        } catch {}
        try {
          const rubric = await getRoundRubric(r.id, 'first');
          if (rubric) map[`${r.id}_first`] = rubric.name;
        } catch {}
      })
    ).then(() => setRoundRubricMap(map));
  }, [rounds, rubrics]);

  function openCreateModal() {
    setEditingRubric(null);
    setForm({ name: '', phase: 'second', isTemplate: true, criteria: emptyCriteria });
    setShowModal(true);
  }

  function openEditModal(rubric: Rubric) {
    setEditingRubric(rubric);
    const criteria = Array.isArray(rubric.criteria) ? rubric.criteria.map((c: any) => ({
      name: c.name || '',
      description: c.description || '',
      score_min: c.score_min ?? 0,
      score_max: c.score_max ?? 3,
      weight: c.weight ?? 1,
    })) : emptyCriteria;
    setForm({
      name: rubric.name,
      phase: rubric.phase,
      isTemplate: rubric.is_template,
      criteria,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (editingRubric) {
      await updateRubric(editingRubric.id, { name: form.name, criteria: form.criteria });
    } else {
      await createRubric(form);
    }
    setShowModal(false);
    loadRubrics();
  }

  async function handleClone(id: number) {
    await cloneRubric(id);
    loadRubrics();
  }

  async function handleDelete(id: number) {
    if (!confirm('このルーブリックを削除しますか？')) return;
    try {
      await deleteRubric(id);
      loadRubrics();
    } catch (err: any) {
      alert(err?.message || err || '削除に失敗しました');
    }
  }

  async function handleAssign() {
    if (!assignForm.roundId || !assignForm.rubricId) return;
    await assignRubricToRound(assignForm.roundId, assignForm.rubricId, assignForm.phase);
    setShowAssignModal(false);
    const map = { ...roundRubricMap };
    const rubric = rubrics.find((r) => r.id === assignForm.rubricId);
    if (rubric) map[`${assignForm.roundId}_${assignForm.phase}`] = rubric.name;
    setRoundRubricMap(map);
  }

  function addCriterion() {
    setForm({
      ...form,
      criteria: [...form.criteria, { name: '', description: '', score_min: 0, score_max: 3, weight: 1 }],
    });
  }

  function removeCriterion(idx: number) {
    setForm({ ...form, criteria: form.criteria.filter((_, i) => i !== idx) });
  }

  function updateCriterion(idx: number, field: string, value: any) {
    const updated = [...form.criteria];
    (updated[idx] as any)[field] = value;
    setForm({ ...form, criteria: updated });
  }

  // Filter rubrics by assign modal phase
  const filteredRubrics = rubrics.filter((r) => r.phase === assignForm.phase);

  return (
    <div>
      <div className="page-header">
        <h1>ルーブリック管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => {
            setAssignForm({ roundId: rounds[0]?.id || 0, rubricId: 0, phase: 'second' });
            setShowAssignModal(true);
          }}>
            評価回に割り当て
          </button>
          <button className="btn-primary" onClick={openCreateModal}>新規作成</button>
        </div>
      </div>

      {/* Round-Rubric Assignments */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>評価回別ルーブリック割り当て</h2>
        {rounds.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>評価回がありません</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>評価回</th>
                  <th>状態</th>
                  <th>1周目ルーブリック</th>
                  <th>2周目ルーブリック</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>{r.status}</span>
                    </td>
                    <td>
                      {roundRubricMap[`${r.id}_first`] ? (
                        <span className="badge badge-blue">{roundRubricMap[`${r.id}_first`]}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>未割り当て</span>
                      )}
                    </td>
                    <td>
                      {roundRubricMap[`${r.id}_second`] ? (
                        <span className="badge badge-green">{roundRubricMap[`${r.id}_second`]}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>未割り当て</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            setAssignForm({ roundId: r.id, rubricId: 0, phase: 'first' });
                            setShowAssignModal(true);
                          }}
                        >
                          1周目{roundRubricMap[`${r.id}_first`] ? '変更' : '設定'}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            setAssignForm({ roundId: r.id, rubricId: 0, phase: 'second' });
                            setShowAssignModal(true);
                          }}
                        >
                          2周目{roundRubricMap[`${r.id}_second`] ? '変更' : '設定'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rubric List */}
      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>ルーブリック一覧</h2>
        <table>
          <thead>
            <tr><th>名前</th><th>フェーズ</th><th>観点数</th><th>テンプレート</th><th>操作</th></tr>
          </thead>
          <tbody>
            {rubrics.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td>{r.phase === 'first' ? '1周目' : '2周目'}</td>
                <td>{Array.isArray(r.criteria) ? r.criteria.length : '-'}観点</td>
                <td>{r.is_template ? <span className="badge badge-green">テンプレート</span> : '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => openEditModal(r)}>編集</button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleClone(r.id)}>コピー</button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDelete(r.id)}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>{editingRubric ? 'ルーブリック編集' : 'ルーブリック作成'}</h2>
            <div className="form-group">
              <label>名前</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editingRubric && (
              <div className="form-group">
                <label>フェーズ</label>
                <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                  <option value="first">1周目</option>
                  <option value="second">2周目</option>
                </select>
              </div>
            )}

            <div>
              <label style={{ fontWeight: 500, fontSize: 13 }}>観点一覧</label>
              {form.criteria.map((c, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      value={c.name}
                      onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                      placeholder="観点名"
                      style={{ flex: 1 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ fontSize: 11, color: '#64748b', marginBottom: 0 }}>最大点:</label>
                      <input
                        type="number" min={0} max={10}
                        value={c.score_max}
                        onChange={(e) => updateCriterion(i, 'score_max', parseInt(e.target.value))}
                        style={{ width: 60 }}
                      />
                    </div>
                    <button className="btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => removeCriterion(i)}>×</button>
                  </div>
                  <textarea
                    value={c.description || ''}
                    onChange={(e) => updateCriterion(i, 'description', e.target.value)}
                    placeholder="補足説明（評価者に表示されます）"
                    rows={2}
                    style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                  />
                </div>
              ))}
              <button className="btn-secondary" onClick={addCriterion} style={{ fontSize: 12 }}>
                + 観点を追加
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn-primary" onClick={handleSave} disabled={!form.name}>
                {editingRubric ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>ルーブリック割り当て</h2>
            <div className="form-group">
              <label>評価回</label>
              <select
                value={assignForm.roundId}
                onChange={(e) => setAssignForm({ ...assignForm, roundId: Number(e.target.value) })}
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>フェーズ</label>
              <select
                value={assignForm.phase}
                onChange={(e) => setAssignForm({ ...assignForm, phase: e.target.value, rubricId: 0 })}
              >
                <option value="first">1周目</option>
                <option value="second">2周目</option>
              </select>
            </div>
            <div className="form-group">
              <label>ルーブリック（{assignForm.phase === 'first' ? '1周目' : '2周目'}用）</label>
              <select
                value={assignForm.rubricId}
                onChange={(e) => setAssignForm({ ...assignForm, rubricId: Number(e.target.value) })}
              >
                <option value={0}>選択してください</option>
                {filteredRubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Array.isArray(r.criteria) ? r.criteria.length : 0}観点)
                  </option>
                ))}
              </select>
              {filteredRubrics.length === 0 && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                  {assignForm.phase === 'first' ? '1周目' : '2周目'}用ルーブリックがありません。先に作成してください。
                </div>
              )}
            </div>
            {assignForm.roundId > 0 && roundRubricMap[`${assignForm.roundId}_${assignForm.phase}`] && (
              <div style={{ background: '#fef3c7', padding: 10, borderRadius: 6, fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                現在の割り当て: <strong>{roundRubricMap[`${assignForm.roundId}_${assignForm.phase}`]}</strong>
                （上書きされます）
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAssignModal(false)}>キャンセル</button>
              <button className="btn-primary" onClick={handleAssign}
                disabled={!assignForm.roundId || !assignForm.rubricId}>割り当て</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
