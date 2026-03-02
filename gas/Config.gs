/**
 * Config.gs - 定数・設定
 * デプロイ前に SPREADSHEET_ID, DRIVE_FOLDER_ID, GOOGLE_CLIENT_ID を設定してください
 */

// ===== 環境設定 =====
var CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',       // メインスプレッドシートID
  DRIVE_FOLDER_ID: '16k8vTi4PyNQIaig30qC5ogbCIcqUbxB0',  // PDF格納フォルダID
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',   // OAuth Client ID
  LOCK_DURATION_MIN: 30,       // 評価ロック有効期間（分）
  LOCK_WAIT_MS: 10000,         // LockService 待機時間
  CACHE_TTL_SEC: 21600,        // CacheService TTL (6時間)
  PAGE_SIZE: 50,               // 一覧のデフォルトページサイズ
};

// ===== シート名 =====
var SHEETS = {
  USERS:              'users',
  ROUNDS:             'rounds',
  RUBRICS:            'rubrics',
  ROUND_RUBRICS:      'round_rubrics',
  ESSAYS:             'essays',
  QUEUE_PHASE1:       'queue_phase1',
  QUEUE_PHASE2:       'queue_phase2',
  LOCKS:              'locks',
  ASSIGNMENTS:        'assignments',
  REVIEWS_LOG:        'reviews_log',
  STATUS_VIEW:        'status_view',
  NOTIFICATIONS:      'notifications',
  AVAILABILITY:       'availability',
  TRAININGS:          'trainings',
  TRAINING_ITEMS:     'training_items',
  TRAINING_ATTEMPTS:  'training_attempts',
  TRAINING_RESPONSES: 'training_responses',
  TRAINING_ASSIGNMENTS: 'training_assignments',
  EVENTS_LOG:         'events_log',
};

// ===== シートヘッダー定義 =====
var HEADERS = {
  users: ['id','login_id','display_name','email','role','is_active','created_at','updated_at'],
  rounds: ['id','name','description','phase','status','year','month','created_at','updated_at'],
  rubrics: ['id','name','description','criteria','created_at','updated_at'],
  round_rubrics: ['id','round_id','rubric_id','phase','created_at'],
  essays: ['id','round_id','receipt_number','student_number','pdf_file_id','original_filename','status','defect_reason','defect_comment','first_phase_score','second_phase_score','final_score','created_at','updated_at'],
  queue_phase1: ['essay_id','round_id','added_at'],
  queue_phase2: ['essay_id','round_id','first_phase_score','added_at'],
  locks: ['id','essay_id','lock_token','locked_by','locked_by_name','expires_at','created_at'],
  assignments: ['id','round_id','essay_id','user_id','phase','status','assigned_at','completed_at'],
  reviews_log: ['id','request_id','assignment_id','round_id','essay_id','user_id','phase','score','criteria_scores','comment','submitted_at'],
  status_view: ['essay_id','round_id','receipt_number','status','first_phase_score','first_phase_user','first_phase_completed','second_phase_score','second_phase_user','second_phase_completed','final_score','updated_at'],
  notifications: ['id','user_id','type','title','message','is_read','created_at'],
  availability: ['id','user_id','date','capacity','updated_at'],
  trainings: ['id','round_id','phase','title','description','pass_threshold_count','rubric_id','is_published','created_by','created_at','updated_at'],
  training_items: ['id','training_id','essay_id','pdf_file_id','display_order','correct_score','correct_criteria_scores','tolerance'],
  training_attempts: ['id','training_id','user_id','status','score_percentage','started_at','completed_at'],
  training_responses: ['id','attempt_id','item_id','given_score','given_criteria_scores','is_correct','responded_at'],
  training_assignments: ['id','training_id','user_id','assigned_by','assigned_at'],
  events_log: ['id','user_id','user_name','action','details','created_at'],
};

// ===== ロール定数 =====
var ROLES = {
  LEADER: 'leader',
  EVALUATOR: 'evaluator',
  ADMIN: 'admin',
};

// ===== ステータス定数 =====
var ESSAY_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  SCORED: 'scored',
  DEFECTIVE: 'defective',
  COMPLETED: 'completed',
};

var ASSIGNMENT_STATUS = {
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

var ROUND_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};
