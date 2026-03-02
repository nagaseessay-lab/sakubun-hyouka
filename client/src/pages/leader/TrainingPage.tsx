import { useState, useEffect, useRef } from 'react';
import { listRounds } from '../../api/rounds.api';
import { listEssays } from '../../api/essays.api';
import { listRubrics } from '../../api/rubrics.api';
import { listUsers } from '../../api/export.api';
import {
  listTrainings, createTraining, deleteTraining,
  getTraining, addTrainingItem, addTrainingItemWithPdf, updateTrainingItem, deleteTrainingItem,
  getTrainingCompletions, toggleTrainingPublish,
  assignTrainingUsers, getTrainingAssignments, removeTrainingAssignment,
  assignTrainingUsersByCsv, exportTrainingCompletions,
} from '../../api/training.api';
import type { EvaluationRound } from '../../types';

export default function TrainingPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'list' | 'completions'>('list');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ roundId: 0, phase: 'first', title: '', description: '', passThresholdCount: 3, rubricId: 0 });
  const [rubrics, setRubrics] = useState<any[]>([]);

  // Detail/edit state
  const [detail, setDetail] = useState<any>(null);
  const [essays, setEssays] = useState<any[]>([]);
  const [addMode, setAddMode] = useState<'essay' | 'pdf'>('pdf');
  const [addEssayId, setAddEssayId] = useState<number>(0);
  const [addCorrectScore, setAddCorrectScore] = useState<number>(0);
  const [addTolerance, setAddTolerance] = useState<number>(0);
  const [addCriteriaScores, setAddCriteriaScores] = useState<Array<{ criterion: string; score: number }>>([]);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // Assignment state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (r.length > 0) setForm((f) => ({ ...f, roundId: r[0].id }));
    });
    loadTrainings();
    // Load users for assignment
    listUsers().then((users: any[]) => {
      setAllUsers(users.filter((u: any) => (u.role === 'evaluator' || u.role === 'leader') && u.is_active));
    }).catch(() => setAllUsers([]));
  }, []);

  async function loadTrainings() {
    setTrainings(await listTrainings());
  }

  async function loadCompletions() {
    setCompletions(await getTrainingCompletions());
  }

  async function loadRubrics() {
    try {
      const r = await listRubrics();
      setRubrics(r);
    } catch { setRubrics([]); }
  }

  function showMsg(msg: string) { setMessage(msg); setTimeout(() => setMessage(''), 3000); }

  async function handleCreate() {
    try {
      await createTraining({
        ...form,
        rubricId: form.rubricId || undefined,
      });
      setShowCreate(false);
      loadTrainings();
      showMsg('デモ評価研修を作成しました');
    } catch (err: any) {
      setError(err?.message || err || '作成に失敗しました');
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    try {
      await deleteTraining(id);
      loadTrainings();
      if (detail?.id === id) { setDetail(null); setAssignments([]); }
      showMsg('削除しました');
    } catch (err: any) {
      setError(err?.message || err || '削除に失敗しました');
    }
  }

  async function handleTogglePublish(id: number, currentState: boolean) {
    try {
      await toggleTrainingPublish(id, !currentState);
      loadTrainings();
      if (detail?.id === id) {
        setDetail((d: any) => d ? { ...d, is_published: !currentState } : d);
      }
      showMsg(!currentState ? '公開しました' : '非公開にしました');
    } catch (err: any) {
      setError(err?.message || err || '公開状態の変更に失敗しました');
    }
  }

  async function openDetail(id: number) {
    const t = await getTraining(id);
    setDetail(t);
    // Initialize criteria scores from rubric
    if (t.rubric?.criteria && Array.isArray(t.rubric.criteria)) {
      setAddCriteriaScores(t.rubric.criteria.map((c: any) => ({
        criterion: c.name,
        score: c.score_min ?? 0,
      })));
    } else {
      setAddCriteriaScores([]);
    }
    // Load essays for the round
    if (t.round_id) {
      try {
        const result = await listEssays(t.round_id, { limit: 200 });
        setEssays(result.data || []);
      } catch { setEssays([]); }
    }
    // Load assignments
    loadAssignments(id);
  }

  async function loadAssignments(trainingId: number) {
    try {
      const a = await getTrainingAssignments(trainingId);
      setAssignments(a);
    } catch { setAssignments([]); }
  }

  async function handleAssignUsers() {
    if (!detail || selectedUserIds.length === 0) return;
    try {
      await assignTrainingUsers(detail.id, selectedUserIds);
      setSelectedUserIds([]);
      loadAssignments(detail.id);
      loadTrainings();
      showMsg('ユーザーを割り当てました');
    } catch (err: any) {
      setError(err?.message || err || '割り当てに失敗しました');
    }
  }

  async function handleRemoveAssignment(userId: number) {
    if (!detail) return;
    try {
      await removeTrainingAssignment(detail.id, userId);
      loadAssignments(detail.id);
      loadTrainings();
      showMsg('割り当てを解除しました');
    } catch (err: any) {
      setError(err?.message || err || '割り当て解除に失敗しました');
    }
  }

  async function handleCsvUpload() {
    const file = csvFileRef.current?.files?.[0];
    if (!file || !detail) return;
    try {
      const result = await assignTrainingUsersByCsv(detail.id, file);
      showMsg(`${result.assigned}名を割り当てました`);
      if (result.errors?.length > 0) {
        setError(result.errors.join(', '));
      }
      loadAssignments(detail.id);
      loadTrainings();
      if (csvFileRef.current) csvFileRef.current.value = '';
    } catch (err: any) {
      setError(err?.message || err || 'CSV割り当てに失敗しました');
    }
  }

  async function handleAddItem() {
    if (!detail) return;
    const hasRubric = detail.rubric?.criteria && Array.isArray(detail.rubric.criteria);
    try {
      if (addMode === 'pdf') {
        const file = pdfFileRef.current?.files?.[0];
        if (!file) { setError('PDFファイルを選択してください'); return; }
        await addTrainingItemWithPdf(detail.id, file, {
          displayOrder: (detail.items?.length || 0) + 1,
          correctScore: hasRubric ? undefined : addCorrectScore,
          tolerance: hasRubric ? undefined : addTolerance,
          correctCriteriaScores: hasRubric ? addCriteriaScores : undefined,
        });
        if (pdfFileRef.current) pdfFileRef.current.value = '';
      } else {
        if (!addEssayId) { setError('作文を選択してください'); return; }
        await addTrainingItem(detail.id, {
          essayId: addEssayId,
          displayOrder: (detail.items?.length || 0) + 1,
          correctScore: hasRubric ? undefined : addCorrectScore,
          tolerance: hasRubric ? undefined : addTolerance,
          correctCriteriaScores: hasRubric ? addCriteriaScores : undefined,
        });
        setAddEssayId(0);
      }
      openDetail(detail.id);
      setAddCorrectScore(0);
      showMsg('問題を追加しました');
    } catch (err: any) {
      setError(err?.message || err || '追加に失敗しました');
    }
  }

  async function handleUpdateItem(itemId: number, correctScore: number, tolerance: number) {
    try {
      await updateTrainingItem(itemId, { correctScore, tolerance });
      openDetail(detail.id);
      showMsg('更新しました');
    } catch (err: any) {
      setError(err?.message || err || '更新に失敗しました');
    }
  }

  async function handleUpdateItemCriteria(itemId: number, criteriaScores: Array<{ criterion: string; score: number }>) {
    try {
      await updateTrainingItem(itemId, { correctCriteriaScores: criteriaScores });
      openDetail(detail.id);
      showMsg('更新しました');
    } catch (err: any) {
      setError(err?.message || err || '更新に失敗しました');
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!confirm('この問題を削除しますか？')) return;
    try {
      await deleteTrainingItem(itemId);
      openDetail(detail.id);
      showMsg('問題を削除しました');
    } catch (err: any) {
      setError(err?.message || err || '削除に失敗しました');
    }
  }

  async function handleExportCompletions() {
    setExporting(true);
    try {
      await exportTrainingCompletions();
      showMsg('CSVファイルをダウンロードしました');
    } catch (err: any) {
      setError(err?.message || err || 'Excel出力に失敗しました');
    } finally {
      setExporting(false);
    }
  }

  // Get users not yet assigned for the multi-select
  const assignedUserIds = new Set(assignments.map((a: any) => a.user_id));
  const unassignedUsers = allUsers.filter((u: any) => !assignedUserIds.has(u.id));

  return (
    <div>
      <div className="page-header">
        <h1>デモ評価研修</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={tab === 'list' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('list')}>研修一覧</button>
          <button className={tab === 'completions' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setTab('completions'); loadCompletions(); }}>修了者一覧</button>
          <button className="btn-primary" onClick={() => { setShowCreate(true); loadRubrics(); }}>新規作成</button>
        </div>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      {tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Training list */}
          <div>
            {trainings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                デモ評価研修がまだありません
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trainings.map((t) => (
                  <div key={t.id} className="card" style={{ padding: 16, cursor: 'pointer', border: detail?.id === t.id ? '2px solid #3b82f6' : undefined }}
                    onClick={() => openDetail(t.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 15 }}>{t.title}</h3>
                          <span className={`badge ${t.is_published ? 'badge-green' : 'badge-yellow'}`}
                            style={{ fontSize: 10, padding: '2px 6px' }}>
                            {t.is_published ? '公開' : '非公開'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {t.round_name} | {t.phase === 'first' ? '1周目' : '2周目'} | 問題数: {t.item_count} | 合格者: {t.passed_count}名 | 合格正答数: {t.pass_threshold_count}問
                          {Number(t.assigned_user_count) > 0 && ` | 個別割当: ${t.assigned_user_count}名`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className={t.is_published ? 'btn-secondary' : 'btn-primary'}
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); handleTogglePublish(t.id, t.is_published); }}>
                          {t.is_published ? '非公開' : '公開'}
                        </button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}>
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {detail && (
            <div className="card" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>{detail.title}</h2>
              {detail.description && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{detail.description}</p>}
              {detail.rubric && (
                <div style={{ fontSize: 12, color: '#6366f1', marginBottom: 12 }}>
                  ルーブリック: {detail.rubric.name}
                </div>
              )}

              <h3 style={{ fontSize: 14, marginBottom: 8 }}>問題一覧</h3>
              {detail.items?.length > 0 ? (
                detail.rubric?.criteria && Array.isArray(detail.rubric.criteria) ? (
                  /* Rubric-based table */
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>作文</th>
                        {detail.rubric.criteria.map((c: any, ci: number) => (
                          <th key={ci} style={{ fontSize: 11 }}>{c.name}<br/><span style={{ color: '#94a3b8', fontWeight: 400 }}>({c.score_min}〜{c.score_max})</span></th>
                        ))}
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item: any, idx: number) => {
                        const cScores: Array<{ criterion: string; score: number }> = item.correct_criteria_scores || [];
                        return (
                          <tr key={item.id}>
                            <td>{idx + 1}</td>
                            <td>{item.essay_id ? `作文#${item.essay_id}` : item.pdf_path ? 'PDF' : '-'}</td>
                            {detail.rubric.criteria.map((c: any, ci: number) => {
                              const cs = cScores.find((s: any) => s.criterion === c.name);
                              return (
                                <td key={ci}>
                                  <select
                                    value={cs?.score ?? c.score_min}
                                    onChange={(e) => {
                                      const newVal = parseInt(e.target.value);
                                      const updated = { ...detail };
                                      const currentScores = [...(updated.items[idx].correct_criteria_scores || [])];
                                      const existing = currentScores.findIndex((s: any) => s.criterion === c.name);
                                      if (existing >= 0) {
                                        currentScores[existing] = { criterion: c.name, score: newVal };
                                      } else {
                                        currentScores.push({ criterion: c.name, score: newVal });
                                      }
                                      updated.items[idx].correct_criteria_scores = currentScores;
                                      setDetail(updated);
                                    }}
                                    onBlur={() => {
                                      const currentScores = detail.items[idx].correct_criteria_scores || detail.rubric.criteria.map((cr: any) => ({
                                        criterion: cr.name, score: cr.score_min
                                      }));
                                      handleUpdateItemCriteria(item.id, currentScores);
                                    }}
                                    style={{ width: 55, fontSize: 12 }}
                                  >
                                    {Array.from({ length: (c.score_max ?? 4) - (c.score_min ?? 0) + 1 }, (_, i) => (c.score_min ?? 0) + i).map((v: number) => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}
                            <td>
                              <button className="btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => handleDeleteItem(item.id)}>削除</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* Simple score table (no rubric) */
                  <table>
                    <thead>
                      <tr><th>#</th><th>作文</th><th>正解スコア</th><th>許容誤差</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item: any, idx: number) => (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td>{item.essay_id ? `作文#${item.essay_id}` : item.pdf_path ? 'PDF' : '-'}</td>
                          <td>
                            <input type="number" value={item.correct_score ?? 0} style={{ width: 60 }}
                              onChange={(e) => {
                                const updated = { ...detail };
                                updated.items[idx].correct_score = parseInt(e.target.value);
                                setDetail(updated);
                              }}
                              onBlur={() => handleUpdateItem(item.id, item.correct_score ?? 0, item.tolerance ?? 0)} />
                          </td>
                          <td>
                            <input type="number" value={item.tolerance ?? 0} style={{ width: 60 }}
                              onChange={(e) => {
                                const updated = { ...detail };
                                updated.items[idx].tolerance = parseInt(e.target.value);
                                setDetail(updated);
                              }}
                              onBlur={() => handleUpdateItem(item.id, item.correct_score ?? 0, item.tolerance ?? 0)} />
                          </td>
                          <td>
                            <button className="btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => handleDeleteItem(item.id)}>削除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <p style={{ color: '#64748b', fontSize: 13 }}>問題がまだありません</p>
              )}

              {/* Add new item */}
              <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>問題を追加</h4>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button className={addMode === 'pdf' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setAddMode('pdf')}>PDFアップロード</button>
                  <button className={addMode === 'essay' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setAddMode('essay')}>既存作文から選択</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                  {addMode === 'pdf' ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11 }}>作文PDF</label>
                      <input type="file" accept=".pdf" ref={pdfFileRef} style={{ fontSize: 12 }} />
                    </div>
                  ) : (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11 }}>作文</label>
                      <select value={addEssayId} onChange={(e) => setAddEssayId(Number(e.target.value))} style={{ width: 200, fontSize: 12 }}>
                        <option value={0}>-- 選択 --</option>
                        {essays.map((e: any) => (
                          <option key={e.id} value={e.id}>{e.receipt_number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {detail.rubric?.criteria && Array.isArray(detail.rubric.criteria) ? (
                    /* Rubric-based score inputs */
                    <>
                      {detail.rubric.criteria.map((c: any, ci: number) => (
                        <div key={ci} className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 11 }}>{c.name} ({c.score_min}〜{c.score_max})</label>
                          <select
                            value={addCriteriaScores[ci]?.score ?? c.score_min}
                            onChange={(e) => {
                              const newScores = [...addCriteriaScores];
                              newScores[ci] = { criterion: c.name, score: parseInt(e.target.value) };
                              setAddCriteriaScores(newScores);
                            }}
                            style={{ width: 60, fontSize: 12 }}
                          >
                            {Array.from({ length: (c.score_max ?? 4) - (c.score_min ?? 0) + 1 }, (_, i) => (c.score_min ?? 0) + i).map((v: number) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </>
                  ) : (
                    /* Simple score inputs */
                    <>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>正解スコア</label>
                        <input type="number" value={addCorrectScore} onChange={(e) => setAddCorrectScore(parseInt(e.target.value) || 0)} style={{ width: 70 }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>許容誤差</label>
                        <input type="number" value={addTolerance} onChange={(e) => setAddTolerance(parseInt(e.target.value) || 0)} style={{ width: 70 }} />
                      </div>
                    </>
                  )}
                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleAddItem}>追加</button>
                </div>
              </div>

              {/* Individual user assignment section */}
              <div style={{ marginTop: 20, padding: 12, background: '#f0f9ff', borderRadius: 8 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>個別ユーザー割り当て</h4>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                  割り当てが無い場合、公開された研修は全評価者に表示されます。割り当てがある場合、指定されたユーザーのみに表示されます。
                </p>

                {/* Assigned users list */}
                {assignments.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>割り当て済み ({assignments.length}名)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {assignments.map((a: any) => (
                        <span key={a.user_id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: '#e0f2fe', padding: '2px 8px', borderRadius: 12, fontSize: 11,
                        }}>
                          {a.display_name}
                          <button onClick={() => handleRemoveAssignment(a.user_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: 0 }}>
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add assignment */}
                <div>
                  <label style={{ fontSize: 11 }}>ユーザーを追加</label>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <button type="button" style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
                        onClick={() => setSelectedUserIds(unassignedUsers.map((u: any) => u.id))}>全選択</button>
                      <button type="button" style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
                        onClick={() => setSelectedUserIds([])}>全解除</button>
                    </div>
                    {unassignedUsers.map((u: any) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(prev => [...prev, u.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                            }
                          }}
                        />
                        {u.display_name} ({u.login_id})
                        {u.role === 'leader' && <span style={{ color: '#6366f1', fontSize: 10, fontWeight: 600 }}>[リーダー]</span>}
                      </label>
                    ))}
                    {unassignedUsers.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>割り当て可能なユーザーがいません</div>}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>CSVで一括割り当て</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="file" accept=".csv" ref={csvFileRef} style={{ fontSize: 11 }} />
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={handleCsvUpload}>CSV読込</button>
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>login_idを1列目に記載したCSVをアップロード</div>
                  </div>
                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, marginTop: 8 }}
                    onClick={handleAssignUsers} disabled={selectedUserIds.length === 0}>
                    割り当て
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'completions' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>修了者・受講者一覧</h2>
            <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 13 }}
              onClick={handleExportCompletions} disabled={exporting}>
              {exporting ? '出力中...' : 'Excel出力'}
            </button>
          </div>
          {completions.length === 0 ? (
            <p style={{ color: '#64748b' }}>受講データがありません</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>研修名</th>
                  <th>評価回</th>
                  <th>フェーズ</th>
                  <th>受講者</th>
                  <th>結果</th>
                  <th>正答率</th>
                  <th>完了日時</th>
                </tr>
              </thead>
              <tbody>
                {completions.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.training_title}</td>
                    <td>{c.round_name}</td>
                    <td>{c.phase === 'first' ? '1周目' : '2周目'}</td>
                    <td>{c.display_name} ({c.login_id})</td>
                    <td>
                      <span className={`badge ${c.status === 'passed' ? 'badge-green' : c.status === 'failed' ? 'badge-yellow' : 'badge-blue'}`}>
                        {c.status === 'passed' ? '合格' : c.status === 'failed' ? '不合格' : '受講中'}
                      </span>
                    </td>
                    <td>{c.score_percentage != null ? `${Number(c.score_percentage).toFixed(1)}%` : '-'}</td>
                    <td>{c.completed_at ? new Date(c.completed_at).toLocaleString('ja-JP') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新しいデモ評価研修</h2>
            <div className="form-group">
              <label>評価回</label>
              <select value={form.roundId} onChange={(e) => setForm({ ...form, roundId: Number(e.target.value) })}>
                {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>フェーズ</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                <option value="first">1周目</option>
                <option value="second">2周目</option>
              </select>
            </div>
            <div className="form-group">
              <label>タイトル</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例: 2026年6月1周目デモ評価研修" />
            </div>
            <div className="form-group">
              <label>説明</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="研修の説明・注意事項" />
            </div>
            <div className="form-group">
              <label>合格正答数</label>
              <input type="number" min={1} value={form.passThresholdCount}
                onChange={(e) => setForm({ ...form, passThresholdCount: parseInt(e.target.value) || 3 })} />
            </div>
            {(
              <div className="form-group">
                <label>ルーブリック</label>
                <select value={form.rubricId} onChange={(e) => setForm({ ...form, rubricId: Number(e.target.value) })}>
                  <option value={0}>-- 選択しない --</option>
                  {rubrics.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>キャンセル</button>
              <button className="btn-primary" onClick={handleCreate} disabled={!form.title || !form.roundId}>作成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
