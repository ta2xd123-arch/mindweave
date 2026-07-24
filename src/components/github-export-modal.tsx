'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
  markdownContent: string;
}

export function GitHubExportModal({
  isOpen,
  onClose,
  meetingId,
  meetingTitle,
  markdownContent,
}: GitHubExportModalProps) {
  const [repo, setRepo] = useState('ta2xd123-arch/MINDWEAVE-reports');
  const [token, setToken] = useState('');
  const [path, setPath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [successUrl, setSuccessUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const savedRepo = localStorage.getItem('mindweave_github_repo');
    const savedToken = localStorage.getItem('mindweave_github_pat');
    if (savedRepo) setRepo(savedRepo);
    if (savedToken) setToken(savedToken);

    const safeTitle = meetingTitle
      .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const dateStr = new Date().toISOString().slice(0, 10);
    setPath(`reports/${dateStr}_${safeTitle}.md`);
    setError('');
    setSuccessUrl('');
  }, [isOpen, meetingTitle]);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim()) {
      setError('GitHub 저장소 이름을 입력해 주세요 (예: username/repo-name).');
      return;
    }
    if (!token.trim()) {
      setError('GitHub Personal Access Token (PAT)을 입력해 주세요.');
      return;
    }
    if (!path.trim()) {
      setError('저장할 파일 경로를 입력해 주세요.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccessUrl('');

    try {
      localStorage.setItem('mindweave_github_repo', repo.trim());
      localStorage.setItem('mindweave_github_pat', token.trim());

      const res = await apiFetch(`/api/meetings/${meetingId}/export-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repo.trim(),
          token: token.trim(),
          path: path.trim(),
          content: markdownContent,
          message: `Add meeting report: ${meetingTitle}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub 업로드 실패');

      setSuccessUrl(data.fileUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'GitHub 업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card max-w-lg w-full rounded-2xl p-6 space-y-5 bg-surface border border-outline-variant/20 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              🐙
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">GitHub 저장소로 바로 올리기</h3>
              <p className="text-xs text-on-surface-variant">모임 리포트를 내 GitHub 레포지토리에 저장합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-error/10 text-error rounded-xl text-xs border border-error/20 font-medium">
            ⚠️ {error}
          </div>
        )}

        {successUrl ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary text-2xl">
              🎉
            </div>
            <h4 className="text-base font-bold text-on-surface">GitHub 업로드 성공!</h4>
            <p className="text-xs text-on-surface-variant">리포트 파일이 깃허브 저장소에 커밋되었습니다.</p>

            <a
              href={successUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 transition-colors w-full"
            >
              <span>GitHub 파일 확인하기</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>

            <button
              onClick={onClose}
              className="w-full text-xs font-semibold text-on-surface-variant hover:text-on-surface py-2"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleExport} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                GitHub 저장소 (Repository)
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="예: ta2xd123-arch/MINDWEAVE-reports"
                className="w-full rounded-xl bg-surface-variant/40 border border-outline-variant/30 px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                required
              />
              <p className="text-[11px] text-on-surface-variant mt-1">
                아이디/저장소명 형식으로 입력하세요. (예: <code className="text-primary font-mono">ta2xd123-arch/MINDWEAVE-reports</code>)
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-on-surface">
                  GitHub Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=MINDWEAVE+Report+Uploader"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>토큰 새로 발급받기</span>
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </a>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_ 또는 github_pat_..."
                className="w-full rounded-xl bg-surface-variant/40 border border-outline-variant/30 px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                required
              />
              <p className="text-[11px] text-on-surface-variant mt-1">
                <code className="text-primary font-mono">repo</code> 권한이 포함된 토큰을 입력하세요. 입력하신 토큰은 브라우저에만 안전하게 저장됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                저장할 파일 경로 (File Path)
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="reports/2026-07-24_meeting.md"
                className="w-full rounded-xl bg-surface-variant/40 border border-outline-variant/30 px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-5 py-2.5 rounded-full bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>업로드 중...</span>
                  </>
                ) : (
                  <>
                    <span>🐙 GitHub로 바로 커밋 (Push)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
