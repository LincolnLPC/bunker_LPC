-- Add vote_weight column to votes table for double vote support
ALTER TABLE votes ADD COLUMN IF NOT EXISTS vote_weight INTEGER DEFAULT 1;

-- Update existing votes to have weight 1
UPDATE votes SET vote_weight = 1 WHERE vote_weight IS NULL;
