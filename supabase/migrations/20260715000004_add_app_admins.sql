-- app_admins 테이블 생성
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'admin' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- 누구나 app_admins 테이블을 조회할 수 있음 (서버 및 클라이언트 인증 시 확인)
CREATE POLICY "Anyone can view app_admins" ON public.app_admins FOR SELECT USING (true);
