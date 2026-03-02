import { useState, useEffect } from 'react';
import { listRounds } from '../../api/rounds.api';
import { generateExport, downloadExport, getEvaluatorStats, exportEvaluatorStats } from '../../api/export.api';
import type { EvaluationRound } from '../../types';

export default function ExportPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  // Salary calculation export state
  const [tab, setTab] = useState<'round' | 'salary'>('round');
  const [salaryDateFrom, setSalaryDateFrom] = useState('');
  const [salaryDateTo, setSalaryDateTo] = useState('');
  const [salaryRoundId, setSalaryRoundId] = useState<number>(0);
  const [salaryStats, setSalaryStats] = useState<any[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryGenerating, setSalaryGenerating] = useState(false);
  const [salaryFilename, setSalaryFilename] = useState('');
  const [salaryDownloadReady, setSalaryDownloadReady] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (r.length > 0) setSelectedRound(r[0].id);
    });
  }, []);

  async function handleExport() {
    setGenerating(true);
    setError('');
    setDownloadUrl('');
    try {
      const result = await generateExport(selectedRound);
      setFilename(result.filename);
      setDownloadUrl(result.downloadUrl);
    } catch (err: any) {
      setError(err?.message || err || 'Excel出力に失敗しました');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    try {
      await downloadExport(filename);
    } catch {
      alert('ダウンロードに失敗しました');
    }
  }

  // Salary export functions
  async function handleSalarySearch() {
    setSalaryLoading(true);
    setSalaryError('');
    setSalaryStats([]);
    setSalaryDownloadReady(false);
    setSalaryFilename('');
    try {
      const params: any = {};
      if (salaryDateFrom) params.dateFrom = salaryDateFrom;
      if (salaryDateTo) params.dateTo = salaryDateTo;
      if (salaryRoundId) params.roundId = salaryRoundId;
      const stats = await getEvaluatorStats(params);
      setSalaryStats(stats);
    } catch (err: any) {
      setSalaryError(err?.message || err || 'データ取得に失敗しました');
    } finally {
      setSalaryLoading(false);
    }
  }

  async function handleSalaryExport() {
    setSalaryGenerating(true);
    setSalaryError('');
    setSalaryDownloadReady(false);
    try {
      const body: any = {};
      if (salaryDateFrom) body.dateFrom = salaryDateFrom;
      if (salaryDateTo) body.dateTo = salaryDateTo;
      if (salaryRoundId) body.roundId = salaryRoundId;
      const result = await exportEvaluatorStats(body);
      setSalaryFilename(result.filename);
      setSalaryDownloadReady(true);
    } catch (err: any) {
      setSalaryError(err?.message || err || 'Excel出力に失敗しました');
    } finally {
      setSalaryGenerating(false);
    }
  }

  async function handleSalaryDownload() {
    try {
      await downloadExport(salaryFilename);
    } catch {
      alert('ダウンロードに失敗しました');
    }
  }

  // Aggregate salary stats by user for summary
  const userSummary = salaryStats.reduce((acc: Record<string, { login_id: string; display_name: string; role: string; first: number; second: number }>, row: any) => {
    const key = row.login_id;
    if (!acc[key]) {
      acc[key] = { login_id: row.login_id, display_name: row.display_name, role: row.role, first: 0, second: 0 };
    }
    const count = parseInt(row.completed_count);
    if (row.phase === 'first') acc[key].first += count;
    else acc[key].second += count;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1>Excel出力</h1>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <button
          onClick={() => setTab('round')}
          style={{
            padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '8px 0 0 8px',
            background: tab === 'round' ? '#2563eb' : 'white',
            color: tab === 'round' ? 'white' : '#475569',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          評価回別出力
        </button>
        <button
          onClick={() => setTab('salary')}
          style={{
            padding: '8px 20px', border: '1px solid #e2e8f0', borderLeft: 'none', borderRadius: '0 8px 8px 0',
            background: tab === 'salary' ? '#2563eb' : 'white',
            color: tab === 'salary' ? 'white' : '#475569',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          評価者別実績出力
        </button>
      </div>

      {/* Round export tab */}
      {tab === 'round' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <p style={{ color: '#64748b', marginBottom: 16 }}>
            評価回の結果をExcelファイルとして出力します。<br />
            1次採点結果、2次採点結果、ランキング、採点者集計の4シート構成です。
          </p>

          <div className="form-group">
            <label>評価回を選択</label>
            <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))}>
              {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button className="btn-primary" onClick={handleExport} disabled={generating || !selectedRound}>
            {generating ? '生成中...' : 'Excel生成'}
          </button>

          {downloadUrl && (
            <div style={{ marginTop: 16, background: '#dcfce7', padding: 16, borderRadius: 8 }}>
              <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>生成完了</p>
              <button className="btn-success" onClick={handleDownload}>
                ダウンロード ({filename})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Salary export tab */}
      {tab === 'salary' && (
        <div>
          <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
            <p style={{ color: '#64748b', marginBottom: 16 }}>
              給与計算用に、全評価者のフェーズ別評価完了件数を出力します。<br />
              期間・評価回で絞り込み、プレビュー後にExcelとしてダウンロードできます。
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>開始日</label>
                <input type="date" value={salaryDateFrom}
                  onChange={(e) => setSalaryDateFrom(e.target.value)}
                  style={{ padding: '6px 10px' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>終了日</label>
                <input type="date" value={salaryDateTo}
                  onChange={(e) => setSalaryDateTo(e.target.value)}
                  style={{ padding: '6px 10px' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>評価回 (任意)</label>
                <select value={salaryRoundId} onChange={(e) => setSalaryRoundId(Number(e.target.value))}
                  style={{ padding: '6px 10px' }}>
                  <option value={0}>すべて</option>
                  {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" onClick={handleSalarySearch}
                disabled={salaryLoading} style={{ height: 36 }}>
                {salaryLoading ? '検索中...' : '検索'}
              </button>
            </div>

            {salaryError && <div className="error-message" style={{ marginTop: 12 }}>{salaryError}</div>}
          </div>

          {/* Summary by user */}
          {salaryStats.length > 0 && (
            <div className="card" style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>評価者別集計 ({Object.keys(userSummary).length}名)</h2>
                <button className="btn-primary" onClick={handleSalaryExport}
                  disabled={salaryGenerating} style={{ padding: '6px 16px' }}>
                  {salaryGenerating ? '生成中...' : 'Excel出力'}
                </button>
              </div>

              {salaryDownloadReady && (
                <div style={{ marginBottom: 16, background: '#dcfce7', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>生成完了</span>
                  <button className="btn-success" onClick={handleSalaryDownload} style={{ padding: '4px 12px' }}>
                    ダウンロード
                  </button>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ログインID</th>
                      <th>氏名</th>
                      <th>役割</th>
                      <th style={{ textAlign: 'right' }}>1周目</th>
                      <th style={{ textAlign: 'right' }}>2周目</th>
                      <th style={{ textAlign: 'right' }}>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(userSummary).map((u: any) => (
                      <tr key={u.login_id}>
                        <td style={{ fontFamily: 'monospace' }}>{u.login_id}</td>
                        <td>{u.display_name}</td>
                        <td>{u.role === 'leader' ? 'リーダー' : '評価者'}</td>
                        <td style={{ textAlign: 'right' }}>{u.first}</td>
                        <td style={{ textAlign: 'right' }}>{u.second}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{u.first + u.second}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detail breakdown */}
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
                  詳細 (評価回・フェーズ別)
                </summary>
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>ログインID</th>
                        <th>氏名</th>
                        <th>評価回</th>
                        <th>フェーズ</th>
                        <th style={{ textAlign: 'right' }}>完了件数</th>
                        <th>最初の完了</th>
                        <th>最後の完了</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryStats.map((row: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace' }}>{row.login_id}</td>
                          <td>{row.display_name}</td>
                          <td>{row.round_name}</td>
                          <td>{row.phase === 'first' ? '1周目' : '2周目'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.completed_count}</td>
                          <td style={{ fontSize: 12 }}>{row.first_completed_at ? new Date(row.first_completed_at).toLocaleString('ja-JP') : '-'}</td>
                          <td style={{ fontSize: 12 }}>{row.last_completed_at ? new Date(row.last_completed_at).toLocaleString('ja-JP') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {salaryStats.length === 0 && !salaryLoading && !salaryError && (
            <div className="card" style={{ maxWidth: 700, textAlign: 'center', padding: 40, color: '#64748b' }}>
              期間や評価回を指定して検索してください
            </div>
          )}
        </div>
      )}
    </div>
  );
}
