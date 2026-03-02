-- Add unique constraint for demo_training_responses so ON CONFLICT works
ALTER TABLE demo_training_responses
  DROP CONSTRAINT IF EXISTS demo_training_responses_attempt_item_unique;

ALTER TABLE demo_training_responses
  ADD CONSTRAINT demo_training_responses_attempt_item_unique
  UNIQUE (attempt_id, item_id);
