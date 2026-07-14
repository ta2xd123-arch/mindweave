'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  ArrowLeft, Users, Clock, FileText,
  ThumbsUp, Printer, Share2, Check,
  Sparkles, Loader2, ChevronDown, ChevronUp,
  Lightbulb, MessageCircle, GitBranch, Target, HelpCircle, BookOpen,
} from 'lucide-react';
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
  summary: string;
  keyTopics: { topic: string; description: string }[];
  commonGrounds: string[];
  differentViews: string[];
  nextQuestions: string[];
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
  meetingId, notes, isCreator,
}: {
  meetingId: string;
  notes: Note[];
  isCreator: boolean;
}) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  // Load cached analysis from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(`mindweave_analysis_${meetingId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // 하위 호환성 (구조가 바뀐 경우 처리)
        setAnalysis(parsed.analysis ? parsed.analysis : parsed);
      } catch {}
    }
  }, [meetingId]);

  const handleAnalyze = async () => {
    if (notes.length === 0) {
      setError('분석할 기록이 없습니다.');
      return;
    }

    // 간단한 해시 함수로 입력값 고유성 검증
    const notesStr = JSON.stringify(notes.map(n => n.content));
    let currentHash = 0;
    for (let i = 0; i < notesStr.length; i++) {
      currentHash = ((currentHash << 5) - currentHash) + notesStr.charCodeAt(i);
      currentHash |= 0;
    }
    const hashStr = currentHash.toString();

    // 동일한 입력인 경우 캐시된 결과 재사용
    const cachedItem = localStorage.getItem(`mindweave_analysis_${meetingId}`);
    if (cachedItem) {
      try {
        const parsed = JSON.parse(cachedItem);
        if (parsed.hash === hashStr && parsed.analysis) {
          setAnalysis(parsed.analysis);
          return; // 실제 API 호출 차단 (즉시 종료)
        }
      } catch {}
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const body: any = { meetingId };
      if (!isSupabaseConfigured) {
        body.notes = notes.map(n => ({
          author_name: n.author_name,
          note_type: n.note_type,
          content: n.content,
        }));
      }

      const res = await fetch(`/api/meetings/${meetingId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'AI 분석 실패');

      setAnalysis(data.analysis);
      // Cache locally with hash
      localStorage.setItem(`mindweave_analysis_${meetingId}`, JSON.stringify({
        hash: hashStr,
        analysis: data.analysis
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          AI Meeting Insights
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-primary/20">
            Gemini 2.0 Flash
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
            <span className="material-symbols-outlined text-[20px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>
      
      {error && <div className="p-4 bg-error/10 text-error rounded-xl text-sm border border-error/20">⚠️ {error}</div>}

      {!analysis && !isAnalyzing && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">psychology</span>
          <p className="text-on-surface-variant font-body-lg">모임의 모든 기록을 종합하여 인사이트를 도출합니다.</p>
          <button onClick={handleAnalyze} disabled={notes.length === 0} className="primary-gradient-btn px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 hover:scale-[0.98] transition-all shadow-lg disabled:opacity-50">
            <span className="material-symbols-outlined">analytics</span>
            AI 분석 시작
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-bold">인사이트 분석 중... (약 10~20초 소요)</p>
        </div>
      )}

      {analysis && expanded && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="glass-card-elevated rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary"></div>
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-label-caps text-[10px] border border-primary/20 mb-3 tracking-widest uppercase">요약</span>
            <p className="text-on-surface font-body-lg leading-relaxed text-[15px]">{analysis.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Topics */}
            <div className="glass-card rounded-xl p-6 space-y-4 hover:bg-surface-variant/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary">category</span>
                </div>
                <h4 className="font-bold text-on-surface">핵심 주제</h4>
              </div>
              <div className="space-y-3">
                {analysis.keyTopics.map((t, i) => (
                  <div key={i} className="space-y-1">
                    <p className="font-semibold text-on-surface text-sm flex items-start gap-2">
                      <span className="text-secondary shrink-0">•</span> {t.topic}
                    </p>
                    <p className="text-xs text-on-surface-variant pl-4 leading-relaxed">{t.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Grounds */}
            <div className="glass-card rounded-xl p-6 space-y-4 hover:bg-surface-variant/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400">handshake</span>
                </div>
                <h4 className="font-bold text-on-surface">공통 의견</h4>
              </div>
              <ul className="space-y-2">
                {analysis.commonGrounds.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span className="leading-relaxed">{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Different Views */}
            {analysis.differentViews.length > 0 && (
              <div className="glass-card rounded-xl p-6 space-y-4 hover:bg-surface-variant/20 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-error">alt_route</span>
                  </div>
                  <h4 className="font-bold text-on-surface">다른 시각</h4>
                </div>
                <ul className="space-y-2">
                  {analysis.differentViews.map((v, i) => (
                    <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                      <span className="text-error shrink-0">⚡</span>
                      <span className="leading-relaxed">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Questions / Action Items */}
            <div className="glass-card rounded-xl p-6 space-y-6 hover:bg-surface-variant/20 transition-all md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">task_alt</span>
                    </div>
                    <h4 className="font-bold text-on-surface">실천 항목</h4>
                  </div>
                  <ul className="space-y-2">
                    {analysis.actionItems.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                        <span className="text-primary shrink-0">→</span>
                        <span className="leading-relaxed">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-purple-400">help</span>
                    </div>
                    <h4 className="font-bold text-on-surface">다음 논의 질문</h4>
                  </div>
                  <ul className="space-y-2">
                    {analysis.nextQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-on-surface-variant">
                        <span className="text-purple-400 shrink-0 font-bold">Q.</span>
                        <span className="leading-relaxed">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              재분석
            </button>
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

  const [session, setSession] = useState<UserSession | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const s = getLocalSession();
    if (!s) { router.push('/'); return; }
    setSession(s);
  }, [router]);

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
          return;
        }
        const res = await fetch(`/api/meetings/${meetingId}/report`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMeeting(data.meeting);
        setParticipants(data.participants || []);
        setNotes(data.notes || []);
        const map: Record<string, Reaction[]> = {};
        for (const r of data.reactions || []) {
          if (!map[r.note_id]) map[r.note_id] = [];
          map[r.note_id].push(r);
        }
        setReactions(map);
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [session, meetingId]);

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
        <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl space-y-4">
          <p className="text-4xl">😕</p>
          <h2 className="text-lg font-bold">리포트를 불러올 수 없습니다</h2>
          <p className="text-zinc-400 text-sm">{errorMsg}</p>
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
  const isCreator = session?.id === meeting.created_by;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Background glow orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/10 blur-[150px] pointer-events-none rounded-full"></div>

      <header className="sticky top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10 print:hidden">
        <div className="flex justify-between items-center px-gutter py-base max-w-container-max mx-auto h-20">
          <div className="flex items-center gap-4">
            <Link href={`/meetings/${meetingId}`} className="material-symbols-outlined text-primary hover:bg-surface-variant p-2 rounded-full transition-colors active:scale-95 duration-200">
              arrow_back
            </Link>
            <h1 className="font-headline-md text-[20px] md:text-[28px] font-bold text-on-surface tracking-tighter hidden sm:block">
              모임 리포트
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-full glass-card hover:bg-surface-variant transition-colors text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'share'}</span>
              <span className="hidden sm:inline">{copied ? '복사됨!' : '공유하기'}</span>
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-bold">
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span className="hidden sm:inline">인쇄</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-container-max mx-auto px-gutter py-8 space-y-12 print:py-0 print:px-0 relative min-h-screen">

        {/* Cover */}
        <section className="glass-card-elevated rounded-3xl p-8 relative overflow-hidden group border border-outline-variant/20 shadow-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary"></div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary opacity-80 text-sm">topic</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">MINDWEAVE Report</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold leading-tight text-on-surface tracking-tight">{meeting.title}</h1>
              <p className="text-on-surface-variant font-body-lg leading-relaxed max-w-2xl">{meeting.topic}</p>
              {meeting.description && <p className="text-sm text-on-surface-variant/70 leading-relaxed mt-2 max-w-2xl">{meeting.description}</p>}
              
              <div className="flex flex-wrap gap-4 pt-4 text-xs font-semibold text-on-surface-variant">
                <span className="flex items-center gap-1.5 bg-surface-variant px-3 py-1.5 rounded-full"><span className="material-symbols-outlined text-[14px]">event</span>{formattedDate}</span>
                <span className="flex items-center gap-1.5 bg-surface-variant px-3 py-1.5 rounded-full font-mono"><span className="material-symbols-outlined text-[14px]">key</span>{meeting.invite_code}</span>
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
        <AIAnalysisSection meetingId={meetingId} notes={notes} isCreator={isCreator} />

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type Distribution */}
          {notes.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                기록 유형 분포
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {NOTE_TYPES.map(t => {
                  const count = notes.filter(n => n.note_type === t.value).length;
                  const pct = notes.length > 0 ? Math.round((count / notes.length) * 100) : 0;
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
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                <span className="material-symbols-outlined text-secondary">bar_chart</span>
                기여도
              </h3>
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {topAuthors.map((a, i) => (
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
                        <div key={note.id} className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors group">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center font-bold text-[10px] text-on-surface uppercase shadow-sm">
                                {note.author_name.slice(0, 1)}
                              </div>
                              <span className="text-xs font-bold text-on-surface">{note.author_name}</span>
                            </div>
                            <span className="text-[10px] text-on-surface-variant font-mono">{new Date(note.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{note.content}</p>
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
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase font-bold">MINDWEAVE AI Collaboration Platform • {formattedDate}</p>
        </footer>
      </main>
    </>
  );
}
