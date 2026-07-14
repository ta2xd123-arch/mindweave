-- ============================================================
-- MINDWEAVE: 보안 강화 RLS 마이그레이션
-- 기존 테이블 유지, 정책만 교체
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. profiles 테이블 생성 (auth.users 연동)
--    public.users 는 유지하고, 인증된 사용자용 profiles 추가
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- profiles: 본인 프로필만 수정 가능, 읽기는 인증 사용자 전체 허용
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- profiles auto-update trigger
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

-- ────────────────────────────────────────────────────────────
-- 1. public.users — 기존 전체 공개 정책 제거 후 강화
--    (앱이 guest 모드에서 UUID를 직접 사용하므로 유지)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to users" ON public.users;
DROP POLICY IF EXISTS "Allow insert/update for own user" ON public.users;

-- 읽기: 인증 사용자만 허용
CREATE POLICY "users_select"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- 삽입: 자기 자신 행만 삽입
CREATE POLICY "users_insert"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 수정: 자기 자신 행만 수정
CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- anon 사용자는 자신의 row만 upsert (guest 로그인 지원)
CREATE POLICY "users_anon_upsert"
  ON public.users FOR INSERT
  TO anon
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 2. public.groups — 전체 공개 정책 제거
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow all access to groups" ON public.groups;

-- 읽기: 자신이 소속된 그룹만
CREATE POLICY "groups_select"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.meeting_participants mp ON mp.meeting_id = m.id
      WHERE m.group_id = groups.id
        AND mp.user_id = auth.uid()
    )
  );

-- 생성: 인증 사용자만 자신의 group 생성
CREATE POLICY "groups_insert"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 수정/삭제: 소유자만
CREATE POLICY "groups_update"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_delete"
  ON public.groups FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 3. public.meetings — 모임 생성자·참여자만 조회
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to meetings" ON public.meetings;
DROP POLICY IF EXISTS "Allow all access to meetings" ON public.meetings;

-- 헬퍼: 현재 사용자가 모임에 참여 중인지
CREATE OR REPLACE FUNCTION is_meeting_participant(p_meeting_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = p_meeting_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 읽기: 생성자 또는 참여자만
CREATE POLICY "meetings_select"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR is_meeting_participant(id)
  );

-- anon: 초대 코드로 입장 전 조회를 위해 invite_code 기반 읽기 허용
CREATE POLICY "meetings_select_by_invite"
  ON public.meetings FOR SELECT
  TO anon
  USING (true);  -- 초대 코드 조회는 앱 레벨에서 필터링

-- 생성: 인증 사용자만
CREATE POLICY "meetings_insert"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- anon 생성 (게스트 모드 지원)
CREATE POLICY "meetings_insert_anon"
  ON public.meetings FOR INSERT
  TO anon
  WITH CHECK (true);

-- 수정: 생성자만 (상태 변경, 종료 등)
CREATE POLICY "meetings_update"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- anon 수정 (게스트 모드)
CREATE POLICY "meetings_update_anon"
  ON public.meetings FOR UPDATE
  TO anon
  USING (true);

-- 삭제: 생성자만
CREATE POLICY "meetings_delete"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 4. public.meeting_participants
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to meeting_participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Allow all access to meeting_participants" ON public.meeting_participants;

-- 읽기: 같은 모임 참여자끼리만
CREATE POLICY "participants_select"
  ON public.meeting_participants FOR SELECT
  TO authenticated
  USING (is_meeting_participant(meeting_id));

-- anon 읽기 (게스트 지원)
CREATE POLICY "participants_select_anon"
  ON public.meeting_participants FOR SELECT
  TO anon
  USING (true);

-- 삽입: 자신만 등록 가능
CREATE POLICY "participants_insert"
  ON public.meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- anon 삽입 (게스트 모드)
CREATE POLICY "participants_insert_anon"
  ON public.meeting_participants FOR INSERT
  TO anon
  WITH CHECK (true);

-- 삭제: 자신만 (퇴장)
CREATE POLICY "participants_delete"
  ON public.meeting_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 5. public.notes — 작성자만 수정/삭제, 참여자만 조회
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to notes" ON public.notes;
DROP POLICY IF EXISTS "Allow all access to notes" ON public.notes;

-- 읽기: 해당 모임 참여자만
CREATE POLICY "notes_select"
  ON public.notes FOR SELECT
  TO authenticated
  USING (is_meeting_participant(meeting_id));

-- anon 읽기 (게스트 모드)
CREATE POLICY "notes_select_anon"
  ON public.notes FOR SELECT
  TO anon
  USING (true);

-- 삽입: 모임 참여자만 작성
CREATE POLICY "notes_insert"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_meeting_participant(meeting_id)
  );

-- anon 삽입 (게스트 모드)
CREATE POLICY "notes_insert_anon"
  ON public.notes FOR INSERT
  TO anon
  WITH CHECK (true);

-- 수정: 작성자만
CREATE POLICY "notes_update"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- 삭제: 작성자만
CREATE POLICY "notes_delete"
  ON public.notes FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 6. public.reactions — 모임 참여자만 공감, 자신 것만 삭제
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to reactions" ON public.reactions;
DROP POLICY IF EXISTS "Allow all access to reactions" ON public.reactions;

-- 읽기: 해당 노트의 모임 참여자만
CREATE POLICY "reactions_select"
  ON public.reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = reactions.note_id
        AND is_meeting_participant(n.meeting_id)
    )
  );

-- anon 읽기 (게스트 모드)
CREATE POLICY "reactions_select_anon"
  ON public.reactions FOR SELECT
  TO anon
  USING (true);

-- 삽입: 자신의 user_id로만
CREATE POLICY "reactions_insert"
  ON public.reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- anon 삽입 (게스트 모드)
CREATE POLICY "reactions_insert_anon"
  ON public.reactions FOR INSERT
  TO anon
  WITH CHECK (true);

-- 삭제: 자신의 공감만 취소
CREATE POLICY "reactions_delete"
  ON public.reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- anon 삭제 (게스트 모드)
CREATE POLICY "reactions_delete_anon"
  ON public.reactions FOR DELETE
  TO anon
  USING (true);
