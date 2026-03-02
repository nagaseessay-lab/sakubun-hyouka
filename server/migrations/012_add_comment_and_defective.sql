-- Add comment field to scores
ALTER TABLE scores ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add defective essay flag to essays
ALTER TABLE essays ADD COLUMN IF NOT EXISTS is_defective BOOLEAN DEFAULT FALSE;
ALTER TABLE essays ADD COLUMN IF NOT EXISTS defective_reason TEXT;

-- Add leader_hold status to essays
-- Update the check constraint to allow 'leader_hold'
ALTER TABLE essays DROP CONSTRAINT IF EXISTS essays_status_check;
ALTER TABLE essays ADD CONSTRAINT essays_status_check
  CHECK (status IN ('unassigned', 'assigned_first', 'first_complete',
                    'assigned_second', 'second_complete', 'leader_hold'));
