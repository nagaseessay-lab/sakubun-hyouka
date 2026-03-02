export default function EvaluatorGuidePage() {
  return (
    <div>
      <div className="page-header">
        <h1>使い方ガイド</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, color: '#1e3a5f' }}>評価フロー</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          {[
            { label: '1. デモ研修を受講', color: '#f3e8ff', border: '#a855f7' },
            { label: '2. 担当可能数登録', color: '#fef3c7', border: '#f59e0b' },
            { label: '3. 割り当て通知を受け取る', color: '#dbeafe', border: '#3b82f6' },
            { label: '4. 作文を評価・提出', color: '#dcfce7', border: '#22c55e' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                background: step.color, border: `1px solid ${step.border}`,
              }}>
                {step.label}
              </div>
              {i < 3 && <span style={{ color: '#94a3b8', fontSize: 18 }}>&rarr;</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 0: デモ評価研修</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; デモ研修</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>実際の評価前に、サンプル作文で練習できます</li>
              <li>作文PDFを見ながらスコアを付け、正解と比較します</li>
              <li><strong>ルーブリックなし</strong>の場合: 0〜4の5段階でスコアを付けます</li>
              <li><strong>ルーブリックあり</strong>の場合: 各観点（例: 内容、構成、表現など）ごとにスコアを付けます。各観点のスコア範囲はルーブリックの設定に従います</li>
              <li>回答後に、各観点ごとの正解/不正解がフィードバックされます</li>
              <li><strong>合格正答数</strong>（例: 5問中3問正解）を超えるまで何度でも受講できます</li>
              <li>合格後に実際の評価作業が行えます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 1: 担当可能数を登録する</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 担当可能数</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>月別カレンダーで各日の<strong>担当可能件数</strong>を入力します</li>
              <li>数字を入力するだけで、その日に評価できる作文数を登録できます</li>
              <li><strong>前日の23:59まで</strong>登録・修正が可能です</li>
              <li>月を切り替えて先の月の登録もできます</li>
            </ul>
            <p style={{ color: '#64748b', marginTop: 8 }}>
              ※ 担当可能数が0の日は作文が振り分けられません
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 2: 割り当て通知を確認する</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 通知</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>リーダーが作文を振り分けると、通知が届きます</li>
              <li>サイドバーの「通知」リンクに<strong>未読件数バッジ</strong>（赤丸）が表示されます</li>
              <li>バッジは30秒ごとに自動更新されるので、こまめに確認しましょう</li>
              <li>マイ担当一覧の「未完了の作文」に新しい作文が表示されます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 3: 1周目の評価</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> マイ担当一覧 &rarr; 「評価する」ボタン</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>左側にPDF、右側に採点フォームが表示されます</li>
              <li><strong>生徒番号</strong>: PDFに記載された生徒番号を入力</li>
              <li><strong>スコア</strong>: 0〜4の5段階で評価
                <ul style={{ paddingLeft: 16, marginTop: 2 }}>
                  <li>0: 1200字未満の場合（評価不要）</li>
                  <li>1: 字数は充足しているが最低評価</li>
                  <li>2〜3: 通常の評価</li>
                  <li>4: 特に優秀（50枚中1枚程度の基準）</li>
                </ul>
              </li>
              <li><strong>作文概要</strong>（必須）: 作文の内容を簡潔にまとめます</li>
              <li><strong>コメント</strong>（任意）: リーダーへの連絡事項など</li>
              <li><strong>不備答案チェック</strong>: 白紙・判読不能等の場合はチェックを入れると、リーダー保留になります</li>
              <li><strong>提出期限</strong>が設定されている場合、マイ担当一覧に期限日が表示されます。期限超過の場合は赤字で「期限超過」と表示されます</li>
            </ul>
            <p style={{ color: '#64748b', marginTop: 8 }}>
              ※ 「一時保存」で途中保存、「提出」で確定します（60秒ごとに自動保存あり）
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 4: 2周目の評価</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p>1周目で上位に選ばれた作文が2周目に進みます。</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>2周目は<strong>ルーブリック</strong>（多観点採点基準）に基づいて評価します</li>
              <li>各観点ごとにスコアを付けます</li>
              <li>観点名の下に<strong>補足説明</strong>が表示される場合は、参考にして採点してください</li>
              <li>1周目で評価した作文は2周目には割り当てられません</li>
              <li>1周目の<strong>生徒番号・作文概要・スコア</strong>が参考情報として表示されます</li>
              <li><strong>提出期限</strong>が設定されている場合はマイ担当一覧に表示されるので、期限内の提出を心がけましょう</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>完了済み作文の閲覧</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> マイ担当一覧 &rarr; 「完了済みの作文」セクション</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>自分が評価した完了済みの作文を確認できます</li>
              <li>「閲覧」ボタンでPDFとスコア詳細を表示</li>
              <li>提出した生徒番号、スコア、概要、コメントが確認できます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>その他のヒント</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li>評価画面の「前」「次」ボタンで連続して評価できます</li>
              <li>一時保存した作文は後から再開可能です</li>
              <li>提出後は変更できません（リーダーに連絡してください）</li>
              <li>ログインはGoogleアカウントで行います</li>
              <li>不明点はリーダーにお問い合わせください</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
