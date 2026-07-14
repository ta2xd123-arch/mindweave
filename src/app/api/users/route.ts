import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// POST: Create or update a user (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, email } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'userId and name are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      // Mock success if no DB
      return NextResponse.json({ user: { id: userId, name, email } }, { status: 200 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: name,
        email: email || `${userId.slice(0, 8)}@guest.mindweave.io`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user }, { status: 200 });
  } catch (error: any) {
    console.error('Error upserting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
