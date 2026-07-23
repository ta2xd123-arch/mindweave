import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase-server';
import { canAccessSourceRaw } from '@/lib/source-documents';
import { sourceAnalysisConfig, sourceDocumentsAccessStatus } from '@/lib/source-analysis-config';

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  if (!sourceAnalysisConfig.documentsEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  const user = await getAuthUser(request);
  const accessStatus = sourceDocumentsAccessStatus(user);
  if (accessStatus !== 200) return NextResponse.json({ error: accessStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: accessStatus });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { documentId } = await params;
  const { data: document, error } = await supabase.from('source_documents').select('*').eq('id', documentId).maybeSingle();
  if (error) return NextResponse.json({ error: '자료를 불러오지 못했습니다.' }, { status: 500 });
  if (!document) return NextResponse.json({ error: '자료가 없습니다.' }, { status: 404 });
  const isOwner = canAccessSourceRaw(user.id, document.owner_id);
  const { data: card } = await supabase.from('knowledge_cards').select('*').eq('source_document_id', documentId).maybeSingle();
  if (!isOwner) {
    if (!card || card.visibility !== 'participants' || !document.meeting_id) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    const { data: participant } = await supabase.from('meeting_participants').select('id').eq('meeting_id', document.meeting_id).eq('user_id', user.id).maybeSingle();
    if (!participant) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    const metadata = { ...document } as Record<string, unknown>;
    delete metadata.raw_text; delete metadata.locations; delete metadata.content_hash;
    return NextResponse.json({ document: metadata, card });
  }
  return NextResponse.json({ document, card });
}
