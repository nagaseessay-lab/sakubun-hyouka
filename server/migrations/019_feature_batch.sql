-- Phase 2: Training pass threshold by correct count instead of percentage
ALTER TABLE demo_trainings ADD COLUMN IF NOT EXISTS pass_threshold_count INTEGER DEFAULT 3;
UPDATE demo_trainings SET pass_threshold_count = GREATEST(1, ROUND(pass_threshold / 100.0 *
  COALESCE((SELECT COUNT(*) FROM demo_training_items WHERE training_id = demo_trainings.id), 5)))
WHERE pass_threshold_count IS NULL OR pass_threshold_count = 3;

-- Phase 3: Demo round flag
ALTER TABLE evaluation_rounds ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Phase 4: Assignment deadline
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deadline DATE;
