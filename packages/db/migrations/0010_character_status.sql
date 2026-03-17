ALTER TABLE characters ADD COLUMN status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('draft', 'complete'));
