import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase-server';
import { isMockMode } from '@/lib/gemini';
import { sourceChunkModel, sourceChunkModelName, isSourceGeminiConfigured, sourceSynthesisModel, sourceSynthesisModelName } from '@/lib/source-gemini';
import { canAnalyzeSourceLength, dailyAnalysisLimit, SOURCE_LIMIT_ERROR, sourceAnalysisConfig, sourceDocumentsAccessStatus } from '@/lib/source-analysis-config';
import { chunkSourceLocations, mapWithConcurrency, type SourceLocation } from '@/lib/source-documents';
import { parseSourceAnalysisText, type SourceKnowledgeCard } from '@/lib/source-analysis';

export const maxDuration = 300;

interface GeneratedJson {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function generateJson(
  target: NonNullable<typeof sourceChunkModel>,
  prompt: string,
): Promise<GeneratedJson> {
  const result = await target.generateContent(prompt);
  const usage = result.response.usageMetadata;
  return {
    text: result.response.text(),
    inputTokens: usage?.promptTokenCount || Math.ceil(prompt.length / 4),
    outputTokens: usage?.candidatesTokenCount || 0,
  };
}

function claimStatus(errorMessage: string): { status: number; message: string } {
  if (errorMessage.includes('DAILY_LIMIT')) return { status: 429, message: '오늘 사용할 수 있는 분석 횟수를 모두 사용했습니다.' };
  if (errorMessage.includes('RETRY_LIMIT')) return { status: 429, message: '이 자료의 분석 재시도 횟수를 모두 사용했습니다.' };
  if (errorMessage.includes('ANALYSIS_BUSY')) return { status: 409, message: '이 자료는 이미 분석 중입니다.' };
  return { status: 500, message: '분석 실행 상태를 확인하지 못했습니다.' };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  if (!sourceAnalysisConfig.documentsEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  const user = await getAuthUser(request);
  const accessStatus = sourceDocumentsAccessStatus(user);
  if (accessStatus !== 200) return NextResponse.json({ error: accessStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: accessStatus });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (sourceAnalysisConfig.paused) return NextResponse.json({ error: '자료 분석이 일시 중단되었습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  if (!isMockMode && (!isSourceGeminiConfigured || !sourceChunkModel || !sourceSynthesisModel)) {
    return NextResponse.json({ error: 'AI 분석 설정이 없습니다. 원문은 저장된 상태로 유지됩니다.' }, { status: 503 });
  }

  const { documentId } = await params;
  const body = await request.json().catch(() => ({})) as { visibility?: unknown; model?: unknown };
  const { data: document, error } = await supabase.from('source_documents').select('*').eq('id', documentId).eq('owner_id', user.id).maybeSingle();
  if (error || !document) return NextResponse.json({ error: '자료가 없거나 접근 권한이 없습니다.' }, { status: 404 });
  if (!canAnalyzeSourceLength(document.raw_text.length, user.role === 'owner')) return NextResponse.json({ error: SOURCE_LIMIT_ERROR }, { status: 413 });

  const chunks = chunkSourceLocations(document.locations as SourceLocation[], {
    chunkSize: sourceAnalysisConfig.chunkSize,
    chunkOverlap: sourceAnalysisConfig.chunkOverlap,
    maxChunks: sourceAnalysisConfig.maxChunks,
  });
  if (!chunks.length) return NextResponse.json({ error: '분석할 문서 내용이 없습니다.' }, { status: 400 });
  if (chunks.length > sourceAnalysisConfig.maxChunks) return NextResponse.json({ error: SOURCE_LIMIT_ERROR }, { status: 413 });

  const startedAt = Date.now();
  const dailyLimit = dailyAnalysisLimit(user.role === 'owner');
  const { data: usageId, error: claimError } = await supabase.rpc('begin_source_document_analysis', {
    p_document_id: documentId,
    p_owner_id: user.id,
    p_daily_limit: dailyLimit,
    p_max_attempts: sourceAnalysisConfig.maxRetries + 1,
    p_model_name: sourceSynthesisModelName,
    p_input_char_count: document.raw_text.length,
    p_chunk_count: chunks.length,
  });
  if (claimError || !usageId) {
    const result = claimStatus(claimError?.message || '');
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  let outputCharCount = 0;
  let inputTokenCount = 0;
  let outputTokenCount = 0;
  try {
    let card: SourceKnowledgeCard;
    if (isMockMode) {
      card = {
        title: document.title,
        coreClaims: ['문서의 핵심 주장'],
        keyEvidence: [{ claim: '근거 예시', locationKind: chunks[0].locations[0].kind, start: chunks[0].locations[0].start, end: chunks[0].locations[0].end }],
        researchFindings: [], conclusion: '문서 분석 결론', limitations: [], importantConcepts: [],
        commonWithExisting: [], differentFromExisting: [], newQuestions: [], actionIdeas: [],
      };
      inputTokenCount = Math.ceil(document.raw_text.length / 4);
    } else {
      const partials = await mapWithConcurrency(chunks, sourceAnalysisConfig.concurrency, async (chunk) => {
        const chunkHash = crypto.createHash('sha256').update(chunk.text).digest('hex');
        const { data: cached } = await supabase.from('source_analysis_chunks').select('result,input_token_count,output_token_count').eq('source_document_id', documentId).eq('chunk_index', chunk.index).eq('chunk_hash', chunkHash).eq('model_name', sourceChunkModelName).eq('prompt_version', sourceAnalysisConfig.promptVersion).eq('schema_version', sourceAnalysisConfig.schemaVersion).maybeSingle();
        const cachedText = cached?.result && typeof cached.result.text === 'string' ? cached.result.text : null;
        if (cachedText) return cachedText;

        const prompt = `[prompt:${sourceAnalysisConfig.promptVersion}] 다음은 긴 외부 자료의 ${chunk.index}/${chunks.length}번째 부분이다. 위치 표기를 유지하여 핵심 주장, 근거, 연구 결과, 결론, 한계, 중요 개념을 간결한 JSON으로 분석하라. 원문에 없는 사실을 만들지 마라.\n\n${chunk.text}`;
        const generated = await generateJson(sourceChunkModel!, prompt);
        inputTokenCount += generated.inputTokens;
        outputTokenCount += generated.outputTokens;
        outputCharCount += generated.text.length;
        const partial = generated.text.slice(0, 4_000);
        await supabase.from('source_analysis_chunks').upsert({
          source_document_id: documentId,
          chunk_index: chunk.index,
          chunk_hash: chunkHash,
          model_name: sourceChunkModelName,
          prompt_version: sourceAnalysisConfig.promptVersion,
          schema_version: sourceAnalysisConfig.schemaVersion,
          result: { text: partial },
          input_char_count: chunk.text.length,
          output_char_count: partial.length,
          input_token_count: generated.inputTokens,
          output_token_count: generated.outputTokens,
        }, { onConflict: 'source_document_id,chunk_index,chunk_hash,model_name,prompt_version,schema_version' });
        return partial;
      });

      const { data: ownedMeetings } = await supabase.from('meetings').select('id').eq('created_by', user.id).limit(100);
      const ownedMeetingIds = (ownedMeetings || []).map((meeting: { id: string }) => meeting.id);
      const { data: existing } = ownedMeetingIds.length
        ? await supabase.from('collective_knowledge').select('title,conclusion,supporting_ideas,opposing_ideas').eq('status', 'published').in('meeting_id', ownedMeetingIds).order('created_at', { ascending: false }).limit(10)
        : { data: [] };
      const synthesisPrompt = `[prompt:${sourceAnalysisConfig.promptVersion}][schema:${sourceAnalysisConfig.schemaVersion}] 외부 자료의 부분 분석을 종합해 하나의 지식카드를 JSON으로 작성하라. 기존 MINDWEAVE 지식과 비교하되 자료에 없는 내용을 자료의 사실처럼 쓰지 마라. keyEvidence의 위치는 제공된 페이지/문단 번호만 사용하라.\n필수 형식: {"title":"","coreClaims":[],"keyEvidence":[{"claim":"","locationKind":"page|paragraph","start":1,"end":1}],"researchFindings":[],"conclusion":"","limitations":[],"importantConcepts":[],"commonWithExisting":[],"differentFromExisting":[],"newQuestions":[],"actionIdeas":[]}\n\n부분 분석:\n${partials.join('\n').slice(0, 48_000)}\n\n기존 공개 지식:\n${JSON.stringify(existing || []).slice(0, 12_000)}`;
      const synthesized = await generateJson(sourceSynthesisModel!, synthesisPrompt);
      inputTokenCount += synthesized.inputTokens;
      outputTokenCount += synthesized.outputTokens;
      outputCharCount += synthesized.text.length;
      const parsed = parseSourceAnalysisText(synthesized.text);
      if (!parsed) throw new Error('AI 분석 결과 형식이 올바르지 않습니다.');
      card = parsed;
    }

    const visibility = body.visibility === 'participants' && document.meeting_id ? 'participants' : 'owner';
    const cardRow = {
      source_document_id: documentId, owner_id: user.id, title: card.title,
      core_claims: card.coreClaims, key_evidence: card.keyEvidence, research_findings: card.researchFindings,
      conclusion: card.conclusion, limitations: card.limitations, important_concepts: card.importantConcepts,
      common_with_existing: card.commonWithExisting, different_from_existing: card.differentFromExisting,
      new_questions: card.newQuestions, action_ideas: card.actionIdeas,
      evidence_locations: card.keyEvidence.map(({ locationKind, start, end }) => ({ kind: locationKind, start, end })),
      model_name: sourceSynthesisModelName, chunk_model_name: sourceChunkModelName,
      prompt_version: sourceAnalysisConfig.promptVersion, schema_version: sourceAnalysisConfig.schemaVersion,
      visibility, updated_at: new Date().toISOString(),
    };
    const { data: saved, error: saveError } = await supabase.from('knowledge_cards').upsert(cardRow, { onConflict: 'source_document_id' }).select().single();
    if (saveError) throw saveError;
    await Promise.all([
      supabase.from('source_documents').update({ analysis_status: 'complete', analysis_error: null, analysis_started_at: null, analysis_attempt_count: 0 }).eq('id', documentId).eq('owner_id', user.id),
      supabase.from('source_analysis_usage').update({
        output_char_count: outputCharCount, input_token_count: inputTokenCount, output_token_count: outputTokenCount,
        duration_ms: Date.now() - startedAt, status: 'succeeded', completed_at: new Date().toISOString(),
      }).eq('id', usageId).eq('owner_id', user.id),
    ]);
    return NextResponse.json({ card: saved });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'AI 분석에 실패했습니다.';
    await Promise.all([
      supabase.from('source_documents').update({ analysis_status: 'failed', analysis_error: message.slice(0, 500), analysis_started_at: null }).eq('id', documentId).eq('owner_id', user.id),
      supabase.from('source_analysis_usage').update({
        output_char_count: outputCharCount, input_token_count: inputTokenCount, output_token_count: outputTokenCount,
        duration_ms: Date.now() - startedAt, status: 'failed', completed_at: new Date().toISOString(),
      }).eq('id', usageId).eq('owner_id', user.id),
    ]);
    console.error('[SOURCE_DOCUMENT_ANALYSIS_ERROR]', { documentId, model: sourceSynthesisModelName, message: message.slice(0, 250) });
    return NextResponse.json({ error: `${message} 원문은 저장되어 있으며 다시 분석할 수 있습니다.` }, { status: 500 });
  }
}
