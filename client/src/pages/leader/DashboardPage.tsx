import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRounds } from '../../api/rounds.api';
import type { EvaluationRound } from '../../types';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: '下書き', class: 'badge-gray' },
  uploading: { label: 'アップロード中', class: 'badge-yellow' },
  first_phase: { label: '1周目評価中', class: 'badge-blue' },
  first_complete: { label: '1周目完了', class: 'badge-green' },
  second_phase: { label: '2周目評価中', class: 'badge-blue' },
  second_complete: { label: '2周目完了', class: 'badge-green' },
  archived: { label: 'アーカイブ', class: 'badge-gray' },
};

export default function LeaderDashboard() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listRounds().then(setRounds);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>リーダーダッシュボード</h1>
        <button className="btn-primary" onClick={() => navigate('/leader/rounds')}>
          評価回管理
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{rounds.length}</div>
          <div className="stat-label">評価回数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rounds.filter((r) => r.status !== 'archived' && r.status !== 'draft').length}</div>
          <div className="stat-label">進行中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rounds.reduce((s, r) => s + r.total_essay_count, 0).toLocaleString()}</div>
          <div className="stat-label">合計作文数</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>評価回一覧</h2>
        <table>
          <thead>
            <tr>
              <th>評価回名</th>
              <th>タイプ</th>
              <th>状態</th>
              <th>作文数</th>
              <th>作成日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const st = STATUS_LABELS[r.status] || { label: r.status, class: 'badge-gray' };
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>
                    {r.phase_type === 'both' ? '1周目+2周目' : r.phase_type === 'first_only' ? '1周目のみ' : '2周目のみ'}
                  </td>
                  <td><span className={`badge ${st.class}`}>{st.label}</span></td>
                  <td>{r.total_essay_count.toLocaleString()}</td>
                  <td>{new Date(r.created_at).toLocaleDateString('ja-JP')}</td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => navigate(`/leader/progress?round=${r.id}`)}>
                      詳細
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
