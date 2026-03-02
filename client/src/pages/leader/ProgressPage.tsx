import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { listRounds, getProgress } from '../../api/rounds.api';
import type { EvaluationRound, ProgressOverview, EvaluatorProgress } from '../../types';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4'];

export default function ProgressPage() {
  const [searchParams] = useSearchParams();
  const [rounds, setRounds] = useState<EvaluationRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(Number(searchParams.get('round')) || 0);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [evaluators, setEvaluators] = useState<EvaluatorProgress[]>([]);

  useEffect(() => {
    listRounds().then((r) => {
      setRounds(r);
      if (!selectedRound && r.length > 0) setSelectedRound(r[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedRound) return;
    getProgress(selectedRound).then((data) => {
      setOverview(data.overview);
      setEvaluators(data.evaluators);
    });
  }, [selectedRound]);

  const leaderHold = overview ? parseInt(String(overview.leader_hold || 0)) : 0;
  const pieData = overview ? [
    { name: '未割当', value: parseInt(String(overview.unassigned)) },
    { name: '1周目割当', value: parseInt(String(overview.assigned_first)) },
    { name: '1周目完了', value: parseInt(String(overview.first_complete)) },
    { name: '2周目割当', value: parseInt(String(overview.assigned_second)) },
    { name: '2周目完了', value: parseInt(String(overview.second_complete)) },
    { name: '不備保留', value: leaderHold },
  ].filter((d) => d.value > 0) : [];

  const barData = evaluators.map((e) => ({
    name: `${e.display_name.slice(0, 4)}(${e.login_id || ''})`,
    '1周目割当': parseInt(String(e.first_assigned)),
    '1周目完了': parseInt(String(e.first_completed)),
    '2周目割当': parseInt(String(e.second_assigned)),
    '2周目完了': parseInt(String(e.second_completed)),
  }));

  const total = overview ? parseInt(String(overview.total)) : 0;
  const completedFirst = overview ? parseInt(String(overview.first_complete)) + parseInt(String(overview.assigned_second)) + parseInt(String(overview.second_complete)) : 0;
  const completedSecond = overview ? parseInt(String(overview.second_complete)) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>進捗・グラフ</h1>
        <select value={selectedRound} onChange={(e) => setSelectedRound(Number(e.target.value))} style={{ width: 250 }}>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {overview && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{total.toLocaleString()}</div>
              <div className="stat-label">合計作文数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{total > 0 ? Math.round((completedFirst / total) * 100) : 0}%</div>
              <div className="stat-label">1周目進捗率</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{completedFirst.toLocaleString()}</div>
              <div className="stat-label">1周目完了</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{completedSecond.toLocaleString()}</div>
              <div className="stat-label">2周目完了</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>全体進捗</h3>
            <div style={{ background: '#e2e8f0', borderRadius: 8, height: 32, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${total > 0 ? (completedSecond / total) * 100 : 0}%`, background: '#16a34a', height: '100%' }} />
              <div style={{ width: `${total > 0 ? ((completedFirst - completedSecond) / total) * 100 : 0}%`, background: '#2563eb', height: '100%' }} />
              <div style={{ width: `${total > 0 ? ((parseInt(String(overview.assigned_first)) + parseInt(String(overview.assigned_second))) / total) * 100 : 0}%`, background: '#f59e0b', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
              <span><span style={{ color: '#16a34a' }}>■</span> 2周目完了</span>
              <span><span style={{ color: '#2563eb' }}>■</span> 1周目完了</span>
              <span><span style={{ color: '#f59e0b' }}>■</span> 評価中</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Pie Chart */}
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>状態別分布</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>評価者別枚数</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="1周目完了" fill="#2563eb" />
                  <Bar dataKey="1周目割当" fill="#93c5fd" />
                  <Bar dataKey="2周目完了" fill="#16a34a" />
                  <Bar dataKey="2周目割当" fill="#86efac" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
