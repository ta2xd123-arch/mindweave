import { NextRequest, NextResponse } from 'next/server';
import { roleLookupResponse, unauthorizedRoleLookupResult } from '@/lib/auth-role';
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase-server';
import { sourceAnalysisConfig } from '@/lib/source-analysis-config';

// GET: Resolve the current Supabase-authenticated user's application role.
// The user ID is derived from the verified bearer token, never from client input.
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 503 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser || authUser.isGuestSession) {
    const result = unauthorizedRoleLookupResult();
    return NextResponse.json(result.body, { status: result.status });
  }

  try {
    const { data: admin, error } = await supabase
      .from('app_admins')
      .select('role')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (error) throw error;
    const isAdmin = Boolean(admin);
    const sourceDocumentsAvailable = sourceAnalysisConfig.documentsEnabled
      && (!sourceAnalysisConfig.documentsAdminOnly || isAdmin);
    return NextResponse.json(roleLookupResponse(isAdmin, sourceDocumentsAvailable));
  } catch (error) {
    console.error('Error resolving application role:', error);
    return NextResponse.json({ error: 'Unable to resolve application role' }, { status: 500 });
  }
}
