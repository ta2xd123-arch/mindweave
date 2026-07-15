-- MINDWEAVE: 3단계 인증/권한 간소화 (게스트 세션 및 AI 상태)

-- 1. ai_reports 에 status, published_at 추가
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' NOT NULL;
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. guest_tokens 테이블 생성
CREATE TABLE IF NOT EXISTS public.guest_tokens (
  token_hash TEXT PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- RLS: guest_tokens는 서버(서비스 키)에서만 관리
ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;

-- 3. 기존 RLS 수정
-- meetings: 참여자(게스트)도 조회 가능, 소유자(creator)는 수정/삭제 가능.
-- notes: 작성자만 수정, 다른 참여자는 조회만 가능.

-- ai_reports: draft는 소유자만 조회. published는 참여자 전체 조회.
DROP POLICY IF EXISTS "ai_reports_select" ON public.ai_reports;
CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT USING (
  created_by = auth.uid() OR 
  (status = 'published' AND EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = ai_reports.meeting_id AND mp.user_id = auth.uid()))
);
