import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-server';
import { model, isGeminiConfigured, isMockMode } from '@/lib/gemini';
import { getIP, isRateLimited } from '@/lib/rate-limit';

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

  if (!isMockMode && (!isGeminiConfigured || !model)) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  try {
    // Fetch notes
    let notes: any[] = [];

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
당신은 독서모임, 스터디, 브레인스토밍 등 소규모 모임의 집단지성을 분석하는 전문 퍼실리테이터입니다.
아래는 모임 참여자들이 실시간으로 남긴 기록들입니다.

--- 기록 시작 ---
${notesText}
--- 기록 끝 ---

위 기록들을 분석하여 반드시 다음 JSON 형식으로만 응답하세요 (한국어로):

{
  "summary": "모임 전체 내용을 3~5문장으로 요약. 핵심 흐름과 분위기 포함.",
  "keyTopics": [
    { "topic": "핵심 주제 제목", "description": "이 주제에 대해 어떤 이야기가 오갔는지 1~2문장 설명" }
  ],
  "commonGrounds": [
    "여러 참여자가 공유하거나 공감한 의견이나 생각 (구체적으로)"
  ],
  "differentViews": [
    "서로 다른 시각이나 충돌하는 관점 (구체적으로)"
  ],
  "nextQuestions": [
    "이 모임의 내용을 바탕으로 다음번에 이어서 논의하면 좋을 질문"
  ],
  "actionItems": [
    "참여자들이 실천하거나 따르기로 한 항목, 또는 이 모임에서 자연스럽게 도출된 실천 제안"
  ]
}

규칙:
- keyTopics는 2~4개
- commonGrounds는 2~4개
- differentViews는 1~3개 (없으면 빈 배열)
- nextQuestions는 2~4개
- actionItems는 2~5개
- 모든 항목은 구체적이고 실용적으로 작성
- 참여자 이름은 언급하지 말 것
- JSON 외의 텍스트는 절대 포함하지 말 것
`;

    console.log(`[GEMINI_API_CALL] Requesting analysis for meeting ${meetingId} (Mock: ${isMockMode})`);

    if (isMockMode) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 딜레이
      return NextResponse.json({
        analysis: {
          summary: "[Mock 모드] 이 내용은 실제 AI가 아닌 개발/점검 환경에서 반환된 가짜 데이터입니다. 모임의 전반적인 분위기와 핵심 내용을 요약합니다.",
          keyTopics: [
            { topic: "API 호출 차단", description: "불필요한 과금을 막기 위해 자동/반복 테스트 시 AI 호출을 제한했습니다." },
            { topic: "안전한 개발", description: "운영 서버가 아닌 곳에서는 Mock 데이터를 사용하여 개발 생산성을 높입니다." }
          ],
          commonGrounds: ["안정적인 서비스 운영이 중요하다", "에러 핸들링이 잘 되어야 한다"],
          differentViews: ["일부 디자인 수정에 대한 의견 차이"],
          nextQuestions: ["다음 테스트 시나리오는 무엇인가요?"],
          actionItems: ["테스트 시 Mock 데이터를 유지하기", "새로운 API 키 등록 시 운영 환경에서만 테스트하기"]
        }
      });
    }

    if (!model) {
      throw new Error('AI 모델이 초기화되지 않았습니다.');
    }
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      // Try to extract JSON if wrapped in markdown
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        analysis = JSON.parse(match[0]);
      } else {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }
    }

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
    const msg = error.message || '';

    // Handle 429 Too Many Requests (Quota Exceeded)
    if (msg.includes('[429') || msg.includes('Too Many Requests') || msg.includes('Quota exceeded')) {
      return NextResponse.json(
        { error: 'AI 무료 제공 한도를 초과했습니다. 잠시 후 다시 시도해 주시거나 결제 계정을 확인해 주세요.' },
        { status: 429 }
      );
    }

    // Surface API key errors clearly
    if (msg.includes('API key') || msg.includes('INVALID_ARGUMENT') || msg.includes('[401') || msg.includes('[403') || error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { error: 'API 키가 유효하지 않습니다. .env.local의 MINDWEAVE_GEMINI_KEY를 확인해 주세요.' },
        { status: 401 }
      );
    }

    // Handle 503 Service Unavailable (Overloaded)
    if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('overloaded')) {
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
