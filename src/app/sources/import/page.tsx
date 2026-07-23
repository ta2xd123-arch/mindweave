'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Globe, RefreshCw, Save, Sparkles, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getLocalSession } from '@/lib/auth';
import { type SourceInputType } from '@/lib/source-documents';

interface SourceDocumentSummary { id: string; meeting_id?: string; title: string; author: string; source_name: string; input_type: SourceInputType; analysis_status: 'stored'|'analyzing'|'complete'|'failed'; analysis_error?: string; analysis_attempt_count: number }
interface MeetingOption { id: string; title: string; created_by: string }
interface AnalysisPolicy { textLimit: number; pdfLimitBytes: number; chunkSize: number; maxChunks: number; maxRetries: number; dailyLimit: number; remainingToday: number; paused: boolean }

export default function ImportSourcePage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<SourceInputType>('text');
  const [rawText, setRawText] = useState(''); const [url, setUrl] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [sourceName, setSourceName] = useState(''); const [publishedAt, setPublishedAt] = useState(''); const [documentType, setDocumentType] = useState('other');
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [meetings, setMeetings] = useState<MeetingOption[]>([]); const [meetingId, setMeetingId] = useState('');
  const [sharedDocuments, setSharedDocuments] = useState<Record<string, boolean>>({});
  const [policy, setPolicy] = useState<AnalysisPolicy | null>(null);
  const [session] = useState(() => getLocalSession());

  const loadDocuments = async () => {
    const response = await apiFetch('/api/source-documents');
    if (response.ok) {
      const data = await response.json();
      setDocuments(data.documents || []);
      setPolicy(data.policy || null);
    }
  };
  useEffect(() => {
    if (!session?.sourceDocumentsAvailable) { router.replace('/'); return; }
    const initialize = async () => {
      const [documentsResponse, meetingsResponse] = await Promise.all([apiFetch('/api/source-documents'), apiFetch('/api/meetings')]);
      if (documentsResponse.ok) {
        const data = await documentsResponse.json();
        setDocuments(data.documents || []);
        setPolicy(data.policy || null);
      }
      if (meetingsResponse.ok) setMeetings(((await meetingsResponse.json()).meetings || []).filter((meeting: MeetingOption) => meeting.created_by === session.id));
    };
    void initialize();
  }, [router, session]);
  if (!session) return null;

  const saveDocument = async () => {
    setError('');
    if (inputType === 'text' && !rawText.trim()) return setError('가져올 원문을 입력해 주세요.');
    if (inputType === 'url' && !url.trim()) return setError('웹페이지 URL을 입력해 주세요.');
    if (inputType === 'pdf' && !file) return setError('PDF 파일을 선택해 주세요.');
    if (!policy) return setError('자료 정책을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.');
    if (rawText.length > policy.textLimit) return setError('이 자료는 100,000자를 초과합니다. 문서를 나누어 다시 등록해 주세요.');
    if (file && file.size > policy.pdfLimitBytes) return setError('현재 PDF는 최대 4MB까지 업로드할 수 있습니다.');
    setBusy(true);
    try {
      const form = new FormData(); form.set('inputType', inputType); form.set('rawText', rawText); form.set('url', url); if (file) form.set('file', file);
      form.set('title', title); form.set('author', author); form.set('sourceName', sourceName); form.set('publishedAt', publishedAt); form.set('documentType', documentType); form.set('meetingId', meetingId);
      const response = await apiFetch('/api/source-documents', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || '자료를 저장하지 못했습니다.');
      await loadDocuments(); setRawText(''); setUrl(''); setFile(null); setTitle(''); setAuthor('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '자료를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const analyze = async (id: string) => {
    setBusy(true); setError(''); setDocuments((items) => items.map((item) => item.id === id ? { ...item, analysis_status: 'analyzing' } : item));
    try { const response = await apiFetch(`/api/source-documents/${id}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: sharedDocuments[id] ? 'participants' : 'owner' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '분석에 실패했습니다.'); await loadDocuments(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '분석에 실패했습니다.'); await loadDocuments(); }
    finally { setBusy(false); }
  };

  const typeButtons: { value: SourceInputType; label: string; icon: typeof FileText }[] = [{ value: 'text', label: '텍스트 붙여넣기', icon: FileText }, { value: 'pdf', label: 'PDF 업로드', icon: Upload }, { value: 'url', label: '웹페이지 URL', icon: Globe }];
  const overLimit = Boolean(policy && rawText.length > policy.textLimit);
  const expectedChunks = policy ? Math.min(policy.maxChunks, Math.max(1, Math.ceil(rawText.length / policy.chunkSize))) : 0;
  return <div className="min-h-screen bg-[#FAF9F6] text-zinc-800"><header className="sticky top-0 z-10 border-b bg-white/90 mobile-page-x py-4"><div className="max-w-4xl mx-auto flex justify-between"><Link href="/" className="flex gap-2 items-center text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>대시보드</Link><b>MINDWEAVE</b></div></header>
    <main className="max-w-4xl mx-auto mobile-page-x py-7 space-y-6"><section className="rounded-2xl border bg-white p-5 sm:p-8 space-y-5 shadow-sm"><div><h1 className="text-2xl font-bold">외부 자료 가져오기</h1><p className="mt-1 text-sm text-zinc-500">논문, 보고서, 기사, 연구 자료를 원문과 분리된 지식카드로 분석합니다.</p></div>
      <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600"><p>텍스트 최대 100,000자</p><p>현재 PDF는 최대 4MB까지 업로드할 수 있습니다.</p><p>긴 문서는 나누어 등록해 주세요.</p>{policy && <p className="mt-2 font-semibold text-zinc-800">오늘 남은 분석 횟수: {policy.remainingToday}회 / {policy.dailyLimit}회</p>}{policy?.paused && <p className="mt-2 font-semibold text-amber-700">현재 자료 분석이 일시 중단되었습니다.</p>}</div>
      <div className="grid sm:grid-cols-3 gap-2">{typeButtons.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => setInputType(value)} className={`rounded-xl border p-3 flex justify-center gap-2 text-sm font-bold ${inputType === value ? 'border-[#2C4D46] bg-[#2C4D46]/10' : 'border-zinc-200'}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
      {inputType === 'text' && <div><textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={12} placeholder="긴 원문을 붙여넣으세요." className={`w-full rounded-xl border bg-zinc-50 p-4 leading-7 ${overLimit ? 'border-red-500' : ''}`}/><div className="mt-1 flex justify-between text-xs"><span className={overLimit ? 'font-semibold text-red-600' : 'text-zinc-500'}>{overLimit && policy ? `${(rawText.length - policy.textLimit).toLocaleString()}자 초과` : `예상 청크 ${expectedChunks}개`}</span><span className={overLimit ? 'text-red-600' : 'text-zinc-400'}>{rawText.length.toLocaleString()} / {policy?.textLimit.toLocaleString() || '...'}자</span></div></div>}
      {inputType === 'pdf' && <label className="block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer"><Upload className="mx-auto mb-2"/><b>{file?.name || 'PDF 파일 선택'}</b><p className="text-xs text-zinc-500 mt-1">현재 PDF는 최대 4MB까지 업로드할 수 있습니다. · 이미지 전용 PDF는 지원하지 않음</p><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const selected = event.target.files?.[0] || null; if (selected && policy && selected.size > policy.pdfLimitBytes) { setFile(null); setError('현재 PDF는 최대 4MB까지 업로드할 수 있습니다.'); event.target.value = ''; return; } setError(''); setFile(selected); }} className="sr-only"/></label>}
      {inputType === 'url' && <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" className="w-full rounded-xl border p-3"/>}
      <div className="grid sm:grid-cols-2 gap-3"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (PDF/웹 메타데이터 사용 가능)" className="rounded-xl border p-3"/><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="저자" className="rounded-xl border p-3"/><input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="출처/발행처" className="rounded-xl border p-3"/><input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="rounded-xl border p-3"/><select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="rounded-xl border p-3"><option value="paper">논문</option><option value="report">보고서</option><option value="article">기사</option><option value="research">연구 자료</option><option value="other">기타</option></select><select value={meetingId} onChange={(e) => setMeetingId(e.target.value)} className="rounded-xl border p-3"><option value="">모임 연결 안 함</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}</select></div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<button onClick={saveDocument} disabled={busy || !policy || overLimit} className="w-full rounded-xl bg-[#2C4D46] py-3.5 text-white font-bold flex justify-center gap-2 disabled:opacity-50"><Save className="h-4 w-4"/>{busy ? '처리 중...' : '원문 저장'}</button></section>
      <section className="rounded-2xl border bg-white p-5 sm:p-8 space-y-4 shadow-sm"><h2 className="text-xl font-bold">저장된 외부 자료</h2>{documents.length === 0 ? <p className="text-sm text-zinc-500">아직 저장된 자료가 없습니다.</p> : documents.map((document) => <article key={document.id} className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><b>{document.title}</b><p className="text-xs text-zinc-500 mt-1">{document.author || '저자 미상'} · {document.source_name || document.input_type} · {document.analysis_status}</p>{document.analysis_error && <p className="text-xs text-red-600 mt-1">{document.analysis_error}</p>}{document.meeting_id && <label className="mt-2 block text-xs"><input type="checkbox" checked={Boolean(sharedDocuments[document.id])} onChange={(event) => setSharedDocuments((current) => ({ ...current, [document.id]: event.target.checked }))} className="mr-2"/>연결된 모임 참여자에게 분석 결과 공개</label>}</div><button onClick={() => analyze(document.id)} disabled={busy || document.analysis_status === 'analyzing' || !policy || policy.paused || policy.remainingToday <= 0 || document.analysis_attempt_count >= policy.maxRetries + 1} className="rounded-lg border border-[#2C4D46] px-4 py-2 text-sm font-bold flex justify-center gap-2 disabled:opacity-50">{document.analysis_status === 'failed' ? <RefreshCw className="h-4 w-4"/> : <Sparkles className="h-4 w-4"/>}{document.analysis_status === 'complete' ? '다시 분석' : document.analysis_status === 'failed' ? '분석 재시도' : '지식카드 분석'}</button></article>)}</section>
    </main></div>;
}
