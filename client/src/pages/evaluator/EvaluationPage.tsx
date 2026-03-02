import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMyAssignments } from '../../api/assignments.api';
import { getScore, saveScore, submitScore } from '../../api/scores.api';
import { getRoundRubric } from '../../api/rubrics.api';
import { getEssayPdfBlob } from '../../api/essays.api';
import type { Assignment, Score, SecondPhaseCriterion } from '../../types';

export default function EvaluationPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/leader') ? '/leader' : '/evaluator';
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [_score, setScore] = useState<Score | null>(null);
  const [criteria, setCriteria] = useState<SecondPhaseCriterion[]>([]);
  const [formData, setFormData] = useState({
    score: null as number | null,
    criteriaScores: [] as Array<{ criterion: string; score: number }>,
    studentNumber: '',
    summary: '',
    comment: '',
    isDefective: false,
    defectiveReason: '',
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');

  const asgId = parseInt(assignmentId || '0');

  useEffect(() => {
    getMyAssignments({ status: 'pending' }).then((list: Assignment[]) => {
      const inProgress = list.filter((a: Assignment) => a.status !== 'completed');
      setAllAssignments(inProgress);
      const idx = inProgress.findIndex((a: Assignment) => a.id === asgId);
      if (idx >= 0) setCurrentIdx(idx);
    });
  }, [asgId]);

  useEffect(() => {
    if (!asgId) return;

    // Reset all state when switching to a different assignment
    setScore(null);
    setFormData({
      score: null,
      criteriaScores: [],
      studentNumber: '',
      summary: '',
      comment: '',
      isDefective: false,
      defectiveReason: '',
    });
    setError('');
    setSuccess('');
    setCriteria([]);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl('');

    getMyAssignments({}).then((list: Assignment[]) => {
      const found = list.find((a: Assignment) => a.id === asgId);
      if (found) {
        setAssignment(found);

        // For 2nd phase, pre-fill student number and summary from 1st phase if available
        if (found.phase === 'second') {
          setFormData(prev => ({
            ...prev,
            studentNumber: found.first_student_number || found.essay_student_number || '',
            summary: found.first_phase_summary || '',
          }));
        }

        // Load rubric for the assignment's phase
        getRoundRubric(found.round_id, found.phase).then((rubric: any) => {
          if (rubric?.criteria) setCriteria(rubric.criteria);
          else setCriteria([]);
        }).catch(() => setCriteria([]));

        // Load PDF via Google Drive preview URL
        getEssayPdfBlob(found.essay_id)
          .then((url) => setPdfBlobUrl(url))
          .catch(() => setPdfBlobUrl(''));
      }
    });

    getScore(asgId).then((s: Score | null) => {
      if (s) {
        setScore(s);
        setFormData({
          score: s.score,
          criteriaScores: s.criteria_scores || [],
          studentNumber: s.student_number || '',
          summary: s.summary || '',
          comment: s.comment || '',
          isDefective: false,
          defectiveReason: '',
        });
      }
    }).catch(() => {});

    // Cleanup blob URL on unmount
    return () => {
      // Note: pdfBlobUrl cleanup is handled at the start of this effect
    };
  }, [asgId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await saveScore(asgId, {
        score: formData.score,
        criteriaScores: formData.criteriaScores,
        studentNumber: formData.studentNumber,
        summary: formData.summary,
        comment: formData.comment,
        isDefective: formData.isDefective,
        defectiveReason: formData.defectiveReason,
      });
      setSuccess('一時保存しました');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.message || err || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [asgId, formData]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // Save first, then submit
      await saveScore(asgId, {
        score: formData.score,
        criteriaScores: formData.criteriaScores,
        studentNumber: formData.studentNumber,
        summary: formData.summary,
        comment: formData.comment,
        isDefective: formData.isDefective,
        defectiveReason: formData.defectiveReason,
      });
      await submitScore(asgId);
      setSuccess('提出しました');
      // Navigate to next
      if (allAssignments.length > currentIdx + 1) {
        setTimeout(() => navigate(`${basePath}/evaluate/${allAssignments[currentIdx + 1].id}`), 1000);
      } else {
        setTimeout(() => navigate(basePath === '/leader' ? '/leader/my-assignments' : '/evaluator'), 1000);
      }
    } catch (err: any) {
      setError(err?.message || err || '提出に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-save every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (formData.studentNumber || formData.score !== null || formData.criteriaScores.length > 0) {
        handleSave();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [handleSave, formData]);

  const goTo = (idx: number) => {
    if (allAssignments[idx]) {
      navigate(`${basePath}/evaluate/${allAssignments[idx].id}`);
    }
  };

  if (!assignment) return <div className="loading">読み込み中...</div>;

  // Determine if we should show rubric-based scoring (criteria exist for this phase)
  const useRubric = criteria.length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>評価: {assignment.receipt_number}</h1>
          <span className={`badge ${assignment.phase === 'first' ? 'badge-blue' : 'badge-green'}`}>
            {assignment.phase === 'first' ? '1周目' : '2周目'}
          </span>
          <span style={{ color: '#64748b', marginLeft: 12, fontSize: 13 }}>
            {currentIdx + 1} / {allAssignments.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => goTo(currentIdx - 1)}
            disabled={currentIdx <= 0}>前</button>
          <button className="btn-secondary" onClick={() => goTo(currentIdx + 1)}
            disabled={currentIdx >= allAssignments.length - 1}>次</button>
          <button className="btn-secondary" onClick={() => navigate(basePath === '/leader' ? '/leader/my-assignments' : '/evaluator')}>一覧に戻る</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, height: 'calc(100vh - 140px)' }}>
        {/* PDF Viewer */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#toolbar=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="作文PDF"
              key={assignment.essay_id}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              PDF読み込み中...
            </div>
          )}
        </div>

        {/* Score Form */}
        <div className="card" style={{ overflowY: 'auto' }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>採点フォーム</h2>

          <div className="form-group">
            <label>生徒番号 *</label>
            <input
              type="text"
              value={formData.studentNumber}
              onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
              placeholder="生徒番号を入力"
            />
          </div>

          {assignment.phase === 'first' && !useRubric ? (
            <div className="form-group">
              <label>スコア (0〜4) *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[0, 1, 2, 3, 4].map((v) => (
                  <button
                    key={v}
                    onClick={() => setFormData({ ...formData, score: v })}
                    style={{
                      width: 48, height: 48, borderRadius: 8, fontSize: 18, fontWeight: 700,
                      background: formData.score === v ? '#2563eb' : '#f1f5f9',
                      color: formData.score === v ? 'white' : '#1e293b',
                      border: formData.score === v ? '2px solid #2563eb' : '2px solid #e2e8f0',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                ※ 1200字未満 → 0必須 / 字数充足 → 最低1 / レベル4は50枚中1枚まで
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontWeight: 500, fontSize: 13, color: '#64748b' }}>
                各観点の評価 (0〜{criteria[0]?.score_max ?? 3})
              </label>
              {criteria.map((c) => {
                const existing = formData.criteriaScores.find((cs) => cs.criterion === c.name);
                const currentScore = existing?.score ?? -1;
                const maxScore = c.score_max ?? 3;
                const scoreOptions = Array.from({ length: maxScore + 1 }, (_, i) => i);
                return (
                  <div key={c.name} style={{ marginBottom: 14, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: '#1e3a5f' }}>{c.name}</div>
                    {c.description && (
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }}>
                        {c.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {scoreOptions.map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const updated = formData.criteriaScores.filter((cs) => cs.criterion !== c.name);
                            updated.push({ criterion: c.name, score: v });
                            setFormData({ ...formData, criteriaScores: updated });
                          }}
                          style={{
                            width: 40, height: 36, borderRadius: 6, fontSize: 15, fontWeight: 600,
                            background: currentScore === v ? '#2563eb' : '#f1f5f9',
                            color: currentScore === v ? 'white' : '#1e293b',
                            border: currentScore === v ? '2px solid #2563eb' : '2px solid #e2e8f0',
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show 1st phase info in 2nd phase */}
          {assignment.phase === 'second' && (
            <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>1周目評価情報</div>
              {assignment.essay_first_score !== null && (
                <div style={{ color: '#475569' }}>1周目スコア: <strong>{assignment.essay_first_score}</strong></div>
              )}
              {assignment.first_phase_summary && (
                <div style={{ color: '#475569', marginTop: 4 }}>概要: {assignment.first_phase_summary}</div>
              )}
              {assignment.first_student_number && (
                <div style={{ color: '#475569', marginTop: 4 }}>1周目 生徒番号: {assignment.first_student_number}</div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>作文概要・所見 <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea
              rows={4}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="概要やコメントを入力（提出時必須）"
            />
          </div>

          <div className="form-group">
            <label>コメント（任意）</label>
            <textarea
              rows={2}
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              placeholder="追加コメント（リーダーへの連絡事項など）"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Defective essay checkbox */}
          <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={formData.isDefective}
                onChange={(e) => setFormData({ ...formData, isDefective: e.target.checked })} />
              <span style={{ fontWeight: 600, color: '#dc2626' }}>不備答案として報告</span>
            </label>
            {formData.isDefective && (
              <div style={{ marginTop: 8 }}>
                <input type="text" value={formData.defectiveReason}
                  onChange={(e) => setFormData({ ...formData, defectiveReason: e.target.value })}
                  placeholder="不備理由（白紙、判読不能、枚数不足 等）"
                  style={{ fontSize: 13, width: '100%' }} />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  ※ 不備答案として提出するとリーダー保留になります
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={handleSave} disabled={saving}
              style={{ flex: 1 }}>
              {saving ? '保存中...' : '一時保存'}
            </button>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}
              style={{ flex: 1 }}>
              {submitting ? '提出中...' : formData.isDefective ? '不備報告して提出' : '提出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
