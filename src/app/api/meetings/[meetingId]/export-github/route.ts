import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  void meetingId;

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { repo, token, path, content, message } = body;

    if (!repo || !token || !path || !content) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다 (저장소, 토큰, 경로, 내용).' }, { status: 400 });
    }

    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    const cleanPath = path.trim().replace(/^\//, '');
    const cleanToken = token.trim();

    const commitMessage = message || `Add meeting report: ${cleanPath}`;
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    // 1. 기존 파일 존재 여부 확인 (SHA 값을 얻기 위함)
    let sha: string | undefined = undefined;
    const checkRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'MINDWEAVE-App',
      },
    });

    if (checkRes.ok) {
      const existingData = await checkRes.json();
      sha = existingData.sha;
    }

    // 2. 파일 생성 또는 업데이트 (PUT API)
    const putRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MINDWEAVE-App',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        sha,
      }),
    });

    const resultData = await putRes.json();

    if (!putRes.ok) {
      const errorMsg = resultData.message || 'GitHub API 요청에 실패했습니다.';
      return NextResponse.json({ error: `GitHub 업로드 실패: ${errorMsg}` }, { status: putRes.status });
    }

    return NextResponse.json({
      success: true,
      fileUrl: resultData.content?.html_url || `https://github.com/${cleanRepo}/blob/main/${cleanPath}`,
      commitUrl: resultData.commit?.html_url,
    });
  } catch (error: unknown) {
    console.error('Error exporting to GitHub:', error);
    const msg = error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
