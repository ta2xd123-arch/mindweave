-- Create collective_knowledge table
CREATE TABLE IF NOT EXISTS public.collective_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  supporting_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  opposing_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_insight TEXT,
  unresolved_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_note_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_knowledge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.collective_knowledge ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view published knowledge (for direct queries if any)
CREATE POLICY "Anyone can view collective_knowledge"
  ON public.collective_knowledge
  FOR SELECT
  USING (true);

-- Policy: Allow server to manage everything
CREATE POLICY "Server can manage collective_knowledge"
  ON public.collective_knowledge
  FOR ALL
  USING (true);

-- Auto-update trigger for updated_at
CREATE TRIGGER update_collective_knowledge_updated_at
  BEFORE UPDATE ON public.collective_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
