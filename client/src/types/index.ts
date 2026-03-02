export interface User {
  id: number;
  loginId: string;
  displayName: string;
  role: 'evaluator' | 'leader';
  email?: string;
  mustChangePassword?: boolean;
}

export interface EvaluationRound {
  id: number;
  name: string;
  phase_type: 'first_only' | 'second_only' | 'both';
  pages_per_essay: number;
  status: string;
  second_evaluator_count: number;
  first_phase_top_count: number;
  total_essay_count: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  is_demo?: boolean;
  essay_count?: number;
  assigned_count?: number;
  completed_count?: number;
}

export interface Essay {
  id: number;
  round_id: number;
  receipt_number: string;
  pdf_path: string;
  student_number: string | null;
  status: string;
  first_phase_score: number | null;
  second_phase_avg: number | null;
  first_evaluator_name?: string;
  second_evaluator_name?: string;
}

export interface Assignment {
  id: number;
  round_id: number;
  essay_id: number;
  user_id: number;
  phase: 'first' | 'second';
  status: 'pending' | 'in_progress' | 'completed';
  deadline?: string;
  receipt_number: string;
  pdf_path: string;
  round_name: string;
  score_id: number | null;
  is_draft: boolean | null;
  first_score: number | null;
  second_total: number | null;
  // Extended fields from getMyAssignments query
  essay_student_number: string | null;
  is_defective: boolean;
  defective_reason: string | null;
  essay_first_score: number | null;
  existing_summary: string | null;
  existing_comment: string | null;
  first_phase_summary: string | null;
  first_student_number: string | null;
}

export interface Score {
  id: number;
  assignment_id: number;
  phase: string;
  score: number | null;
  criteria_scores: CriterionScore[] | null;
  total_score: number | null;
  student_number: string | null;
  summary: string | null;
  comment: string | null;
  is_draft: boolean;
}

export interface CriterionScore {
  criterion: string;
  score: number;
}

export interface Rubric {
  id: number;
  name: string;
  phase: string;
  criteria: any;
  is_template: boolean;
  created_by_name: string;
}

export interface SecondPhaseCriterion {
  name: string;
  description?: string;
  score_min: number;
  score_max: number;
  weight: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AvailabilityEntry {
  date: string;
  capacity: number;
}

export interface ProgressOverview {
  total: number;
  unassigned: number;
  assigned_first: number;
  first_complete: number;
  assigned_second: number;
  second_complete: number;
  leader_hold: number;
}

export interface EvaluatorProgress {
  id: number;
  login_id: string;
  display_name: string;
  first_assigned: number;
  first_completed: number;
  second_assigned: number;
  second_completed: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
