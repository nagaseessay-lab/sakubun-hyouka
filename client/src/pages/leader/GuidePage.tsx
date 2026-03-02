export default function GuidePage() {
  return (
    <div>
      <div className="page-header">
        <h1>使い方ガイド</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, color: '#1e3a5f' }}>評価フロー全体像</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          {[
            { label: '1. 評価回作成', color: '#e0e7ff', border: '#6366f1' },
            { label: '2. PDFアップロード', color: '#dbeafe', border: '#3b82f6' },
            { label: '3. デモ研修作成', color: '#f3e8ff', border: '#a855f7' },
            { label: '4. 担当可能数確認', color: '#fef3c7', border: '#f59e0b' },
            { label: '5. 1周目 プレビュー＆振り分け', color: '#dcfce7', border: '#22c55e' },
            { label: '6. 1周目 評価', color: '#dcfce7', border: '#22c55e' },
            { label: '7. 上位昇格', color: '#e0e7ff', border: '#6366f1' },
            { label: '8. 2周目 自動振り分け', color: '#fce7f3', border: '#ec4899' },
            { label: '9. 2周目 評価', color: '#fce7f3', border: '#ec4899' },
            { label: '10. Excel出力', color: '#f1f5f9', border: '#64748b' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                background: step.color, border: `1px solid ${step.border}`,
              }}>
                {step.label}
              </div>
              {i < 9 && <span style={{ color: '#94a3b8', fontSize: 18 }}>&rarr;</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 1: 評価回を作成する</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 評価回管理</p>
            <p>「新規作成」ボタンをクリックし、以下を設定します:</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li><strong>評価回名</strong>: 例「2026年6月1次評価」</li>
              <li><strong>フェーズタイプ</strong>: 「1周目+2周目」が通常</li>
              <li><strong>綴り枚数</strong>: 1作文あたりのPDFページ数（通常2枚）</li>
              <li><strong>2周目評価人数</strong>: 1作文に何人が2周目を評価するか</li>
              <li><strong>上位抽出数</strong>: 1周目上位何件を2周目に昇格するか</li>
              <li><strong>デモ評価回</strong>: チェックを入れると「デモ」バッジが表示され、データがある状態でも削除可能になります</li>
            </ul>
            <p style={{ color: '#64748b', marginTop: 8 }}>
              ※ 通常の評価回は作文が0件なら削除可能です。デモ評価回はデータがあっても削除できます。
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 2: PDFをアップロード</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; PDFアップロード</p>
            <p>評価回を「アップロード中」状態に進めてから:</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>50枚綴りのPDFファイルを<strong>複数同時に</strong>アップロード可能</li>
              <li><strong>ドラッグ＆ドロップ</strong>にも対応しています</li>
              <li>同じファイル名は重複アップロード不可</li>
              <li>自動で綴り枚数ごとに分割し、受付番号（5桁、最大30000件対応）が付与されます</li>
              <li>アップロード済みPDF一覧から取り消し（振り分け前のみ）可能</li>
              <li>「1周目評価中」状態でも追加受付分のPDFを追加可能</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 3: デモ評価研修を作成</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; デモ研修</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>評価者が本番前に練習するためのデモ研修を作成します</li>
              <li><strong>PDFアップロード</strong>でサンプル作文を追加、または既存作文から選択</li>
              <li><strong>ルーブリックなし</strong>の場合: 各問題に正解スコア（0〜4）と許容誤差を設定</li>
              <li><strong>ルーブリックあり</strong>の場合: 観点ごとに正解スコアを設定（ルーブリックの各観点のスコア範囲から選択）</li>
              <li>ルーブリック選択時、問題一覧の表が観点ごとの列に変わり、各観点の正解スコアをドロップダウンで個別に変更できます</li>
              <li><strong>合格正答数</strong>を設定します（例: 5問中3問正解で合格）</li>
              <li>合格するまで何度でも再受講可能です</li>
              <li>「修了者一覧」タブで受講状況と合格率を確認できます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 4: 評価者の担当可能数確認</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 担当可能数一覧</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>評価者とリーダー全員の担当可能数を一覧で確認</li>
              <li>日別・人別の棒グラフで視覚的に把握</li>
              <li>表で各評価者のIDと容量を確認できます</li>
              <li>リーダー自身も評価者として参加可能です</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 5-6: 1周目の振り分けと評価</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 振り分け管理</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li><strong>プレビュー → 件数調整 → 確定</strong>の3ステップで振り分けます</li>
              <li>「プレビュー」で各評価者への配分数を確認し、件数を手動調整できます</li>
              <li>プレビュー画面で<strong>提出期限</strong>（日付）を一括指定できます</li>
              <li>プレビュー画面の「<strong>詳細一覧を表示</strong>」ボタンで、どの作文がどの評価者に割り当てられるかを一覧で確認できます</li>
              <li>詳細一覧では各行の<strong>評価者をドロップダウンで個別変更</strong>してから確定できます</li>
              <li>「手動割り当て」で特定の作文を特定の評価者に割り当て可能。<strong>カンマ・改行区切りで複数の受付番号</strong>を一度に指定できます</li>
              <li><strong>担当変更</strong>は評価中・完了済みの割り当てでも可能です（強制変更オプション）</li>
              <li>強制変更時は既存のスコアが削除され、確認ダイアログが表示されます</li>
              <li>評価者キャパシティの使用状況がバーグラフで確認できます</li>
              <li>評価者別の割り当てリストは<strong>10件を超える場合は折りたたみ</strong>表示。クリックで全件を展開、「すべて展開/折りたたむ」で一括操作も可能です</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>受付答案一覧の使い方</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 受付答案一覧</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>全作文の状態・担当者・スコアを一覧表示</li>
              <li>受付番号・生徒番号で<strong>カンマ区切り検索</strong>が可能</li>
              <li>状態フィルタ、スコア範囲フィルタ、並び替えに対応</li>
              <li>「振分」ボタンで個別の手動振り分け（フェーズ・評価者選択）</li>
              <li><strong>強制変更チェック</strong>で既存スコア削除・再割当が可能</li>
              <li>「状態」ボタンで強制的に状態を変更できます</li>
              <li>PDFプレビューをポップアップ表示</li>
              <li>2周目評価者が複数いる場合は<strong>評価者ごとに別カラム</strong>で表示されます</li>
              <li><strong>CSV出力</strong>: 現在のフィルタ条件でCSVファイルをダウンロード（Excel対応のBOM付きUTF-8）</li>
              <li><strong>一括状態変更</strong>: 受付番号/生徒番号をカンマ区切りで指定し、複数作文の状態を一度に変更できます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>一括移動</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> 受付答案一覧 &rarr; 「一括移動」ボタン</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>受付番号または生徒番号を<strong>カンマ区切り・改行区切り</strong>で入力</li>
              <li>まず受付番号として検索し、見つからなければ生徒番号として検索します</li>
              <li>指定した評価者にまとめて振り分けを変更できます</li>
              <li>フェーズ選択（1周目/2周目）と提出期限の設定も可能</li>
              <li><strong>強制変更チェック</strong>を入れると既存スコアを削除して再割当します</li>
              <li>実行結果で成功件数・失敗件数（エラー詳細）が表示されます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>不備答案とリーダー保留</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>評価者が「不備答案」チェックをして提出すると<strong>リーダー保留</strong>状態になります</li>
              <li>白紙、判読不能、枚数不足などの理由が記録されます</li>
              <li>受付答案一覧で「保留」バッジが表示されるので、リーダーが確認・対応します</li>
              <li>受付答案一覧からステータスを変更して再割り当て等の対応ができます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 7-9: 上位昇格と2周目評価</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p>1周目完了後:</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>上位作文を2周目に自動昇格</li>
              <li>2周目は<strong>ルーブリック</strong>（多観点採点基準）を使って評価</li>
              <li>ルーブリック管理でテンプレートの作成・編集・複製が可能（1周目・2周目両方に対応）</li>
              <li>1周目の評価者とは別の評価者が担当（重複回避）</li>
              <li>2周目の振り分けも自動・手動で対応可能</li>
              <li>2周目では1周目の生徒番号・概要・スコアが参考表示されます</li>
              <li>2周目の評価者数制限は<strong>強制変更</strong>オプションで解除できます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>Step 10: Excel出力</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; Excel出力</p>
            <p>2つのタブがあります:</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li><strong>評価回別出力</strong>: 4シート構成のExcel
                <ul style={{ paddingLeft: 16, marginTop: 2 }}>
                  <li>1次採点結果（受付番号、生徒番号、スコア、評価者ID・名前、所見）</li>
                  <li>2次採点結果（多観点スコア、評価者別の詳細）</li>
                  <li>ランキング（総合スコア順位）</li>
                  <li>採点者集計（評価者ごとの担当数・完了数 ※リーダー含む）</li>
                </ul>
              </li>
              <li><strong>評価者別実績出力</strong>: 期間・評価回で絞り込み、評価者ごとの1周目/2周目件数をExcel出力</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>通知機能</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>サイドバーの「通知」リンクに<strong>未読件数バッジ</strong>（赤丸）が表示されます</li>
              <li>バッジは30秒ごとに自動更新されます</li>
              <li>振り分けが行われるとメッセージが届きます</li>
              <li>通知一覧から既読・未読の切り替えが可能です</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>状態管理について</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p>評価回の状態遷移:</p>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 2 }}>
              下書き &rarr; アップロード中 &rarr; 1周目評価中 &rarr; 1周目完了<br />
              &rarr; 2周目評価中 &rarr; 2周目完了 &rarr; アーカイブ
            </div>
            <p style={{ marginTop: 8 }}>
              ※ イレギュラーとして状態を前に戻すこともできます（「戻す」ボタン）
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>ユーザー管理</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; ユーザー管理</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>ユーザーはGoogleアカウント（メールアドレス）でログインします</li>
              <li>登録時にGoogleアカウントのメールアドレスの紐付けが必要です</li>
              <li>CSV一括登録が可能（形式: ログインID,名前,メールアドレス,権限）</li>
              <li>同じログインID・メールアドレスの重複登録はできません</li>
              <li>各種画面で<strong>6桁ID</strong>が名前と一緒に表示されます</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1e3a5f' }}>進捗確認</h3>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
            <p><strong>場所:</strong> サイドバー &rarr; 進捗・グラフ</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>全体の進捗状況をステータス別に確認</li>
              <li>評価者別の進捗を棒グラフで視覚化</li>
              <li>1周目・2周目の担当数・完了数が一目でわかります</li>
              <li>リーダーの進捗も表示されます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
