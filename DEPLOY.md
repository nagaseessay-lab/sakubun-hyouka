# デプロイ手順書

## アーキテクチャ概要

```
[評価者ブラウザ]  ──→  [Netlify] React SPA (静的配信)
       │
       │ POST { action, ..., _idToken }
       ▼
[GAS Web App]  doPost() ── JSON API ルーター
       │          ↑ デプロイ: 実行者=自分 / アクセス=全員
       │          │ _idToken → Google tokeninfo で検証
       ▼
[Google Sheets]  全データ
[Google Drive]   PDF ファイル
```

---

## 1. Google Cloud Console セットアップ

### 1.1 プロジェクト作成
1. https://console.cloud.google.com/ にアクセス
2. 新規プロジェクトを作成（例: `sakubun-hyouka`）

### 1.2 API 有効化
1. 「APIとサービス」→「APIを有効にする」
2. 以下を有効化:
   - Google Sheets API
   - Google Drive API

### 1.3 OAuth 2.0 クライアントID 作成
1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリケーションの種類: **ウェブアプリケーション**
3. 承認済みの JavaScript オリジン:
   - `http://localhost:5173`（開発用）
   - `https://your-app.netlify.app`（本番用）
4. 作成されたクライアントID をメモ（`VITE_GOOGLE_CLIENT_ID`として使用）

### 1.4 OAuth 同意画面
1. 「OAuth同意画面」を設定
2. ユーザータイプ: **内部**（組織内のみの場合）または **外部**
3. アプリ名、サポートメール等を入力
4. スコープ: `email`, `profile`, `openid`

---

## 2. Google Spreadsheet セットアップ

### 2.1 スプレッドシート作成
1. Google Drive で新規スプレッドシートを作成
2. スプレッドシートのURLからIDを取得:
   `https://docs.google.com/spreadsheets/d/【このIDをコピー】/edit`

### 2.2 シート作成
GAS の `admin.setupSheets` APIを実行するか、手動で以下のシートを作成:

| シート名 | 用途 |
|----------|------|
| users | ユーザー管理 |
| rounds | 評価回マスタ |
| rubrics | ルーブリック定義 |
| round_rubrics | 評価回×ルーブリック紐付け |
| essays | 作文マスタ |
| queue_phase1 | 1周目キュー |
| queue_phase2 | 2周目キュー |
| locks | 評価中ロック |
| assignments | 割当記録 |
| reviews_log | 評価ログ |
| status_view | 集計ビュー |
| notifications | 通知 |
| availability | 担当可能数 |
| trainings | 研修マスタ |
| training_items | 研修問題 |
| training_attempts | 研修受講記録 |
| training_responses | 研修回答 |
| events_log | 操作ログ |

### 2.3 権限設定
- スプレッドシートの共有は**不要**（GASは「実行者=自分」設定で動作）
- 管理目的で直接確認したい場合のみ、リーダーに「閲覧者」権限を付与

---

## 3. Google Drive セットアップ

### 3.1 PDF保存フォルダ
1. Google Drive でフォルダを作成（既存: `16k8vTi4PyNQIaig30qC5ogbCIcqUbxB0`）
2. 評価回ごとにサブフォルダを作成推奨
3. フォルダIDをメモ

### 3.2 権限設定
- 評価者全員に「**閲覧者**」権限を付与（PDFプレビュー用）

---

## 4. Apps Script デプロイ

### 4.1 スクリプト作成
1. スプレッドシートのメニュー →「拡張機能」→「Apps Script」
2. 以下の `.gs` ファイルをすべてコピー:

```
gas/
├── Code.gs
├── Auth.gs
├── Config.gs
├── SheetHelper.gs
├── UserApi.gs
├── RoundApi.gs
├── EssayApi.gs
├── AssignmentApi.gs
├── ScoreApi.gs
├── RubricApi.gs
├── AvailabilityApi.gs
├── NotificationApi.gs
├── TrainingApi.gs
├── ExportApi.gs
└── AdminApi.gs
```

### 4.2 Config.gs の設定

`Config.gs` の `CONFIG` オブジェクトを実際の値に更新:

```javascript
var CONFIG = {
  SPREADSHEET_ID: '【スプレッドシートID】',
  DRIVE_FOLDER_ID: '【DriveフォルダID】',
  GOOGLE_CLIENT_ID: '【OAuth クライアントID】',
  LOCK_WAIT_MS: 10000,
  LOCK_EXPIRE_MINUTES: 30,
  CACHE_TTL_SECONDS: 21600,
  PAGE_SIZE: 50,
};
```

### 4.3 Web App デプロイ
1. Apps Script エディタ →「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 説明: バージョン説明を入力
4. **実行者: 自分**（※「自分」を選択。認証はリクエスト内のGoogle IDトークンで行う）
5. **アクセスできるユーザー: 全員**（認証は GAS 内部で行う）
6. 「デプロイ」をクリック
7. デプロイURLをメモ（`VITE_GAS_URL` として使用）

### 4.4 初期データ投入

Apps Script エディタのコンソールまたはAPIから実行:

```javascript
// 1. シート初期作成
handleAdminSetupSheets({}, { id: 0, display_name: 'Admin', role: 'admin' });

// 2. 初期ユーザー追加（usersシートに直接記入でもOK）
// id, login_id, display_name, email, role, is_active, created_at
// 1, leader01, リーダー太郎, leader@example.com, leader, true, 2024-01-01T00:00:00.000Z
```

### 4.5 定期実行トリガー設定
1. Apps Script → 左メニュー「トリガー」
2. 「トリガーを追加」:
   - 関数: `scheduledCleanExpiredLocks`
   - イベントソース: 時間主導型
   - 時間ベースのトリガー: 分タイマー → 10分ごと

---

## 5. Netlify デプロイ

### 5.1 環境変数設定

`.env` ファイルを作成（`client/.env`）:

```
VITE_GAS_URL=https://script.google.com/macros/s/xxxxxxxxxx/exec
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

### 5.2 ローカルビルドテスト

```bash
cd client
npm install
npm run build
npm run preview
```

### 5.3 Netlify CLIデプロイ

```bash
# Netlify CLI インストール
npm install -g netlify-cli

# ログイン
netlify login

# サイト作成 & デプロイ
cd client
netlify deploy --prod --dir=dist
```

### 5.4 Netlify ダッシュボードデプロイ（Git連携）

1. https://app.netlify.com/ にログイン
2. 「Add new site」→「Import an existing project」
3. GitHubリポジトリを選択
4. ビルド設定:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `client/dist`
5. 環境変数を設定:
   - `VITE_GAS_URL`
   - `VITE_GOOGLE_CLIENT_ID`
6. デプロイ

### 5.5 カスタムドメイン設定（任意）
1. Netlifyダッシュボード → Domain settings
2. カスタムドメインを追加
3. DNS設定（CNAMEレコード）
4. SSL証明書は自動発行

---

## 6. デプロイ後の確認

### 6.1 基本動作確認
- [ ] ログインページが表示される
- [ ] Googleログインが動作する
- [ ] ログイン後にダッシュボードが表示される
- [ ] サイドバーの通知件数が更新される

### 6.2 リーダー機能確認
- [ ] 評価回の作成・編集
- [ ] ルーブリックの作成・編集
- [ ] PDFアップロード
- [ ] 自動割当プレビュー・実行
- [ ] 進捗確認
- [ ] Excel（CSV）出力
- [ ] ユーザー管理
- [ ] 不備答案管理
- [ ] デモ評価研修の作成

### 6.3 評価者機能確認
- [ ] マイ担当一覧の表示
- [ ] 評価画面でPDF表示
- [ ] スコア入力・一時保存
- [ ] 提出
- [ ] 担当可能数の登録
- [ ] 通知の確認
- [ ] デモ評価研修の受講

### 6.4 同時アクセステスト
- [ ] 複数タブで同時にnextを実行 → 別々の作文が割り当てられる
- [ ] 同一作文に二重提出 → 冪等性で重複なし

---

## 7. GAS 更新手順

コード修正後の再デプロイ:

1. Apps Script エディタでコードを更新
2. 「デプロイ」→「デプロイを管理」
3. 既存デプロイの鉛筆アイコン →「新しいバージョン」を選択
4. 「デプロイ」をクリック

**注意**: URLは変わらない（同じデプロイIDを更新する場合）

---

## 8. トラブルシューティング

### GAS の実行時間超過（6分制限）
- 大量データ操作は分割実行
- `CacheService` を活用して読み込みを減らす

### 同時実行制限
- 「実行者 = 自分」設定のため、デプロイ者のアカウントに30同時実行の制限がある
- 各API呼び出しは通常1-5秒で完了するため、秒間6-30リクエストを処理可能
- Google Workspace アカウントの場合、より高い制限が適用される場合がある
- ピーク時に制限に達した場合、フロントエンドの自動リトライ（指数バックオフ）で対応

### CORS エラー
- GAS Web App はCORSヘッダーを自動設定
- `Content-Type: text/plain` を使用（preflight回避）

### ログイン失敗
- Google Cloud Console でOAuth クライアントIDの設定を確認
- 承認済みJavaScriptオリジンにNETLIFYのURLが含まれているか確認
- `users` シートにユーザーのメールアドレスが登録されているか確認

### PDF が表示されない
- Google Drive フォルダの共有設定を確認
- 評価者に閲覧権限があるか確認
- `essays` シートの `file_id` が正しいか確認
