'use client';
import { apiFetch } from '@/lib/api-client';
import { useUpdateActivity } from '@/components/app-update-manager';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { renderFormattedText } from '@/lib/linkify';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string; title: string; topic: string; description: string;
  invite_code: string; created_by: string; meeting_date: string;
  created_at: string; status: string;
}
interface Participant {
  id: string; user_id: string; display_name: string; joined_at: string;
}
interface Note {
  id: string; author_id: string; author_name: string;
  note_type: NoteType; content: string;
  created_at: string; updated_at: string;
}
interface Reaction {
  note_id: string; user_id: string; user_name: string; reaction_type: string;
}
interface AIAnalysis {
  status?: string;
  title: string;
  conclusion: string;
  supportingIdeas: string[];
  opposingIdeas: string[];
  newInsight: string;
  unresolvedQuestions: string[];
  actionItems: string[];
}

type NoteType = 'thought' | 'question' | 'impression' | 'opposite' | 'idea' | 'action' | 'decision' | 'reference';

// ── Config ────────────────────────────────────────────────────────────────────

const NOTE_TYPES: { value: NoteType; label: string; emoji: string }[] = [
  { value: 'thought',    label: '내 생각',       emoji: '💭' },
  { value: 'question',   label: '질문',           emoji: '❓' },
  { value: 'impression', label: '인상 깊은 문장', emoji: '✨' },
  { value: 'opposite',   label: '반대 의견',      emoji: '⚡' },
  { value: 'idea',       label: '아이디어',       emoji: '💡' },
  { value: 'action',     label: '실천할 점',      emoji: '🎯' },
  { value: 'decision',   label: '결정 사항',      emoji: '✅' },
  { value: 'reference',  label: '참고 자료',      emoji: '📎' },
];

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockGetReactions(meetingId: string): Record<string, Reaction[]> {
  return JSON.parse(localStorage.getItem(`mindweave_mock_reactions_${meetingId}`) || '{}');
}

// ── AI Section Component ──────────────────────────────────────────────────────

function AIAnalysisSection({
  meetingId, notes, initialAnalysis, canManage, onDownloadMD, onAnalysisUpdated
}: {
  meetingId: string;
  notes: Note[];
  initialAnalysis?: AIAnalysis | null;
  canManage: boolean;
  onDownloadMD?: (analysis: AIAnalysis) => void;
  onAnalysisUpdated?: (analysis: AIAnalysis) => void;
}) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(initialAnalysis ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  useUpdateActivity(`ai-analysis-${meetingId}`, isAnalyzing || isPublishing);
  const supportingIdeas = Array.isArray(analysis?.supportingIdeas) ? analysis.supportingIdeas : [];
  const opposingIdeas = Array.isArray(analysis?.opposingIdeas) ? analysis.opposingIdeas : [];
  const actionItems = Array.isArray(analysis?.actionItems) ? analysis.actionItems : [];
  const unresolvedQuestions = Array.isArray(analysis?.unresolvedQuestions) ? analysis.unresolvedQuestions : [];

  const handleAnalyze = async () => {
    if (notes.length === 0) {
      setError('분석할 기록이 없습니다.');
      return;
    }
    setIsAnalyzing(true);
    setError('');
    try {
      const body: Record<string, unknown> = { meetingId };
      if (!isSupabaseConfigured) {
        body.notes = notes.map(n => ({ author_name: n.author_name, note_type: n.note_type, content: n.content }));
      }
      const res = await apiFetch(`/api/meetings/${meetingId}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 분석 실패');
      const newAnalysis: AIAnalysis = { ...data.analysis, status: 'published' };
      setAnalysis(newAnalysis);
      onAnalysisUpdated?.(newAnalysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI 분석 실패');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublish = async () => {
    if (!analysis) return;
    setIsPublishing(true);
    try {
      const res = await apiFetch(`/api/meetings/${meetingId}/report`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '공개 실패');
      setAnalysis({ ...analysis, status: 'published' });
      alert('성공적으로 공개되었습니다!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '공개 실패');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="font-headline-md text-xl sm:text-2xl text-on-surface flex items-center gap-3 text-readable">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          AI Meeting Insights
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-primary/20">
            Gemini 3.6 Flash
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
            <span className="material-symbols-outlined text-[20px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>
      
      {error && <div className="p-4 bg-error/10 text-error rounded-xl text-sm border border-error/20 text-readable">⚠️ {error}</div>}

      {!analysis && !isAnalyzing && canManage && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">psychology</span>
          <p className="text-on-surface-variant font-body-lg text-readable">모임의 모든 기록을 종합하여 인사이트를 도출합니다.</p>
          <button onClick={handleAnalyze} disabled={notes.length === 0} className="primary-gradient-btn w-full sm:w-auto px-6 py-3 rounded-full text-white font-bold flex items-center justify-center gap-2 hover:scale-[0.98] transition-all shadow-lg disabled:opacity-50">
            <span className="material-symbols-outlined">analytics</span>
            AI 분석 시작
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-bold text-readable">인사이트 분석 중... (약 10~20초 소요)</p>
        </div>
      )}

      {analysis && expanded && (
        <div className="space-y-6">
          {/* Title & Conclusion */}
          <div className="glass-card-elevated rounded-2xl p-4 sm:p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary"></div>
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-label-caps text-[10px] border border-primary/20 mb-3 tracking-widest uppercase">집단지성</span>
            <h3 className="text-lg sm:text-xl font-bold text-on-surface mb-3 text-readable">{analysis.title}</h3>
            <p className="text-on-surface font-body-lg text-readable">{analysis.conclusion}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supporting Ideas */}
            <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4 hover:bg-surface-variant/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400">handshake</span>
                </div>
                <h4 className="font-bold text-on-surface">공통 지지 의견</h4>
              </div>
              <ul className="space-y-2">
                {supportingIdeas.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span className="text-readable">{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Opposing Ideas */}
            {opposingIdeas.length > 0 && (
              <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4 hover:bg-surface-variant/20 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-error">alt_route</span>
                  </div>
                  <h4 className="font-bold text-on-surface">반대/다른 시각</h4>
                </div>
                <ul className="space-y-2">
                  {opposingIdeas.map((v, i) => (
                    <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                      <span className="text-error shrink-0">⚡</span>
                      <span className="text-readable">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* New Insight */}
            <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4 hover:bg-surface-variant/20 transition-all md:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary">lightbulb</span>
                </div>
                <h4 className="font-bold text-on-surface">새로운 통찰</h4>
              </div>
              <p className="text-sm text-on-surface-variant text-readable">
                {analysis.newInsight}
              </p>
            </div>

            {/* Unresolved Questions / Action Items */}
            <div className="glass-card rounded-xl p-4 sm:p-6 space-y-6 hover:bg-surface-variant/20 transition-all md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">task_alt</span>
                    </div>
                    <h4 className="font-bold text-on-surface">실천 항목</h4>
                  </div>
                  <ul className="space-y-2">
                    {actionItems.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                        <span className="text-primary shrink-0">→</span>
                        <span className="text-readable">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-purple-400">help</span>
                    </div>
                    <h4 className="font-bold text-on-surface">미해결 질문</h4>
                  </div>
                  <ul className="space-y-2">
                    {unresolvedQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                        <span className="text-purple-400 shrink-0 font-bold">Q.</span>
                        <span className="text-readable">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-end pt-2 gap-3">
            {analysis && (
              <button onClick={() => onDownloadMD?.(analysis)} className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">download</span>
                MD 파일 다운로드
              </button>
            )}
            {canManage && (
              <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-sm font-semibold text-on-surface-variant hover:text-primary flex items-center justify-center gap-1 transition-colors px-3 py-2">
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                재분석
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const router = useRouter();
  const { meetingId } = use(params);

  const [session] = useState<UserSession | null>(() => getLocalSession());
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const [isMeetingCreator, setIsMeetingCreator] = useState(false);
  const [initialAnalysis, setInitialAnalysis] = useState<AIAnalysis | null>(null);

  // Redirect if no session
  useEffect(() => {
    if (!session) { router.push('/'); }
  }, [session, router]);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      try {
        if (!isSupabaseConfigured) {
          const all: Meeting[] = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
          const found = all.find(m => m.id === meetingId);
          if (!found) { setErrorMsg('모임을 찾을 수 없습니다.'); return; }
          setMeeting(found);
          setParticipants(JSON.parse(localStorage.getItem(`mindweave_mock_participants_${meetingId}`) || '[]'));
          setNotes(JSON.parse(localStorage.getItem(`mindweave_mock_notes_${meetingId}`) || '[]'));
          setReactions(mockGetReactions(meetingId));
          setIsMeetingCreator(found.created_by === session.id);
          return;
        }
        const res = await apiFetch(`/api/meetings/${meetingId}/report`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMeeting(data.meeting);
        setParticipants(data.participants || []);
        setNotes(data.notes || []);
        setIsMeetingCreator(Boolean(data.isMeetingCreator));
        if (data.aiReport) {
          setInitialAnalysis({
            status: data.aiReport.status,
            title: data.aiReport.title,
            conclusion: data.aiReport.conclusion,
            supportingIdeas: data.aiReport.supportingIdeas || [],
            opposingIdeas: data.aiReport.opposingIdeas || [],
            newInsight: data.aiReport.newInsight || '',
            unresolvedQuestions: data.aiReport.unresolvedQuestions || [],
            actionItems: data.aiReport.actionItems || []
          });
        }
        const map: Record<string, Reaction[]> = {};
        for (const r of data.reactions || []) {
          if (!map[r.note_id]) map[r.note_id] = [];
          map[r.note_id].push(r);
        }
        setReactions(map);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '데이터 로드 실패');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [session, meetingId]);

    const handleDownloadMarkdown = (targetAnalysis?: AIAnalysis | null) => {
    const analysisToUse = targetAnalysis || initialAnalysis;
    if (!analysisToUse || !meeting) return;
    const md = `# ${meeting.title}\n\n**주제**: ${meeting.topic}\n**날짜**: ${new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString('ko-KR')}\n\n## 집단지성\n### ${analysisToUse.title}\n${analysisToUse.conclusion}\n\n## 공통 지지 의견\n${analysisToUse.supportingIdeas.map(i => `- ${i}`).join('\n')}\n\n## 반대/다른 시각\n${analysisToUse.opposingIdeas.map(i => `- ${i}`).join('\n')}\n\n## 새로운 통찰\n${analysisToUse.newInsight}\n\n## 미해결 질문\n${analysisToUse.unresolvedQuestions.map(i => `- ${i}`).join('\n')}\n\n## 실천 항목\n${analysisToUse.actionItems.map(i => `- ${i}`).join('\n')}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title}_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: meeting?.title, text: meeting?.topic, url });
    } else {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2C4D46] border-t-transparent" />
          <p className="text-xs text-zinc-400">리포트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-6">
        <div className="max-w-md w-full text-center bg-white p-4 sm:p-6 md:p-8 rounded-2xl space-y-4">
          <p className="text-4xl">😕</p>
          <h2 className="text-lg font-bold">리포트를 불러올 수 없습니다</h2>
          <p className="text-zinc-400 text-sm text-readable">{errorMsg}</p>
          <button onClick={() => router.back()} className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalReactions = Object.values(reactions).reduce((s, r) => s + r.length, 0);
  const typedNotes = NOTE_TYPES.map(t => ({ ...t, notes: notes.filter(n => n.note_type === t.value) })).filter(t => t.notes.length > 0);
  const authorCounts = notes.reduce<Record<string, { name: string; count: number }>>((acc, n) => {
    if (!acc[n.author_id]) acc[n.author_id] = { name: n.author_name, count: 0 };
    acc[n.author_id].count++;
    return acc;
  }, {});
  const topAuthors = Object.values(authorCounts).sort((a, b) => b.count - a.count);
  const formattedDate = new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });
  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Background glow orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/10 blur-[150px] pointer-events-none rounded-full"></div>

      <header className="sticky top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10 print:hidden">
        <div className="flex justify-between items-center px-3 sm:px-4 md:px-gutter py-3 md:py-base max-w-container-max mx-auto min-h-16 md:min-h-20 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link href={`/meetings/${meetingId}`} title="뒤로 가기" className="material-symbols-outlined text-primary hover:bg-surface-variant p-2 rounded-full transition-colors active:scale-95 duration-200">
              arrow_back
            </Link>
            <h1 className="font-headline-md text-[20px] md:text-[28px] font-bold text-on-surface tracking-tighter hidden sm:block">
              모임 리포트
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {initialAnalysis && (
              <button onClick={() => handleDownloadMarkdown(initialAnalysis)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors text-xs sm:text-sm font-bold shadow-md">
                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">download</span>
                <span>MD 다운로드</span>
              </button>
            )}
            <button onClick={handleShare} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full glass-card hover:bg-surface-variant transition-colors text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'share'}</span>
              <span className="hidden sm:inline">{copied ? '복사됨!' : '공유하기'}</span>
            </button>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-bold">
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span className="hidden sm:inline">인쇄</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-container-max mx-auto px-3 sm:px-4 md:px-gutter py-6 md:py-8 space-y-8 md:space-y-12 print:py-0 print:px-0 relative min-h-screen w-full">

        {/* Cover */}
        <section className="glass-card-elevated rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden group border border-outline-variant/20 shadow-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary"></div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary opacity-80 text-sm">topic</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">MINDWEAVE Report</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold leading-tight text-on-surface tracking-tight text-readable">{meeting.title}</h1>
              <p className="text-on-surface-variant font-body-lg max-w-2xl text-readable">{meeting.topic}</p>
              {meeting.description && <p className="text-sm text-on-surface-variant/70 mt-2 max-w-2xl text-readable">{meeting.description}</p>}
              
              <div className="flex flex-wrap gap-4 pt-4 text-xs font-semibold text-on-surface-variant">
                <span className="flex items-center gap-1.5 bg-surface-variant px-3 py-1.5 rounded-full"><span className="material-symbols-outlined text-[14px]">event</span>{formattedDate}</span>
                <span className="flex items-center gap-1.5 bg-surface-variant px-3 py-1.5 rounded-full font-mono font-mono-code"><span className="material-symbols-outlined text-[14px]">key</span>{meeting.invite_code}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:w-48 shrink-0">
              <div className="glass-card rounded-xl p-4 text-center border-primary/20 bg-primary/5">
                <span className="material-symbols-outlined text-primary mb-1">group</span>
                <div className="text-3xl font-bold text-on-surface">{participants.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-1">참여자</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center border-secondary/20 bg-secondary/5">
                <span className="material-symbols-outlined text-secondary mb-1">thumb_up</span>
                <div className="text-3xl font-bold text-on-surface">{totalReactions}</div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-1">반응</div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Analysis */}
        {isMeetingCreator ? (
          <AIAnalysisSection meetingId={meetingId} notes={notes} initialAnalysis={initialAnalysis} canManage onDownloadMD={handleDownloadMarkdown} onAnalysisUpdated={setInitialAnalysis} />
        ) : initialAnalysis ? (
          <AIAnalysisSection meetingId={meetingId} notes={notes} initialAnalysis={initialAnalysis} canManage={false} onDownloadMD={handleDownloadMarkdown} onAnalysisUpdated={setInitialAnalysis} />
        ) : (
          <div className="glass-card rounded-2xl p-4 sm:p-6 flex items-center justify-center text-center space-y-4">
             <p className="text-sm text-on-surface-variant text-readable">진행자가 AI 리포트를 공개하면 이 위치에 나타납니다.</p>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type Distribution */}
          {notes.length > 0 && (
            <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-5">
              <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                기록 유형 분포
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {NOTE_TYPES.map(t => {
                  const count = notes.filter(n => n.note_type === t.value).length;
                  if (count === 0) return null;
                  return (
                    <div key={t.value} className="rounded-xl p-3 bg-surface-variant/30 border border-outline-variant/10 space-y-2 text-center relative overflow-hidden group">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="text-2xl block">{t.emoji}</span>
                      <span className="text-xl font-bold text-on-surface block">{count}</span>
                      <p className="text-[11px] font-bold text-on-surface-variant truncate">{t.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Participant Contributions */}
          {topAuthors.length > 0 && (
            <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-5">
              <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                <span className="material-symbols-outlined text-secondary">bar_chart</span>
                기여도
              </h3>
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {topAuthors.map((a) => (
                  <div key={a.name} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-bold text-xs text-on-surface uppercase border border-outline-variant/20 shadow-sm">
                      {a.name.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-semibold text-on-surface truncate">{a.name}</span>
                        <span className="text-xs font-bold text-primary">{a.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden">
                        <div className="h-full bg-secondary transition-all duration-1000 group-hover:bg-secondary-container" style={{ width: `${(a.count / notes.length) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* All Notes Grouped */}
        <section className="space-y-8">
          <h3 className="font-headline-md text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">history</span>
            상세 기록
          </h3>
          
          {typedNotes.length === 0 ? (
            <div className="glass-card p-12 rounded-3xl text-center opacity-70">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">edit_note</span>
              <p className="text-on-surface font-bold text-lg mb-2">기록된 내용이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-10">
              {typedNotes.map(group => (
                <div key={group.value} className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-outline-variant/10">
                    <span className="text-xl">{group.emoji}</span>
                    <h4 className="text-base font-bold text-on-surface">{group.label}</h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-variant text-on-surface-variant text-[10px] font-bold">{group.notes.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.notes.map(note => {
                      const nr = reactions[note.id] || [];
                      return (
                        <div key={note.id} className="glass-card rounded-2xl p-4 sm:p-5 hover:border-primary/30 transition-colors group">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center font-bold text-[10px] text-on-surface uppercase shadow-sm">
                                {note.author_name.slice(0, 1)}
                              </div>
                              <span className="text-xs font-bold text-on-surface truncate max-w-[12rem]">{note.author_name}</span>
                            </div>
                            <span className="text-[10px] text-on-surface-variant font-mono">{new Date(note.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm text-on-surface whitespace-pre-wrap text-readable">{renderFormattedText(note.content)}</p>
                          {nr.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-outline-variant/10">
                              <span className="material-symbols-outlined text-[14px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>thumb_up</span>
                              <span className="text-xs font-bold text-primary">{nr.length}</span>
                              <span className="text-[10px] text-on-surface-variant ml-1 truncate">
                                {nr.slice(0, 3).map(r => r.user_name).join(', ')}
                                {nr.length > 3 ? ` 외 ${nr.length - 3}명` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="text-center pb-8 pt-8 border-t border-outline-variant/10 print:pb-0 mt-12">
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase font-bold text-readable">MINDWEAVE AI Collaboration Platform • {formattedDate}</p>
        </footer>
      </main>
    </>
  );
}
