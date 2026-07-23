import { lookup } from 'node:dns/promises';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase-server';
import { isPrivateAddress, paragraphLocations, sanitizeSourceText, type SourceDocumentType, type SourceInputType, validateSourceUrl } from '@/lib/source-documents';
import { canAnalyzeSourceLength, dailyAnalysisLimit, SOURCE_LIMIT_ERROR, sourceAnalysisConfig, sourceDocumentsAccessStatus } from '@/lib/source-analysis-config';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function extractPdf(file: File) {
  if (file.size > sourceAnalysisConfig.directPdfUploadLimitBytes) throw new Error('현재 PDF는 최대 4MB까지 업로드할 수 있습니다.');
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF 형식만 업로드할 수 있습니다.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('올바른 PDF 파일이 아닙니다.');
  const { extractPdfBuffer } = await import('@/lib/pdf-extraction');
  return extractPdfBuffer(bytes);
}

async function extractWebpage(input: string) {
  const url = validateSourceUrl(input);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error('내부 네트워크로 연결되는 URL은 가져올 수 없습니다.');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'MINDWEAVE-SourceImporter/1.0' } });
  if (!response.ok) throw new Error(`웹페이지를 가져오지 못했습니다. (${response.status})`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('HTML 또는 일반 텍스트 웹페이지만 지원합니다.');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > sourceAnalysisConfig.webpageDownloadLimitBytes) throw new Error('웹페이지 응답은 2MB까지 가져올 수 있습니다.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > sourceAnalysisConfig.webpageDownloadLimitBytes) throw new Error('웹페이지 응답은 2MB까지 가져올 수 있습니다.');
  const html = new TextDecoder().decode(buffer);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const rawText = sanitizeSourceText(html);
  return { rawText, locations: paragraphLocations(rawText), metadata: { title: sanitizeSourceText(title), author: '', publishedAt: '' }, sourceUrl: url.toString() };
}

export async function GET(request: NextRequest) {
  if (!sourceAnalysisConfig.documentsEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isSupabaseConfigured) return NextResponse.json({ documents: [] });
  const user = await getAuthUser(request);
  const accessStatus = sourceDocumentsAccessStatus(user);
  if (accessStatus !== 200) return NextResponse.json({ error: accessStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: accessStatus });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('source_documents').select('id,meeting_id,title,author,source_name,source_url,published_at,document_type,input_type,analysis_status,analysis_error,analysis_attempt_count,created_at').eq('owner_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: '자료 목록을 불러오지 못했습니다.' }, { status: 500 });
  const isAdmin = user.role === 'owner';
  const dailyLimit = dailyAnalysisLimit(isAdmin);
  const { data: usageCount, error: usageError } = await supabase.rpc('source_analysis_daily_usage_count', { p_owner_id: user.id });
  if (usageError) return NextResponse.json({ error: '오늘의 분석 사용량을 확인하지 못했습니다.' }, { status: 500 });
  return NextResponse.json({
    documents: data || [],
    policy: {
      textLimit: sourceAnalysisConfig.textLimit,
      pdfLimitBytes: sourceAnalysisConfig.directPdfUploadLimitBytes,
      chunkSize: sourceAnalysisConfig.chunkSize,
      maxChunks: sourceAnalysisConfig.maxChunks,
      maxRetries: sourceAnalysisConfig.maxRetries,
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - (Number(usageCount) || 0)),
      paused: sourceAnalysisConfig.paused,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!sourceAnalysisConfig.documentsEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: '자료 저장에는 Supabase 설정이 필요합니다.' }, { status: 503 });
  const user = await getAuthUser(request);
  const accessStatus = sourceDocumentsAccessStatus(user);
  if (accessStatus !== 200) return NextResponse.json({ error: accessStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: accessStatus });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const declaredRequestBytes = Number(request.headers.get('content-length') || 0);
    if (declaredRequestBytes > sourceAnalysisConfig.directPdfUploadLimitBytes + 1024 * 1024) {
      return NextResponse.json({ error: '업로드 요청 크기가 허용 범위를 초과했습니다.' }, { status: 413 });
    }
    const form = await request.formData();
    const inputType = String(form.get('inputType') || '') as SourceInputType;
    if (!['text', 'pdf', 'url'].includes(inputType)) return NextResponse.json({ error: '텍스트, PDF, URL 형식만 지원합니다.' }, { status: 415 });
    let extracted: Awaited<ReturnType<typeof extractWebpage>>;
    if (inputType === 'pdf') {
      const file = form.get('file'); if (!(file instanceof File)) throw new Error('PDF 파일을 선택해 주세요.');
      extracted = { ...(await extractPdf(file)), sourceUrl: '' };
    } else if (inputType === 'url') extracted = await extractWebpage(String(form.get('url') || ''));
    else {
      const rawText = sanitizeSourceText(String(form.get('rawText') || ''));
      extracted = { rawText, locations: paragraphLocations(rawText), metadata: { title: '', author: '', publishedAt: '' }, sourceUrl: '' };
    }
    if (!extracted.rawText) throw new Error('추출할 수 있는 텍스트가 없습니다. 이미지로만 된 PDF는 현재 지원하지 않습니다.');
    if (!canAnalyzeSourceLength(extracted.rawText.length, user.role === 'owner')) throw new Error(SOURCE_LIMIT_ERROR);
    const title = sanitizeSourceText(String(form.get('title') || extracted.metadata.title || '제목 없는 외부 자료')).slice(0, 300);
    const documentType = String(form.get('documentType') || 'other') as SourceDocumentType;
    if (!['paper','report','article','research','other'].includes(documentType)) throw new Error('지원하지 않는 문서 유형입니다.');
    const meetingId = String(form.get('meetingId') || '') || null;
    if (meetingId) {
      const { data: meeting } = await supabase.from('meetings').select('id').eq('id', meetingId).eq('created_by', user.id).maybeSingle();
      if (!meeting) return NextResponse.json({ error: '소유한 모임에만 자료를 연결할 수 있습니다.' }, { status: 403 });
    }
    const row = { owner_id: user.id, meeting_id: meetingId, title, author: sanitizeSourceText(String(form.get('author') || extracted.metadata.author)).slice(0, 200), source_name: sanitizeSourceText(String(form.get('sourceName') || '')).slice(0, 300), source_url: extracted.sourceUrl || null, published_at: String(form.get('publishedAt') || extracted.metadata.publishedAt || '') || null, document_type: documentType, input_type: inputType, raw_text: extracted.rawText, content_hash: crypto.createHash('sha256').update(extracted.rawText).digest('hex'), locations: extracted.locations, analysis_status: 'stored' };
    const { data, error } = await supabase.from('source_documents').upsert(row, { onConflict: 'owner_id,content_hash', ignoreDuplicates: false }).select('id,title,analysis_status').single();
    if (error) throw error;
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '외부 자료를 저장하지 못했습니다.';
    console.error('[SOURCE_DOCUMENT_IMPORT_ERROR]', { message: message.slice(0, 250) });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
