import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\report\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update AIAnalysis interface to include status
content = content.replace('interface AIAnalysis {', 'interface AIAnalysis {\n  status?: string;')

# 2. Update AIAnalysisSection Props
content = content.replace(
    'function AIAnalysisSection({\n  meetingId, notes, isCreator,\n}: {\n  meetingId: string;\n  notes: Note[];\n  isCreator: boolean;\n}) {',
    'function AIAnalysisSection({\n  meetingId, notes, isCreator, initialAnalysis\n}: {\n  meetingId: string;\n  notes: Note[];\n  isCreator: boolean;\n  initialAnalysis?: AIAnalysis | null;\n}) {'
)

# 3. Replace AIAnalysisSection localStorage hooks and logic
old_logic = """  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
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

      const res = await apiFetch(`/api/meetings/${meetingId}/analyze`, {
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
  };"""

new_logic = """  const [analysis, setAnalysis] = useState<AIAnalysis | null>(initialAnalysis || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  
  // Update state when initial analysis changes
  useEffect(() => {
    if (initialAnalysis) setAnalysis(initialAnalysis);
  }, [initialAnalysis]);

  const handleAnalyze = async () => {
    if (notes.length === 0) {
      setError('분석할 기록이 없습니다.');
      return;
    }
    setIsAnalyzing(true);
    setError('');
    try {
      const body: any = { meetingId };
      if (!isSupabaseConfigured) {
        body.notes = notes.map(n => ({ author_name: n.author_name, note_type: n.note_type, content: n.content }));
      }
      const res = await apiFetch(`/api/meetings/${meetingId}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 분석 실패');
      setAnalysis({ ...data.analysis, status: 'draft' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublish = async () => {
    if (!analysis) return;
    setIsPublishing(true);
    try {
      const res = await apiFetch(`/api/meetings/${meetingId}/analyze`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '공개 실패');
      setAnalysis({ ...analysis, status: 'published' });
      alert('성공적으로 공개되었습니다!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };"""

content = content.replace(old_logic, new_logic)

# 4. Add Publish button to AIAnalysisSection
publish_button_html = """          <div className="flex justify-end pt-2 gap-3">
            {analysis.status === 'draft' && (
              <button onClick={handlePublish} disabled={isPublishing} className="text-xs font-semibold text-white bg-primary px-4 py-2 rounded-full hover:scale-105 transition-all shadow-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">public</span>
                {isPublishing ? '공개 중...' : '참여자에게 공개하기'}
              </button>
            )}
            <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              재분석
            </button>
          </div>"""

# Replace the old refresh button
content = content.replace("""          <div className="flex justify-end pt-2">
            <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              재분석
            </button>
          </div>""", publish_button_html)

# 5. Add initialAnalysis to state in ReportPage
content = content.replace(
    "const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'guest'>('guest');",
    "const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'guest'>('guest');\n  const [initialAnalysis, setInitialAnalysis] = useState<AIAnalysis | null>(null);"
)

# 6. Extract AI report from GET API response
report_extract = """        setCurrentUserRole(data.currentUserRole || 'guest');
        if (data.aiReport) {
          setInitialAnalysis({
            status: data.aiReport.status,
            summary: data.aiReport.summary,
            keyTopics: data.aiReport.core_topics || [],
            commonGrounds: data.aiReport.common_ideas || [],
            differentViews: data.aiReport.different_ideas || [],
            nextQuestions: data.aiReport.new_questions || [],
            actionItems: data.aiReport.action_items || []
          });
        }"""
content = content.replace("setCurrentUserRole(data.currentUserRole || 'guest');", report_extract)

# 7. Update usage of AIAnalysisSection in main component
ai_section_usage = """        {/* AI Analysis */}
        {currentUserRole === 'owner' ? (
          <AIAnalysisSection meetingId={meetingId} notes={notes} isCreator={isCreator} initialAnalysis={initialAnalysis} />
        ) : initialAnalysis ? (
          <AIAnalysisSection meetingId={meetingId} notes={notes} isCreator={isCreator} initialAnalysis={initialAnalysis} />
        ) : (
          <div className="glass-card rounded-2xl p-6 flex items-center justify-center text-center space-y-4">
             <p className="text-sm text-on-surface-variant">진행자가 AI 리포트를 공개하면 이 위치에 나타납니다.</p>
          </div>
        )}"""

old_ai_section_usage = """        {/* AI Analysis */}
        {currentUserRole === 'owner' ? (
          <AIAnalysisSection meetingId={meetingId} notes={notes} isCreator={isCreator} />
        ) : (
          <div className="glass-card rounded-2xl p-6 flex items-center justify-center text-center space-y-4">
             <p className="text-sm text-on-surface-variant">진행자가 AI 리포트를 공개하면 이 위치에 나타납니다.</p>
          </div>
        )}"""

content = content.replace(old_ai_section_usage, ai_section_usage)

# 8. Add download markdown function
markdown_func = """  const handleDownloadMarkdown = () => {
    if (!initialAnalysis || !meeting) return;
    const md = `# ${meeting.title}\\n\\n**주제**: ${meeting.topic}\\n**날짜**: ${new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString('ko-KR')}\\n\\n## 요약\\n${initialAnalysis.summary}\\n\\n## 핵심 주제\\n${initialAnalysis.keyTopics.map(t => `- **${t.topic}**: ${t.description}`).join('\\n')}\\n\\n## 공통 의견\\n${initialAnalysis.commonGrounds.map(i => `- ${i}`).join('\\n')}\\n\\n## 다른 시각\\n${initialAnalysis.differentViews.map(i => `- ${i}`).join('\\n')}\\n\\n## 실천 항목\\n${initialAnalysis.actionItems.map(i => `- ${i}`).join('\\n')}\\n\\n## 다음 논의 질문\\n${initialAnalysis.nextQuestions.map(i => `- ${i}`).join('\\n')}\\n`;
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
"""

content = content.replace('const handleShare = async () => {', markdown_func + '\n  const handleShare = async () => {')

# 9. Add Markdown button to header
markdown_btn = """            {initialAnalysis?.status === 'published' && (
              <button onClick={handleDownloadMarkdown} className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-variant hover:bg-surface-variant/80 transition-colors text-sm font-bold">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span className="hidden sm:inline">MD 다운로드</span>
              </button>
            )}
            <button onClick={handleShare}"""

content = content.replace('<button onClick={handleShare}', markdown_btn)


with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\report\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Report page patched successfully.")
