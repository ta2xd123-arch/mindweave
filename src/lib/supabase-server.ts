/**
 * ⚠️  서버 전용 Supabase 클라이언트
 *
 * 이 모듈은 Next.js API 라우트 및 서버 컴포넌트에서만 사용할 수 있습니다.
 * 클라이언트 컴포넌트('use client')에서 import 하면 빌드 오류가 발생합니다.
 *
 * 이유:
 * - Supabase URL과 anon 키는 NEXT_PUBLIC_ 이지만 클라이언트에서 직접
 *   Supabase를 호출하면 RLS 우회 위험과 보안 감사 복잡도가 높아집니다.
 * - 모든 데이터 접근을 서버 API 라우트를 통해 중앙화하면 보안 정책을
 *   한 곳에서 관리할 수 있습니다.
 */
import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase 설정 여부 플래그
 * API 라우트에서 Mock 모드 분기에 사용
 */
export const isSupabaseConfigured: boolean = !!(supabaseUrl && supabaseKey);

/**
 * 서버 전용 Supabase 클라이언트 인스턴스
 * 미설정 상태에서 사용하면 런타임 오류 발생
 */
let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      // 서버 사이드에서는 자동 세션 갱신 불필요
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = _supabase as SupabaseClient;

/**
 * Supabase 클라이언트를 반환하거나, 미설정 시 명확한 오류를 던집니다.
 * API 라우트에서 isSupabaseConfigured 분기 없이 안전하게 사용 가능합니다.
 *
 * @example
 * const db = getSupabase();
 * const { data } = await db.from('meetings').select('*');
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      '[MINDWEAVE] Supabase가 설정되지 않았습니다.\n' +
      '.env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가하세요.'
    );
  }
  return _supabase;
}
