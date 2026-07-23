-- MINDWEAVE only. Do not apply to Pattern or any production project until reviewed.
BEGIN;

CREATE TABLE public.source_documents (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  author text NOT NULL DEFAULT '',
  source_name text NOT NULL DEFAULT '',
  source_url text,
  published_at date,
  document_type text NOT NULL DEFAULT 'other' CHECK (document_type IN ('paper','report','article','research','other')),
  input_type text NOT NULL CHECK (input_type IN ('text','pdf','url')),
  raw_text text NOT NULL CHECK (length(raw_text) BETWEEN 1 AND 100000),
  content_hash text NOT NULL,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(locations) = 'array'),
  analysis_status text NOT NULL DEFAULT 'stored' CHECK (analysis_status IN ('stored','analyzing','complete','failed')),
  analysis_error text,
  analysis_started_at timestamptz,
  analysis_attempt_count integer NOT NULL DEFAULT 0 CHECK (analysis_attempt_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_documents_owner_hash_key UNIQUE (owner_id, content_hash)
);

CREATE TABLE public.knowledge_cards (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_document_id uuid NOT NULL UNIQUE REFERENCES public.source_documents(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  core_claims jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(core_claims) = 'array'),
  key_evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(key_evidence) = 'array'),
  research_findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(research_findings) = 'array'),
  conclusion text NOT NULL DEFAULT '',
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(limitations) = 'array'),
  important_concepts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(important_concepts) = 'array'),
  common_with_existing jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(common_with_existing) = 'array'),
  different_from_existing jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(different_from_existing) = 'array'),
  new_questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(new_questions) = 'array'),
  action_ideas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(action_ideas) = 'array'),
  evidence_locations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_locations) = 'array'),
  model_name text NOT NULL,
  chunk_model_name text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  visibility text NOT NULL DEFAULT 'owner' CHECK (visibility IN ('owner','participants')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.source_analysis_chunks (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index > 0),
  chunk_hash text NOT NULL,
  model_name text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  input_char_count integer NOT NULL CHECK (input_char_count >= 0),
  output_char_count integer NOT NULL CHECK (output_char_count >= 0),
  input_token_count integer,
  output_token_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_analysis_chunks_reuse_key UNIQUE (
    source_document_id, chunk_index, chunk_hash, model_name, prompt_version, schema_version
  )
);

CREATE TABLE public.source_analysis_usage (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('source_document_analysis')),
  input_char_count integer NOT NULL DEFAULT 0 CHECK (input_char_count >= 0),
  output_char_count integer NOT NULL DEFAULT 0 CHECK (output_char_count >= 0),
  input_token_count integer,
  output_token_count integer,
  chunk_count integer NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  duration_ms integer CHECK (duration_ms >= 0),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','succeeded','failed')),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX source_documents_owner_created_idx ON public.source_documents(owner_id, created_at DESC);
CREATE INDEX source_documents_meeting_idx ON public.source_documents(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX knowledge_cards_owner_created_idx ON public.knowledge_cards(owner_id, created_at DESC);
CREATE INDEX source_analysis_usage_owner_created_idx ON public.source_analysis_usage(owner_id, created_at DESC);
CREATE INDEX source_analysis_chunks_document_idx ON public.source_analysis_chunks(source_document_id, chunk_index);

ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_analysis_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_analysis_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.source_documents, public.knowledge_cards, public.source_analysis_chunks, public.source_analysis_usage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_documents, public.knowledge_cards, public.source_analysis_chunks, public.source_analysis_usage TO service_role;

CREATE TRIGGER mindweave_source_documents_set_updated_at BEFORE UPDATE ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.mindweave_set_updated_at();
CREATE TRIGGER mindweave_knowledge_cards_set_updated_at BEFORE UPDATE ON public.knowledge_cards
  FOR EACH ROW EXECUTE FUNCTION public.mindweave_set_updated_at();

CREATE OR REPLACE FUNCTION public.source_analysis_seoul_day_start(
  p_at timestamptz DEFAULT now()
)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public, extensions
AS $$
  SELECT date_trunc('day', p_at AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
$$;
REVOKE ALL ON FUNCTION public.source_analysis_seoul_day_start(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.source_analysis_seoul_day_start(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.source_analysis_daily_usage_count(
  p_owner_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT count(*)::integer
  FROM public.source_analysis_usage
  WHERE owner_id = p_owner_id
    AND created_at >= public.source_analysis_seoul_day_start(p_at)
    AND created_at < public.source_analysis_seoul_day_start(p_at) + interval '1 day';
$$;
REVOKE ALL ON FUNCTION public.source_analysis_daily_usage_count(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.source_analysis_daily_usage_count(uuid,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_source_document_analysis(
  p_document_id uuid,
  p_owner_id uuid,
  p_daily_limit integer,
  p_max_attempts integer,
  p_model_name text,
  p_input_char_count integer,
  p_chunk_count integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_attempt integer;
  v_usage_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 0));
  IF (
    SELECT count(*) FROM public.source_analysis_usage
    WHERE owner_id = p_owner_id
      AND created_at >= public.source_analysis_seoul_day_start(now())
      AND created_at < public.source_analysis_seoul_day_start(now()) + interval '1 day'
  ) >= p_daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT';
  END IF;

  UPDATE public.source_documents
     SET analysis_status = 'analyzing',
         analysis_error = NULL,
         analysis_started_at = now(),
         analysis_attempt_count = analysis_attempt_count + 1
   WHERE id = p_document_id
     AND owner_id = p_owner_id
     AND analysis_attempt_count < p_max_attempts
     AND (analysis_status <> 'analyzing' OR analysis_started_at IS NULL OR analysis_started_at < now() - interval '10 minutes')
   RETURNING analysis_attempt_count INTO v_attempt;

  IF v_attempt IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.source_documents
      WHERE id = p_document_id AND owner_id = p_owner_id AND analysis_attempt_count >= p_max_attempts
    ) THEN
      RAISE EXCEPTION 'RETRY_LIMIT';
    END IF;
    RAISE EXCEPTION 'ANALYSIS_BUSY';
  END IF;

  INSERT INTO public.source_analysis_usage (
    source_document_id, owner_id, model_name, request_type,
    input_char_count, chunk_count, attempt_count
  ) VALUES (
    p_document_id, p_owner_id, p_model_name, 'source_document_analysis',
    p_input_char_count, p_chunk_count, v_attempt
  ) RETURNING id INTO v_usage_id;
  RETURN v_usage_id;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_source_document_analysis(uuid,uuid,integer,integer,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_source_document_analysis(uuid,uuid,integer,integer,text,integer,integer) TO service_role;

COMMIT;
