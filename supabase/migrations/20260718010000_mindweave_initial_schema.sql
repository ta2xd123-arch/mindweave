-- MINDWEAVE dedicated Supabase project only.
-- Do not run this file against the shared Pattern project or an existing MINDWEAVE database.
-- This replaces the legacy migration chain and intentionally does not use setup_all.sql.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  topic text NOT NULL CHECK (length(btrim(topic)) > 0),
  description text,
  meeting_date timestamptz NOT NULL DEFAULT now(),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9]{6}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  max_participants integer NOT NULL DEFAULT 20 CHECK (max_participants > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_participants (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_participants_meeting_user_key UNIQUE (meeting_id, user_id)
);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (length(btrim(author_name)) > 0),
  note_type text NOT NULL DEFAULT 'thought' CHECK (
    note_type IN ('thought', 'question', 'impression', 'opposite', 'idea', 'action', 'decision', 'reference')
  ),
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name text NOT NULL CHECK (length(btrim(user_name)) > 0),
  reaction_type text NOT NULL DEFAULT 'like' CHECK (reaction_type = 'like'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reactions_note_user_type_key UNIQUE (note_id, user_id, reaction_type)
);

CREATE TABLE public.guest_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  participant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_tokens_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE TABLE public.collective_knowledge (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  conclusion text NOT NULL CHECK (length(btrim(conclusion)) > 0),
  supporting_ideas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(supporting_ideas) = 'array'),
  opposing_ideas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(opposing_ideas) = 'array'),
  new_insight text NOT NULL DEFAULT '',
  unresolved_questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(unresolved_questions) = 'array'),
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(action_items) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collective_knowledge_meeting_key UNIQUE (meeting_id)
);

CREATE INDEX meetings_created_by_created_at_idx
  ON public.meetings (created_by, created_at DESC);
CREATE INDEX meeting_participants_user_id_meeting_id_idx
  ON public.meeting_participants (user_id, meeting_id);
CREATE INDEX notes_meeting_id_created_at_idx
  ON public.notes (meeting_id, created_at ASC);
CREATE INDEX reactions_note_id_idx
  ON public.reactions (note_id);
CREATE INDEX guest_tokens_meeting_id_idx
  ON public.guest_tokens (meeting_id);
CREATE INDEX collective_knowledge_meeting_status_created_at_idx
  ON public.collective_knowledge (meeting_id, status, created_at DESC);

CREATE FUNCTION public.mindweave_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mindweave_notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.mindweave_set_updated_at();

CREATE TRIGGER mindweave_collective_knowledge_set_updated_at
  BEFORE UPDATE ON public.collective_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.mindweave_set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_knowledge ENABLE ROW LEVEL SECURITY;

-- Direct anon/authenticated PostgREST access is intentionally denied. The
-- server-only service-role client bypasses RLS after it validates the session
-- and meeting ownership in Next.js API routes.
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_admins FROM anon, authenticated;
REVOKE ALL ON TABLE public.meetings FROM anon, authenticated;
REVOKE ALL ON TABLE public.meeting_participants FROM anon, authenticated;
REVOKE ALL ON TABLE public.notes FROM anon, authenticated;
REVOKE ALL ON TABLE public.reactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.guest_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.collective_knowledge FROM anon, authenticated;

COMMIT;
