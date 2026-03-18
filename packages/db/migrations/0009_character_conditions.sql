ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "conditions" jsonb NOT NULL DEFAULT '[]';
