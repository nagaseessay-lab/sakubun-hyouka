import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { listRounds } from '../../api/rounds.api';
import { getAvailabilitySummary } from '../../api/availability.api';
import type { EvaluationRound } from '../../types';

export default function AvailabilityOverviewPage() {
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [summary, setSummary] = useState<any[]>([]);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (r.length > 0) setSelectedRound(r[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedRound) return;
    getAvailabilitySummary(selectedRound).then(setSummary);
  }, [selectedRound]);

  const totalCapacity = summary.reduce((s, e) => s + parseInt(e.total_capacity), 0);
  const totalAssigned = summary.reduce((s, e) => s + parseInt(e.assigned_count), 0);
  const totalCompleted = summary.reduce((s, e) => s + parseInt(e.completed_count), 0);
  const round = rounds.find((r) => r.id === selectedRound);

  const chartData = summary.map((e) => ({
    name: `${e.display_name.slice(0, 4)}(${e.login_id})`,
    担当可能数: parseInt(e.total_capacity),
    割当数: parseInt(e.assigned_count),
    完了数: parseInt(e.completed_count),
  }));

  return (
    <div>
      <div className="page-header">
        <h1>担当可能数一覧</h1>
        <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))} style={{ width: 250 }}>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalCapacity}</div>
          <div className="stat-label">合計担当可能数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{round?.total_essay_count || 0}</div>
          <div className="stat-label">合計作文数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAssigned}</div>
          <div className="stat-label">割当済み</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalCompleted}</div>
          <div className="stat-label">完了済み</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>担当可能数 vs 割当数 vs 完了数</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Bar dataKey="担当可能数" fill="#93c5fd" />
            <Bar dataKey="割当数" fill="#2563eb" />
            <Bar dataKey="完了数" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>ID</th><th>評価者</th><th>担当可能数</th><th>割当数</th><th>完了数</th><th>残り</th></tr>
          </thead>
          <tbody>
            {summary.map((e) => (
              <tr key={e.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.login_id}</td>
                <td>{e.display_name}</td>
                <td>{e.total_capacity}</td>
                <td>{e.assigned_count}</td>
                <td>{e.completed_count}</td>
                <td>{parseInt(e.total_capacity) - parseInt(e.assigned_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
