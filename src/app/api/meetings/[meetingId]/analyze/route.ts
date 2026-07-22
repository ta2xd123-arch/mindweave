import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase, getAuthUser } from '@/lib/supabase-server';
import { model, geminiModelName, isGeminiConfigured, isMockMode } from '@/lib/gemini';
import { getIP, isRateLimited } from '@/lib/rate-limit';
import { parseAnalysisText, toClientAnalysis } from '@/lib/ai-analysis';
import { isMeetingOwner } from '@/lib/meeting-access';

const MAX_GEMINI_ATTEMPTS = 2;
const MAX_FORMAT_ATTEMPTS = 2;

function providerStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function isRetryableProviderError(error: unknown): boolean {
  const status = providerStatus(error);
  const message = error instanceof Error ? error.message : '';
  return status === 503 || message.includes('503') || message.includes('Service Unavailable') || message.includes('overloaded');
}

async function generateAnalysis(prompt: string) {
  if (!model) throw new Error('AI model is not initialized.');

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      return { result, attempt };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_GEMINI_ATTEMPTS || !isRetryableProviderError(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

// POST: Analyze meeting notes with Gemini AI
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const ip = getIP(req);
  // Limit to 5 requests per minute per IP for AI analysis
  if (isRateLimited(ip, 5, 60000)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    );
  }

  const { meetingId } = await params;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isMockMode && (!isGeminiConfigured || !model)) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  try {
    if (isSupabaseConfigured) {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('created_by')
        .eq('id', meetingId)
        .maybeSingle();
      if (meetingError) throw meetingError;
      if (!meeting || !isMeetingOwner(authUser, meeting.created_by)) {
        return NextResponse.json({ error: 'AI 분석은 모임장만 실행할 수 있습니다.' }, { status: 403 });
      }

      // Never make a second paid request while an unpublished draft already exists.
      const { data: existingDraft, error: existingDraftError } = await supabase
        .from('collective_knowledge')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingDraftError) throw existingDraftError;
      if (existingDraft) {
        return NextResponse.json(
          {
            error: '공개되지 않은 AI 분석 초안이 이미 있습니다. 초안을 공개하거나 정리한 뒤 다시 실행해 주세요.',
            analysis: toClientAnalysis(existingDraft),
          },
          { status: 409 }
        );
      }
    }

    // Fetch notes
    let notes: { author_name: string; note_type: string; content: string }[] = [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('notes')
        .select('author_name, note_type, content')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      notes = data || [];
    } else {
      // Mock mode: notes sent in body
      const body = await req.json().catch(() => ({}));
      notes = body.notes || [];
    }

    if (notes.length === 0) {
      return NextResponse.json(
        { error: '분석할 기록이 없습니다. 먼저 기록을 작성해 주세요.' },
        { status: 400 }
      );
    }

    // Build prompt
    const NOTE_TYPE_LABELS: Record<string, string> = {
      thought: '내 생각',
      question: '질문',
      impression: '인상 깊은 문장',
      opposite: '반대 의견',
      idea: '아이디어',
      action: '실천할 점',
      decision: '결정 사항',
      reference: '참고 자료',
    };

    const notesText = notes
      .map((n, i) => `[${i + 1}] ${n.author_name} (${NOTE_TYPE_LABELS[n.note_type] || n.note_type}): ${n.content}`)
      .join('\n');

    const prompt = `
당신은 모임의 여러 의견을 종합하여 '집단지성'을 도출하는 전문 AI 퍼실리테이터입니다.
단순 요약을 피하고, 참여자들의 의견(thought, question, opposite 등)을 분석하여 공통점, 차이점, 반대 의견, 그리고 새로운 통찰을 발견하는 데 집중하세요.

아래는 모임 참여자들이 남긴 기록입니다.

--- 기록 시작 ---
${notesText}
--- 기록 끝 ---

위 기록들을 분석하여 반드시 다음 JSON 형식으로만 응답하세요 (한국어로 작성하며, JSON 외의 마크다운이나 텍스트는 절대 포함하지 말 것):

{
  "title": "이 집단지성을 대표할 수 있는 명확하고 통찰력 있는 제목 (1문장)",
  "conclusion": "모임 전체 내용을 아우르는 핵심 결론 (3~5문장)",
  "supportingIdeas": [
    "참여자들이 공통적으로 지지하거나 동의한 주요 아이디어/경험 (배열)"
  ],
  "opposingIdeas": [
    "서로 충돌하는 관점이나 명확한 반대 의견 (배열, 없으면 빈 배열)"
  ],
  "newInsight": "기존 논의를 넘어 AI가 새롭게 제안하는 통찰이나 발상의 전환 (1~2문장)",
  "unresolvedQuestions": [
    "이 모임에서 해결되지 않았거나 다음 번에 꼭 논의해야 할 중요한 질문 (배열)"
  ],
  "actionItems": [
    "구체적으로 실천할 수 있는 행동 목표나 제안 (배열)"
  ]
}

규칙:
- 다수결을 무조건 정답으로 취급하지 말고, 소수의 반대 의견도 가치 있게 보존할 것.
- 원본에 없는 사실을 꾸며내지 말 것.
- 각 배열 항목은 2~5개 사이로 구체적으로 작성할 것.
`;

    console.log(`[GEMINI_API_CALL] Requesting analysis for meeting ${meetingId} (Mock: ${isMockMode})`);

    if (isMockMode) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 딜레이
      console.info('[GEMINI_API_RESULT]', { meetingId, model: geminiModelName, status: 200, mock: true });
      return NextResponse.json({
        analysis: {
          title: "[Mock 모드] 안전한 개발 환경 구축 방안",
          conclusion: "[Mock 모드] 이 내용은 실제 AI가 아닌 점검용 가짜 데이터입니다. 시스템의 본질적 목표는 다수결 요약이 아닌 공통점과 차이점을 통한 지성 도출입니다.",
          supportingIdeas: ["안정적인 서비스 운영이 중요하다", "개발 시 비용 최적화를 위해 Mock 데이터를 적극 활용해야 한다"],
          opposingIdeas: ["개발 속도를 위해 일부 에지 케이스 테스트는 생략하자는 의견 vs 완벽을 기해야 한다는 의견"],
          newInsight: "Mock 테스트를 도입하면 단순히 비용만 절감되는 것이 아니라, 예외 상황에 대한 프론트엔드 방어 로직을 더 꼼꼼하게 설계할 수 있다.",
          unresolvedQuestions: ["실제 데이터베이스와의 연동 테스트는 어느 주기로 할 것인가?"],
          actionItems: ["테스트 시 Mock 데이터를 유지하기", "새로운 API 키 등록 시에만 운영 환경에서 테스트 진행하기"]
        }
      });
    }

    let analysis = null;
    let usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
    let providerAttempts = 0;

    for (let formatAttempt = 1; formatAttempt <= MAX_FORMAT_ATTEMPTS; formatAttempt += 1) {
      const formatPrompt = formatAttempt === 1
        ? prompt
        : `${prompt}\n\n중요: 직전 응답은 유효한 JSON이 아니었습니다. JSON 객체만 다시 생성하세요.`;
      const generated = await generateAnalysis(formatPrompt);
      const response = generated.result.response;
      providerAttempts += generated.attempt;
      usage = response.usageMetadata;
      analysis = parseAnalysisText(response.text());

      if (analysis) break;
      console.warn('[GEMINI_API_FORMAT_RETRY]', {
        meetingId,
        model: geminiModelName,
        status: 200,
        mock: false,
        formatAttempt,
      });
    }

    if (!analysis) throw new Error('AI 응답을 파싱할 수 없습니다.');

    console.info('[GEMINI_API_RESULT]', {
      meetingId,
      model: geminiModelName,
      status: 200,
      mock: false,
      attempts: providerAttempts,
      promptTokenCount: usage?.promptTokenCount,
      candidatesTokenCount: usage?.candidatesTokenCount,
      totalTokenCount: usage?.totalTokenCount,
    });

    if (isSupabaseConfigured) {
      const { data: insertedKnowledge, error: insertError } = await supabase
        .from('collective_knowledge')
        .insert({
          meeting_id: meetingId,
          title: analysis.title,
          conclusion: analysis.conclusion,
          supporting_ideas: analysis.supportingIdeas || [],
          opposing_ideas: analysis.opposingIdeas || [],
          new_insight: analysis.newInsight || '',
          unresolved_questions: analysis.unresolvedQuestions || [],
          action_items: analysis.actionItems || [],
          status: 'draft',
          // Requires the reviewed MINDWEAVE-only migration before deployment.
          created_by: authUser.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting collective_knowledge:', insertError);
      } else {
        return NextResponse.json({ analysis: toClientAnalysis(insertedKnowledge) });
      }
    }

    return NextResponse.json({ analysis: toClientAnalysis(analysis) });
  } catch (error: unknown) {
    const providerHttpStatus = providerStatus(error);
    const errObj = error as { message?: string; status?: number };
    const msg = errObj.message || '';
    console.error('[GEMINI_API_ERROR]', {
      meetingId,
      model: geminiModelName,
      status: providerHttpStatus,
      mock: isMockMode,
      message: msg.slice(0, 300),
    });

    // Handle 429 Too Many Requests (Quota Exceeded)
    if (msg.includes('[429') || msg.includes('Too Many Requests') || msg.includes('Quota exceeded')) {
      return NextResponse.json(
        { error: 'AI 무료 제공 한도를 초과했습니다. 잠시 후 다시 시도해 주시거나 결제 계정을 확인해 주세요.' },
        { status: 429 }
      );
    }

    if (msg.includes('[404') || msg.includes('not found') || providerHttpStatus === 404) {
      return NextResponse.json(
        { error: 'Gemini 모델을 찾을 수 없습니다. 모델 설정을 확인해 주세요.' },
        { status: 404 }
      );
    }

    // Surface API key errors clearly
    if (msg.includes('API key') || msg.includes('INVALID_ARGUMENT') || msg.includes('[401') || msg.includes('[403') || providerHttpStatus === 401 || providerHttpStatus === 403) {
      return NextResponse.json(
        { error: 'AI 제공자 인증에 실패했습니다. 서버 환경 설정을 확인해 주세요.' },
        { status: 401 }
      );
    }

    // Handle 503 Service Unavailable (Overloaded)
    if (isRetryableProviderError(error)) {
      return NextResponse.json(
        { error: '현재 AI 서버에 사용자가 몰려 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: msg || 'AI 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
