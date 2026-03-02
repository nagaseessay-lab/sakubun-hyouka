export interface User {
  id: number;
  login_id: string;
  display_name: string;
  role: 'evaluator' | 'leader';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EvaluationRound {
  id: number;
  name: string;
  phase_type: 'first_only' | 'second_only' | 'both';
  pages_per_essay: number;
  status: RoundStatus;
  second_evaluator_count: number;
  first_phase_top_count: number;
  total_essay_count: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export type RoundStatus =
  | 'draft'
  | 'uploading'
  | 'first_phase'
  | 'first_complete'
  | 'second_phase'
  | 'second_complete'
  | 'archived';

export interface Rubric {
  id: number;
  name: string;
  phase: 'first' | 'second';
  criteria: FirstPhaseCriteria | SecondPhaseCriterion[];
  is_template: boolean;
  created_by: number;
  created_at: Date;
}

export interface FirstPhaseCriteria {
  score_min: number;
  score_max: number;
  char_threshold: number;
  labels: Record<string, string>;
}

export interface SecondPhaseCriterion {
  name: string;
  score_min: number;
  score_max: number;
  weight: number;
}

export interface Essay {
  id: number;
  round_id: number;
  receipt_number: string;
  pdf_path: string;
  original_pdf_id: number | null;
  page_start: number;
  page_end: number;
  student_number: string | null;
  status: EssayStatus;
  first_phase_score: number | null;
  second_phase_avg: number | null;
  created_at: Date;
}

export type EssayStatus =
  | 'unassigned'
  | 'assigned_first'
  | 'first_complete'
  | 'assigned_second'
  | 'second_complete'
  | 'leader_hold';

export interface Assignment {
  id: number;
  round_id: number;
  essay_id: number;
  user_id: number;
  phase: 'first' | 'second';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: Date;
  completed_at: Date | null;
  assigned_by: number | null;
  is_auto: boolean;
}

export interface Score {
  id: number;
  assignment_id: number;
  essay_id: number;
  user_id: number;
  round_id: number;
  phase: 'first' | 'second';
  score: number | null;
  criteria_scores: CriterionScore[] | null;
  total_score: number | null;
  student_number: string | null;
  summary: string | null;
  is_draft: boolean;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CriterionScore {
  criterion: string;
  score: number;
}

export interface Availability {
  id: number;
  user_id: number;
  round_id: number;
  date: Date;
  capacity: number;
}

export interface Notification {
  id: number;
  user_id: number;
  round_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

// Request types
export interface JwtPayload {
  userId: number;
  role: 'evaluator' | 'leader';
  loginId: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
