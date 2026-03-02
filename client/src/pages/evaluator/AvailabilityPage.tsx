import { useState, useEffect } from 'react';
import { getMyAvailability, upsertAvailability } from '../../api/availability.api';
import type { AvailabilityEntry } from '../../types';

export default function AvailabilityPage() {
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Month navigation
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    getMyAvailability().then(setEntries);
  }, []);

  // Generate all dates for the view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const monthDates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const yyyy = viewYear.toString();
    const mm = (viewMonth + 1).toString().padStart(2, '0');
    const dd = d.toString().padStart(2, '0');
    monthDates.push(`${yyyy}-${mm}-${dd}`);
  }

  function getCapacity(date: string): number {
    return entries.find((e) => e.date === date)?.capacity ?? 0;
  }

  function setCapacity(date: string, capacity: number) {
    const updated = entries.filter((e) => e.date !== date);
    updated.push({ date, capacity: Math.max(0, capacity) });
    setEntries(updated);
  }

  // Deadline: 前日23:59まで → editable only if date > today
  function isEditable(dateStr: string): boolean {
    return dateStr > todayStr;
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Send only editable (future) dates
      const monthEntries = monthDates
        .filter(date => isEditable(date))
        .map(date => ({
          date,
          capacity: getCapacity(date),
        }));
      await upsertAvailability(monthEntries);
      setSuccess('保存しました');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      alert(err?.message || err || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const monthTotal = monthDates.reduce((s, d) => s + getCapacity(d), 0);
  const allTotal = entries.reduce((s, e) => s + e.capacity, 0);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div>
      <div className="page-header">
        <h1>担当可能数登録</h1>
      </div>

      {success && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: 6, marginBottom: 16 }}>{success}</div>}

      <div className="card">
        <p style={{ color: '#64748b', marginBottom: 16, fontSize: 13 }}>
          各日に担当可能な作文数を入力してください。前日の23:59まで登録・修正が可能です。
        </p>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn-secondary" onClick={prevMonth} style={{ padding: '6px 12px' }}>&larr; 前月</button>
          <h2 style={{ margin: 0, fontSize: 18 }}>{viewYear}年{viewMonth + 1}月</h2>
          <button className="btn-secondary" onClick={nextMonth} style={{ padding: '6px 12px' }}>翌月 &rarr;</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>今月合計: {monthTotal}件</span>
          <span style={{ color: '#64748b', fontSize: 13 }}>全体合計: {allTotal}件</span>
        </div>

        {/* Calendar header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {dayNames.map((name, i) => (
            <div key={name} style={{
              textAlign: 'center', padding: 6, fontSize: 12, fontWeight: 600,
              color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : '#475569',
            }}>
              {name}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {/* Empty cells for days before the 1st */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {monthDates.map((date) => {
            // Parse date parts directly to avoid timezone issues
            const [, , dayStr] = date.split('-');
            const dayNum = parseInt(dayStr);
            // Compute day of week using local Date constructor
            const parts = date.split('-').map(Number);
            const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
            const dayOfWeek = localDate.getDay();
            const editable = isEditable(date);
            const capacity = getCapacity(date);
            const isToday = date === todayStr;

            return (
              <div key={date} style={{
                textAlign: 'center', padding: 8, borderRadius: 8,
                background: !editable ? '#f1f5f9' : dayOfWeek === 0 || dayOfWeek === 6 ? '#fef3c7' : 'white',
                border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0',
                opacity: !editable ? 0.5 : 1,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: isToday ? 700 : 400,
                  color: dayOfWeek === 0 ? '#dc2626' : dayOfWeek === 6 ? '#2563eb' : '#475569',
                  marginBottom: 4,
                }}>
                  {dayNum}
                </div>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={capacity}
                  onChange={(e) => setCapacity(date, parseInt(e.target.value) || 0)}
                  disabled={!editable}
                  style={{ width: '100%', textAlign: 'center', padding: 4, fontSize: 14 }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
