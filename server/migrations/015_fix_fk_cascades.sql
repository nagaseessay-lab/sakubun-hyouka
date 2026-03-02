-- ============================================
-- Fix foreign key constraints: add CASCADE / SET NULL
-- ============================================

-- 1. round_rubrics.rubric_id → rubrics(id) ON DELETE CASCADE
ALTER TABLE round_rubrics DROP CONSTRAINT IF EXISTS round_rubrics_rubric_id_fkey;
ALTER TABLE round_rubrics ADD CONSTRAINT round_rubrics_rubric_id_fkey
  FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE;

-- 2. assignments.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_round_id_fkey;
ALTER TABLE assignments ADD CONSTRAINT assignments_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 3. assignments.essay_id → essays(id) ON DELETE CASCADE
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_essay_id_fkey;
ALTER TABLE assignments ADD CONSTRAINT assignments_essay_id_fkey
  FOREIGN KEY (essay_id) REFERENCES essays(id) ON DELETE CASCADE;

-- 4. scores.essay_id → essays(id) ON DELETE CASCADE
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_essay_id_fkey;
ALTER TABLE scores ADD CONSTRAINT scores_essay_id_fkey
  FOREIGN KEY (essay_id) REFERENCES essays(id) ON DELETE CASCADE;

-- 5. scores.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_round_id_fkey;
ALTER TABLE scores ADD CONSTRAINT scores_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 6. scores.user_id → users(id) ON DELETE CASCADE
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_user_id_fkey;
ALTER TABLE scores ADD CONSTRAINT scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 7. uploaded_pdfs.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE uploaded_pdfs DROP CONSTRAINT IF EXISTS uploaded_pdfs_round_id_fkey;
ALTER TABLE uploaded_pdfs ADD CONSTRAINT uploaded_pdfs_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 8. essays.original_pdf_id → uploaded_pdfs(id) ON DELETE SET NULL
ALTER TABLE essays DROP CONSTRAINT IF EXISTS essays_original_pdf_id_fkey;
ALTER TABLE essays ADD CONSTRAINT essays_original_pdf_id_fkey
  FOREIGN KEY (original_pdf_id) REFERENCES uploaded_pdfs(id) ON DELETE SET NULL;

-- 9. availability.user_id → users(id) ON DELETE CASCADE
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_user_id_fkey;
ALTER TABLE availability ADD CONSTRAINT availability_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 10. availability.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_round_id_fkey;
ALTER TABLE availability ADD CONSTRAINT availability_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 11. notifications.user_id → users(id) ON DELETE CASCADE
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 12. notifications.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_round_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 13. demo_trainings.round_id → evaluation_rounds(id) ON DELETE CASCADE
ALTER TABLE demo_trainings DROP CONSTRAINT IF EXISTS demo_trainings_round_id_fkey;
ALTER TABLE demo_trainings ADD CONSTRAINT demo_trainings_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

-- 14. demo_training_items.essay_id → essays(id) ON DELETE SET NULL
ALTER TABLE demo_training_items DROP CONSTRAINT IF EXISTS demo_training_items_essay_id_fkey;
ALTER TABLE demo_training_items ADD CONSTRAINT demo_training_items_essay_id_fkey
  FOREIGN KEY (essay_id) REFERENCES essays(id) ON DELETE SET NULL;

-- 15. demo_training_attempts.user_id → users(id) ON DELETE CASCADE
ALTER TABLE demo_training_attempts DROP CONSTRAINT IF EXISTS demo_training_attempts_user_id_fkey;
ALTER TABLE demo_training_attempts ADD CONSTRAINT demo_training_attempts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 16. assignments.user_id → users(id) ON DELETE CASCADE
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_user_id_fkey;
ALTER TABLE assignments ADD CONSTRAINT assignments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 17. created_by / uploaded_by / assigned_by → users(id) ON DELETE SET NULL
ALTER TABLE evaluation_rounds DROP CONSTRAINT IF EXISTS evaluation_rounds_created_by_fkey;
ALTER TABLE evaluation_rounds ADD CONSTRAINT evaluation_rounds_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE rubrics DROP CONSTRAINT IF EXISTS rubrics_created_by_fkey;
ALTER TABLE rubrics ADD CONSTRAINT rubrics_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE uploaded_pdfs DROP CONSTRAINT IF EXISTS uploaded_pdfs_uploaded_by_fkey;
ALTER TABLE uploaded_pdfs ADD CONSTRAINT uploaded_pdfs_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE demo_trainings DROP CONSTRAINT IF EXISTS demo_trainings_created_by_fkey;
ALTER TABLE demo_trainings ADD CONSTRAINT demo_trainings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_assigned_by_fkey;
ALTER TABLE assignments ADD CONSTRAINT assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
