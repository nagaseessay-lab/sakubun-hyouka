import { useState, useEffect, useRef } from 'react';
import { listUsers, createUser, updateUser, deleteUser, bulkCreateUsers } from '../../api/export.api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [form, setForm] = useState({ loginId: '', displayName: '', email: '', role: 'evaluator' });
  const [csvData, setCsvData] = useState<Array<{ loginId: string; displayName: string; email: string; role: string }>>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<{ created: any[]; errors: string[] } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', email: '', role: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setUsers(await listUsers());
  }

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleCreate() {
    try {
      await createUser(form);
      setShowModal(false);
      setForm({ loginId: '', displayName: '', email: '', role: 'evaluator' });
      loadUsers();
      showMsg('ユーザーを追加しました');
    } catch (err: any) {
      setError(err?.message || err || '追加に失敗しました');
    }
  }

  async function handleToggleActive(id: number, currentActive: boolean) {
    await updateUser(id, { isActive: !currentActive });
    loadUsers();
  }

  function openEditModal(user: any) {
    setEditingUser(user);
    setEditForm({
      displayName: user.display_name || '',
      email: user.email || '',
      role: user.role || 'evaluator',
    });
  }

  async function handleEditSave() {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, editForm);
      setEditingUser(null);
      loadUsers();
      showMsg('ユーザー情報を更新しました');
    } catch (err: any) {
      setError(err?.message || err || '更新に失敗しました');
    }
  }

  async function handleDelete(id: number, loginId: string) {
    if (!confirm(`${loginId} を削除しますか？この操作は取り消せません。`)) return;
    try {
      await deleteUser(id);
      loadUsers();
      showMsg(`${loginId} を削除しました`);
    } catch (err: any) {
      setError(err?.message || err || '削除に失敗しました');
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const errors: string[] = [];
      const parsed: Array<{ loginId: string; displayName: string; email: string; role: string }> = [];

      // Skip header if first line looks like a header
      const startIdx = lines[0]?.match(/login|ログイン|ID|メール|email/i) ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) {
          errors.push(`${i + 1}行目: カラムが不足しています（4列必要: ログインID,名前,メールアドレス,権限）`);
          continue;
        }
        const [loginId, displayName, email, role] = cols;
        if (loginId.length !== 6) {
          errors.push(`${i + 1}行目: ログインID「${loginId}」は6桁ではありません`);
          continue;
        }
        if (!displayName) {
          errors.push(`${i + 1}行目: 名前が空です`);
          continue;
        }
        if (!email || !email.includes('@')) {
          errors.push(`${i + 1}行目: メールアドレス「${email || '(空)'}」が不正です`);
          continue;
        }
        const normalizedRole = role === 'リーダー' || role === 'leader' ? 'leader' : 'evaluator';
        parsed.push({ loginId, displayName, email, role: normalizedRole });
      }

      setCsvData(parsed);
      setCsvErrors(errors);
      setBulkResult(null);
    };
    reader.readAsText(file);
  }

  async function handleBulkCreate() {
    try {
      const result = await bulkCreateUsers(csvData);
      setBulkResult(result);
      loadUsers();
    } catch (err: any) {
      setError(err?.message || err || '一括登録に失敗しました');
    }
  }

  function closeCsvModal() {
    setShowCsvModal(false);
    setCsvData([]);
    setCsvErrors([]);
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isCreateValid = form.loginId.length === 6 && form.displayName && form.email.includes('@');

  return (
    <div>
      <div className="page-header">
        <h1>ユーザー管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowCsvModal(true)}>CSV一括登録</button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>新規追加</button>
        </div>
      </div>

      {message && <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" onClick={() => setError('')}>{error}</div>}

      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
        ※ ユーザーは登録されたGoogleアカウント（メールアドレス）でログインします。
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>ログインID</th><th>名前</th><th>メールアドレス</th><th>権限</th><th>状態</th><th>操作</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.login_id}</td>
                <td>{u.display_name}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{u.email || '未設定'}</td>
                <td><span className={`badge ${u.role === 'leader' ? 'badge-blue' : 'badge-gray'}`}>
                  {u.role === 'leader' ? 'リーダー' : '評価者'}
                </span></td>
                <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                  {u.is_active ? '有効' : '無効'}
                </span></td>
                <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => openEditModal(u)}>
                    編集
                  </button>
                  <button className={u.is_active ? 'btn-danger' : 'btn-success'}
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => handleToggleActive(u.id, u.is_active)}>
                    {u.is_active ? '無効化' : '有効化'}
                  </button>
                  <button className="btn-danger"
                    style={{ padding: '4px 8px', fontSize: 12, background: '#7f1d1d' }}
                    onClick={() => handleDelete(u.id, u.login_id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新規追加モーダル */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>ユーザー追加</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Googleアカウントのメールアドレスを登録すると、そのアカウントでログインできるようになります
            </p>
            <div className="form-group">
              <label>ログインID（6桁）</label>
              <input value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                maxLength={6} placeholder="000003" />
            </div>
            <div className="form-group">
              <label>名前</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="田中太郎" />
            </div>
            <div className="form-group">
              <label>Googleアカウント（メールアドレス）</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tanaka@gmail.com" />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                ※ このメールアドレスのGoogleアカウントでログインできるようになります
              </span>
            </div>
            <div className="form-group">
              <label>権限</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="evaluator">評価者</option>
                <option value="leader">リーダー</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn-primary" onClick={handleCreate}
                disabled={!isCreateValid}>追加</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>ユーザー編集: {editingUser.login_id}</h2>
            <div className="form-group">
              <label>名前</label>
              <input value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                placeholder="田中太郎" />
            </div>
            <div className="form-group">
              <label>Googleアカウント（メールアドレス）</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="tanaka@gmail.com" />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                ※ 変更すると、新しいメールアドレスのGoogleアカウントでのみログイン可能になります
              </span>
            </div>
            <div className="form-group">
              <label>権限</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="evaluator">評価者</option>
                <option value="leader">リーダー</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingUser(null)}>キャンセル</button>
              <button className="btn-primary" onClick={handleEditSave}
                disabled={!editForm.displayName || !editForm.email.includes('@')}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV一括登録モーダル */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={closeCsvModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 500 }}>
            <h2>CSV一括登録</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              CSVフォーマット: <code>ログインID,名前,メールアドレス,権限</code><br />
              権限は「評価者」または「リーダー」<br />
              メールアドレスはGoogleアカウントのものを入力してください
            </p>

            <div className="form-group">
              <label>CSVファイルを選択</label>
              <input type="file" accept=".csv" onChange={handleCsvFile} ref={fileInputRef} />
            </div>

            {csvErrors.length > 0 && (
              <div style={{ background: '#fef3c7', color: '#92400e', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                <strong>警告:</strong>
                {csvErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {csvData.length > 0 && !bulkResult && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  プレビュー（{csvData.length}件）
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table>
                    <thead>
                      <tr><th>ログインID</th><th>名前</th><th>メール</th><th>権限</th></tr>
                    </thead>
                    <tbody>
                      {csvData.map((row, i) => (
                        <tr key={i}>
                          <td>{row.loginId}</td>
                          <td>{row.displayName}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{row.email}</td>
                          <td>{row.role === 'leader' ? 'リーダー' : '評価者'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult && (
              <div style={{ fontSize: 13 }}>
                <div style={{ background: '#dcfce7', color: '#16a34a', padding: 12, borderRadius: 6, marginBottom: 8 }}>
                  {bulkResult.created.length}件 登録成功
                </div>
                {bulkResult.errors.length > 0 && (
                  <div style={{ background: '#fee2e2', color: '#dc2626', padding: 12, borderRadius: 6 }}>
                    {bulkResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeCsvModal}>
                {bulkResult ? '閉じる' : 'キャンセル'}
              </button>
              {!bulkResult && csvData.length > 0 && (
                <button className="btn-primary" onClick={handleBulkCreate}>
                  {csvData.length}件を一括登録
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
