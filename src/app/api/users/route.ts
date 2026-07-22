import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

// POST: Create or update a user (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      // Mock success if no DB
      return NextResponse.json({ user: { id: 'mock-user', name } }, { status: 200 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = authUser.id;

    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: name,
        email: authUser.email || `${userId.slice(0, 8)}@guest.mindweave.io`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error upserting user:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
