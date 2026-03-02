import { useState, useEffect } from 'react';
import {
  getMyTrainings, getTraining, startAttempt,
  submitTrainingResponse, completeTrainingAttempt,
} from '../../api/training.api';
import { getEssayPdfBlob } from '../../api/essays.api';
import { gasPost } from '../../api/client';

export default function EvaluatorTrainingPage() {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active training attempt
  const [activeTraining, setActiveTraining] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [criteriaAnswers, setCriteriaAnswers] = useState<Record<number, Array<{ criterion: string; score: number }>>>({});
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [finalResult, setFinalResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTrainings();
  }, []);

  async function loadTrainings() {
    setLoading(true);
    try {
      setTrainings(await getMyTrainings());
    } catch {
      setTrainings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(trainingId: number) {
    try {
      const training = await getTraining(trainingId);
      const att = await startAttempt(trainingId);
      setActiveTraining(training);
      setAttempt(att);
      setCurrentItemIdx(0);
      setAnswers({});
      setCriteriaAnswers({});
      setResults({});
      setFinalResult(null);
      // Load first item's PDF
      if (training.items?.length > 0) {
        loadItemPdf(training.items[0]);
      }
    } catch (err: any) {
      alert(err?.message || err || '研修の開始に失敗しました');
    }
  }

  async function loadItemPdf(item: any) {
    setPdfBlobUrl('');
    try {
      if (item.essay_id) {
        // エッセイのPDFをGoogle Driveから取得
        const url = await getEssayPdfBlob(item.essay_id);
        setPdfBlobUrl(url);
      } else {
        // 研修アイテム独自PDFのURLを取得
        const result = await gasPost<{ previewUrl: string }>('training.getItemPdfUrl', { itemId: item.id });
        setPdfBlobUrl(result.previewUrl || '');
      }
    } catch {
      setPdfBlobUrl('');
    }
  }

  async function handleSubmitAnswer() {
    if (!activeTraining || !attempt) return;
    const item = activeTraining.items[currentItemIdx];
    const hasRubric = activeTraining.rubric?.criteria && Array.isArray(activeTraining.rubric.criteria);

    if (hasRubric) {
      const ca = criteriaAnswers[item.id];
      if (!ca || ca.length !== activeTraining.rubric.criteria.length) {
        alert('すべての観点のスコアを選択してください');
        return;
      }
    } else {
      const score = answers[item.id];
      if (score === undefined) { alert('スコアを選択してください'); return; }
    }

    setSubmitting(true);
    try {
      const result = await submitTrainingResponse(attempt.id, {
        itemId: item.id,
        givenScore: hasRubric ? undefined : answers[item.id],
        givenCriteriaScores: hasRubric ? criteriaAnswers[item.id] : undefined,
      });
      setResults((prev) => ({ ...prev, [item.id]: result.isCorrect }));
    } catch (err: any) {
      alert(err?.message || err || '回答の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    const nextIdx = currentItemIdx + 1;
    if (nextIdx < activeTraining.items.length) {
      setCurrentItemIdx(nextIdx);
      loadItemPdf(activeTraining.items[nextIdx]);
    }
  }

  async function handleComplete() {
    if (!attempt) return;
    try {
      const result = await completeTrainingAttempt(attempt.id);
      setFinalResult(result);
      loadTrainings(); // Refresh status
    } catch (err: any) {
      alert(err?.message || err || '完了処理に失敗しました');
    }
  }

  function handleBack() {
    setActiveTraining(null);
    setAttempt(null);
    setFinalResult(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl('');
  }

  // Final result screen
  if (finalResult) {
    return (
      <div>
        <div className="page-header">
          <h1>デモ評価研修 結果</h1>
        </div>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {finalResult.status === 'passed' ? '🎉' : '📝'}
          </div>
          <h2 style={{ color: finalResult.status === 'passed' ? '#16a34a' : '#b45309', marginBottom: 8 }}>
            {finalResult.status === 'passed' ? '合格' : '不合格'}
          </h2>
          <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
            正解: {finalResult.correct} / {finalResult.total} 問
          </p>
          {finalResult.status !== 'passed' && (
            <p style={{ color: '#b45309', fontSize: 14, marginBottom: 16 }}>
              合格するまで再度受講できます。
            </p>
          )}
          <button className="btn-primary" onClick={handleBack}>一覧に戻る</button>
        </div>
      </div>
    );
  }

  // Active training screen
  if (activeTraining && attempt) {
    const items = activeTraining.items || [];
    const currentItem = items[currentItemIdx];
    const hasAnswered = currentItem && results[currentItem.id] !== undefined;
    const allAnswered = items.every((item: any) => results[item.id] !== undefined);

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: 18 }}>{activeTraining.title}</h1>
            <span style={{ color: '#64748b', fontSize: 13 }}>
              問題 {currentItemIdx + 1} / {items.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => { setCurrentItemIdx(Math.max(0, currentItemIdx - 1)); if (items[currentItemIdx - 1]) loadItemPdf(items[currentItemIdx - 1]); }}
              disabled={currentItemIdx <= 0}>前</button>
            <button className="btn-secondary" onClick={handleNext}
              disabled={currentItemIdx >= items.length - 1}>次</button>
            {allAnswered && (
              <button className="btn-primary" onClick={handleComplete}>提出して結果を見る</button>
            )}
            <button className="btn-secondary" onClick={handleBack}>中止</button>
          </div>
        </div>

        {currentItem && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20, height: 'calc(100vh - 140px)' }}>
            {/* PDF viewer */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {pdfBlobUrl ? (
                <iframe src={`${pdfBlobUrl}#toolbar=1`} style={{ width: '100%', height: '100%', border: 'none' }} title="研修PDF" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  PDF読み込み中...
                </div>
              )}
            </div>

            {/* Score input */}
            <div className="card" style={{ overflowY: 'auto' }}>
              <h2 style={{ fontSize: 16, marginBottom: 16 }}>採点</h2>

              {activeTraining.rubric?.criteria && Array.isArray(activeTraining.rubric.criteria) ? (
                /* Rubric-based scoring */
                <>
                  {activeTraining.rubric.criteria.map((c: any, ci: number) => {
                    const ca = criteriaAnswers[currentItem.id] || [];
                    const currentVal = ca.find((a: any) => a.criterion === c.name)?.score;
                    const scoreRange = Array.from({ length: (c.score_max ?? 4) - (c.score_min ?? 0) + 1 }, (_, i) => (c.score_min ?? 0) + i);
                    return (
                      <div key={ci} className="form-group" style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>{c.name} ({c.score_min}〜{c.score_max})</label>
                        {c.description && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{c.description}</div>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {scoreRange.map((v: number) => (
                            <button key={v}
                              onClick={() => {
                                setCriteriaAnswers(prev => {
                                  const existing = [...(prev[currentItem.id] || [])];
                                  const idx = existing.findIndex((a: any) => a.criterion === c.name);
                                  if (idx >= 0) {
                                    existing[idx] = { criterion: c.name, score: v };
                                  } else {
                                    existing.push({ criterion: c.name, score: v });
                                  }
                                  return { ...prev, [currentItem.id]: existing };
                                });
                              }}
                              disabled={hasAnswered}
                              style={{
                                width: 40, height: 40, borderRadius: 8, fontSize: 16, fontWeight: 700,
                                background: currentVal === v ? '#2563eb' : '#f1f5f9',
                                color: currentVal === v ? 'white' : '#1e293b',
                                border: currentVal === v ? '2px solid #2563eb' : '2px solid #e2e8f0',
                                opacity: hasAnswered ? 0.7 : 1,
                              }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {!hasAnswered ? (
                    <button className="btn-primary" onClick={handleSubmitAnswer}
                      disabled={!criteriaAnswers[currentItem.id] || criteriaAnswers[currentItem.id].length !== activeTraining.rubric.criteria.length || submitting}
                      style={{ marginTop: 8 }}>
                      {submitting ? '送信中...' : '回答する'}
                    </button>
                  ) : (
                    <div style={{
                      marginTop: 12, padding: 16, borderRadius: 8,
                      background: results[currentItem.id] ? '#dcfce7' : '#fef3c7',
                      color: results[currentItem.id] ? '#16a34a' : '#b45309',
                    }}>
                      <strong>{results[currentItem.id] ? '正解!' : '不正解'}</strong>
                    </div>
                  )}
                </>
              ) : (
                /* Simple 0-4 scoring */
                <>
                  <div className="form-group">
                    <label>スコア (0〜4)</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {[0, 1, 2, 3, 4].map((v) => (
                        <button key={v} onClick={() => setAnswers((prev) => ({ ...prev, [currentItem.id]: v }))}
                          disabled={hasAnswered}
                          style={{
                            width: 48, height: 48, borderRadius: 8, fontSize: 18, fontWeight: 700,
                            background: answers[currentItem.id] === v ? '#2563eb' : '#f1f5f9',
                            color: answers[currentItem.id] === v ? 'white' : '#1e293b',
                            border: answers[currentItem.id] === v ? '2px solid #2563eb' : '2px solid #e2e8f0',
                            opacity: hasAnswered ? 0.7 : 1,
                          }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!hasAnswered ? (
                    <button className="btn-primary" onClick={handleSubmitAnswer} disabled={answers[currentItem.id] === undefined || submitting}
                      style={{ marginTop: 16 }}>
                      {submitting ? '送信中...' : '回答する'}
                    </button>
                  ) : (
                    <div style={{
                      marginTop: 16, padding: 16, borderRadius: 8,
                      background: results[currentItem.id] ? '#dcfce7' : '#fef3c7',
                      color: results[currentItem.id] ? '#16a34a' : '#b45309',
                    }}>
                      <strong>{results[currentItem.id] ? '正解!' : '不正解'}</strong>
                    </div>
                  )}
                </>
              )}

              {/* Progress indicators */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>進捗</h3>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {items.map((item: any, idx: number) => (
                    <div key={item.id}
                      onClick={() => { setCurrentItemIdx(idx); loadItemPdf(item); }}
                      style={{
                        width: 32, height: 32, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        background: results[item.id] === true ? '#dcfce7' : results[item.id] === false ? '#fef3c7' : idx === currentItemIdx ? '#dbeafe' : '#f1f5f9',
                        color: results[item.id] === true ? '#16a34a' : results[item.id] === false ? '#b45309' : '#475569',
                        border: idx === currentItemIdx ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      }}>
                      {idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Training list
  return (
    <div>
      <div className="page-header">
        <h1>デモ評価研修</h1>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : trainings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          現在受講可能なデモ評価研修はありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trainings.map((t) => (
            <div key={t.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{t.title}</h3>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {t.round_name} | {t.phase === 'first' ? '1周目' : '2周目'} | {t.item_count}問 | 合格正答数: {t.pass_threshold_count}問
                    {t.my_attempts > 0 && ` | 受講回数: ${t.my_attempts}回`}
                  </div>
                  {t.my_status && (
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${t.my_status === 'passed' ? 'badge-green' : t.my_status === 'failed' ? 'badge-yellow' : 'badge-blue'}`}>
                        {t.my_status === 'passed' ? '合格済み' : t.my_status === 'failed' ? '不合格 (再受講可)' : '受講中'}
                      </span>
                      {t.my_score != null && t.my_correct != null && t.my_total != null && <span style={{ marginLeft: 8, fontSize: 13, color: '#64748b' }}>最新: {t.my_correct}/{t.my_total}問正解</span>}
                    </div>
                  )}
                </div>
                {t.my_status === 'passed' ? (
                  <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, padding: '6px 16px' }}>
                    合格済み（再受講不可）
                  </span>
                ) : (
                  <button className="btn-primary" style={{ padding: '6px 16px' }}
                    onClick={() => handleStart(t.id)}>
                    {t.my_status === 'in_progress' ? '続きから' : t.my_status === 'failed' ? '再受講' : '受講開始'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
