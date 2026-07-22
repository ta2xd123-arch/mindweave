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
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured: boolean = !!(supabaseUrl && supabaseKey);

let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = _supabase as SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      '[MINDWEAVE] Supabase가 설정되지 않았습니다.\n' +
      '배포 환경의 서버 전용 Supabase 설정을 확인하세요.'
    );
  }
  return _supabase;
}

/**
 * Request의 Authorization 헤더에서 토큰을 추출하여 유저 정보(Owner 또는 Guest)를 반환합니다.
 */
export async function getAuthUser(request: Request) {
  if (!isSupabaseConfigured) return null; // Mock mode
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  
  if (token.startsWith('guest_')) {
    const rawToken = token.substring(6);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const { data: guest, error } = await supabase
      .from('guest_tokens')
      .select('participant_id, meeting_id, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
      
    if (error || !guest) return null;
    if (guest.revoked_at || new Date(guest.expires_at) < new Date()) return null; // 폐기됨 또는 만료됨
    
    return {
      id: guest.participant_id,
      role: 'guest',
      meeting_id: guest.meeting_id,
      isGuestSession: true,
    };
  } else {
    // Owner or Participant via Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    
    // Check if user is in app_admins
    const { data: adminData } = await supabase
      .from('app_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isOwner = !!adminData;

    return {
      id: user.id,
      email: user.email,
      role: isOwner ? 'owner' : 'guest',
      isGuestSession: false,
    };
  }
}
