-- Add max_participants column to meetings table with default 20
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 20 NOT NULL;
