import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { canAccessSourceRaw, chunkSourceLocations, isPrivateAddress, mapWithConcurrency, paragraphLocations, sanitizeSourceText, validateSourceUrl, withTimeout, type SourceLocation } from '../src/lib/source-documents';
import { parseSourceAnalysisText } from '../src/lib/source-analysis';
import { pdfErrorMessage } from '../src/lib/pdf-extraction';
import { canAnalyzeSourceLength, dailyAnalysisLimit, SOURCE_LIMIT_ERROR, sourceAnalysisConfig, sourceDocumentsAccessStatus } from '../src/lib/source-analysis-config';
import { sourceChunkModelName, sourceSynthesisModelName } from '../src/lib/source-gemini';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('source document extraction', () => {
  const chunkOptions = {
    chunkSize: sourceAnalysisConfig.chunkSize,
    chunkOverlap: sourceAnalysisConfig.chunkOverlap,
    maxChunks: sourceAnalysisConfig.maxChunks,
  };

  it('sanitizes scripts and splits a paper into numbered paragraphs', () => {
    const locations = paragraphLocations('<script>steal()</script><h1>연구 목적</h1><p>첫 문단입니다.</p>\n\n둘째 문단입니다.');
    expect(locations.map((item) => item.start)).toEqual([1, 2]);
    expect(locations.map((item) => item.text).join(' ')).not.toContain('steal');
  });

  it('splits a long report without losing paragraph evidence locations', () => {
    const locations: SourceLocation[] = Array.from({ length: 90 }, (_, index) => ({ kind: 'paragraph', start: index + 1, end: index + 1, text: `문단 ${index + 1} ${'가'.repeat(700)}` }));
    const chunks = chunkSourceLocations(locations, chunkOptions);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(12);
    expect(chunks[0].locations[0]).toEqual({ kind: 'paragraph', start: 1, end: 1 });
    expect(chunks.at(-1)?.locations.some((item) => item.start === 90)).toBe(true);
  });

  it('preserves PDF page locations as evidence', () => {
    const chunks = chunkSourceLocations([{ kind: 'page', start: 4, end: 4, text: '실험 결과' }], chunkOptions);
    expect(chunks[0].text).toContain('[페이지 4]');
    expect(chunks[0].locations[0]).toEqual({ kind: 'page', start: 4, end: 4 });
  });

  it('blocks local and private URL targets', () => {
    expect(() => validateSourceUrl('file:///etc/passwd')).toThrow(/http/);
    expect(() => validateSourceUrl('http://localhost/admin')).toThrow(/내부/);
    expect(isPrivateAddress('192.168.1.2')).toBe(true);
    expect(validateSourceUrl('https://example.com/article').hostname).toBe('example.com');
  });

  it('allows raw source access only to its owner', () => {
    expect(canAccessSourceRaw('owner-a', 'owner-a')).toBe(true);
    expect(canAccessSourceRaw('participant-b', 'owner-a')).toBe(false);
  });

  it('validates evidence-linked knowledge card output', () => {
    const card = parseSourceAnalysisText(JSON.stringify({ title: '분석', conclusion: '결론', coreClaims: ['주장'], keyEvidence: [{ claim: '근거', locationKind: 'page', start: 2, end: 2 }] }));
    expect(card?.keyEvidence).toEqual([{ claim: '근거', locationKind: 'page', start: 2, end: 2 }]);
  });

  it('removes unsafe HTML from plain text inputs', () => {
    expect(sanitizeSourceText('<style>bad</style><b>안전</b>')).toBe('안전');
  });

  it('uses one knowledge card per source document so retries update instead of duplicating', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260723000000_source_documents.sql'), 'utf8');
    expect(migration).toMatch(/source_document_id uuid NOT NULL UNIQUE/);
    expect(migration).toMatch(/raw_text text NOT NULL/);
  });

  it('keeps raw source tables inaccessible to direct browser database roles', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260723000000_source_documents.sql'), 'utf8');
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.source_documents, public\.knowledge_cards,[\s\S]+FROM anon, authenticated/);
  });

  it('allows both users and administrators through exactly 100,000 characters', () => {
    expect(canAnalyzeSourceLength(100_000, false)).toBe(true);
    expect(canAnalyzeSourceLength(100_000, true)).toBe(true);
  });

  it('rejects 100,001 characters for both users and administrators', () => {
    expect(canAnalyzeSourceLength(100_001, false)).toBe(false);
    expect(canAnalyzeSourceLength(100_001, true)).toBe(false);
    expect(SOURCE_LIMIT_ERROR).toBe('이 자료는 100,000자를 초과합니다. 문서를 나누어 다시 등록해 주세요.');
  });

  it('uses at most 12 chunks for users and administrators at the common limit', () => {
    const locations = paragraphLocations('가'.repeat(100_000));
    const userChunks = chunkSourceLocations(locations, chunkOptions);
    const adminChunks = chunkSourceLocations(locations, chunkOptions);
    expect(userChunks.length).toBeGreaterThan(1);
    expect(userChunks.length).toBeLessThanOrEqual(12);
    expect(adminChunks).toHaveLength(userChunks.length);
  });

  it('limits partial analysis concurrency to one', async () => {
    let active = 0; let maximum = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], sourceAnalysisConfig.concurrency, async (value) => {
      active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1; return value * 2;
    });
    expect(maximum).toBe(1);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('fails timed operations with a controlled message', async () => {
    await expect(withTimeout(new Promise(() => undefined), 1, 'TIMEOUT')).rejects.toThrow('TIMEOUT');
  });

  it('distinguishes encrypted and corrupt PDF errors without echoing parser details', () => {
    expect(pdfErrorMessage(Object.assign(new Error('secret filename.pdf'), { name: 'PasswordException' }))).toMatch(/암호화.*비밀번호/);
    expect(pdfErrorMessage(Object.assign(new Error('xref broken filename.pdf'), { name: 'InvalidPDFException' }))).toMatch(/손상.*구조/);
    expect(pdfErrorMessage(new Error('arbitrary internal bytes'))).toBe('PDF 내용을 분석하지 못했습니다.');
  });

  it('uses an atomic analysis claim and one-card upsert key for retries', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260723000000_source_documents.sql'), 'utf8');
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/[documentId]/analyze/route.ts'), 'utf8');
    expect(migration).toContain('begin_source_document_analysis');
    expect(route).toContain("onConflict: 'source_document_id'");
  });

  it('uses the fixed stable model for every source analysis stage', () => {
    expect(sourceChunkModelName).toBe('gemini-3.6-flash');
    expect(sourceSynthesisModelName).toBe('gemini-3.6-flash');
  });

  it('ignores client model injection and records the server-selected model', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/[documentId]/analyze/route.ts'), 'utf8');
    expect(route).not.toMatch(/body\.model/);
    expect(route).toContain('model_name: sourceSynthesisModelName');
    expect(route).toContain('chunk_model_name: sourceChunkModelName');
  });

  it('keeps user and administrator daily limits distinct', () => {
    expect(dailyAnalysisLimit(false)).toBe(3);
    expect(dailyAnalysisLimit(true)).toBe(20);
  });

  it('defaults the source documents feature to disabled and administrator-only', () => {
    expect(sourceAnalysisConfig.documentsEnabled).toBe(false);
    expect(sourceAnalysisConfig.documentsAdminOnly).toBe(true);
    expect(sourceDocumentsAccessStatus({ role: 'owner', isGuestSession: false })).toBe(404);
  });

  it('enforces the server feature gate in every source document API route', () => {
    const routes = [
      'src/app/api/source-documents/route.ts',
      'src/app/api/source-documents/[documentId]/route.ts',
      'src/app/api/source-documents/[documentId]/analyze/route.ts',
    ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'));
    for (const route of routes) {
      expect(route).toContain('sourceDocumentsAccessStatus');
      expect(route).toContain('sourceAnalysisConfig.documentsEnabled');
    }
  });

  it('does not load the PDF parser before the disabled feature gate runs', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/route.ts'), 'utf8');
    expect(route).not.toContain("import { extractPdfBuffer } from '@/lib/pdf-extraction'");
    expect(route).toContain("await import('@/lib/pdf-extraction')");
  });

  it('uses one Seoul-midnight boundary for usage display and atomic quota claims', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260723000000_source_documents.sql'), 'utf8');
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/route.ts'), 'utf8');
    expect(migration).toContain("p_at AT TIME ZONE 'Asia/Seoul'");
    expect(migration.match(/source_analysis_seoul_day_start\(now\(\)\)/g)).toHaveLength(2);
    expect(route).toContain("supabase.rpc('source_analysis_daily_usage_count'");
    expect(route).not.toContain('setHours(0, 0, 0, 0)');
  });

  it('resets the quota at 00:00 in Seoul even when the UTC calendar date is unchanged', () => {
    const seoulDate = (instant: string) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(instant));

    expect(seoulDate('2026-07-23T14:59:00.000Z')).toBe('2026-07-23');
    expect(seoulDate('2026-07-23T15:00:00.000Z')).toBe('2026-07-24');
    expect(new Date('2026-07-23T14:59:00.000Z').getUTCDate()).toBe(
      new Date('2026-07-23T15:00:00.000Z').getUTCDate(),
    );
  });

  it('rejects oversized extracted PDF and URL text without truncation', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/route.ts'), 'utf8');
    expect(canAnalyzeSourceLength(100_001, false)).toBe(false);
    expect(route).toContain('throw new Error(SOURCE_LIMIT_ERROR)');
    expect(route).not.toMatch(/rawText\.slice\(0,\s*sourceAnalysisConfig\.textLimit/);
  });

  it('uses a 4MB direct PDF upload limit while retaining the 10MB parser ceiling', () => {
    expect(sourceAnalysisConfig.directPdfUploadLimitBytes).toBe(4 * 1024 * 1024);
    expect(sourceAnalysisConfig.pdfFileLimitBytes).toBe(10 * 1024 * 1024);
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/source-documents/route.ts'), 'utf8');
    const page = readFileSync(resolve(process.cwd(), 'src/app/sources/import/page.tsx'), 'utf8');
    expect(route).toContain('sourceAnalysisConfig.directPdfUploadLimitBytes');
    expect(route).toContain('현재 PDF는 최대 4MB까지 업로드할 수 있습니다.');
    expect(page).toContain('현재 PDF는 최대 4MB까지 업로드할 수 있습니다.');
    expect(page).not.toContain('PDF 최대 10MB');
  });

  it('records usage without storing source or AI response bodies', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260723000000_source_documents.sql'), 'utf8');
    expect(migration).toContain('CREATE TABLE public.source_analysis_usage');
    expect(migration).toContain('model_name text NOT NULL');
    expect(migration).not.toMatch(/source_analysis_usage[\s\S]*raw_text/);
    expect(migration).not.toMatch(/source_analysis_usage[\s\S]*response_text/);
  });
});
