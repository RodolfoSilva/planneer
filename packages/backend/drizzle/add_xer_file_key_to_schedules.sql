-- Add xer_file_key column to schedules table
ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "xer_file_key" text;


