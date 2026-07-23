import 'server-only';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  return Math.min(positiveInteger(value, fallback), maximum);
}

function modelName(value: string | undefined): string {
  const candidate = value?.trim();
  return candidate && /^[a-z0-9][a-z0-9._-]{2,80}$/i.test(candidate) ? candidate : 'gemini-3.6-flash';
}

export const sourceAnalysisConfig = Object.freeze({
  documentsEnabled: process.env.SOURCE_DOCUMENTS_ENABLED === 'true',
  documentsAdminOnly: process.env.SOURCE_DOCUMENTS_ADMIN_ONLY !== 'false',
  textLimit: boundedInteger(process.env.SOURCE_TEXT_LIMIT, 100_000, 100_000),
  directPdfUploadLimitBytes: 4 * 1024 * 1024,
  pdfFileLimitBytes: 10 * 1024 * 1024,
  webpageDownloadLimitBytes: 2 * 1024 * 1024,
  pdfPageLimit: 300,
  pdfParseTimeoutMs: 20_000,
  chunkSize: 12_000,
  chunkOverlap: 500,
  maxChunks: boundedInteger(process.env.SOURCE_ANALYSIS_MAX_CHUNKS, 12, 12),
  concurrency: boundedInteger(process.env.SOURCE_ANALYSIS_CONCURRENCY, 1, 1),
  maxRetries: boundedInteger(process.env.SOURCE_ANALYSIS_MAX_RETRIES, 2, 2),
  dailyLimitUser: positiveInteger(process.env.SOURCE_ANALYSIS_DAILY_LIMIT_USER, 3),
  dailyLimitAdmin: positiveInteger(process.env.SOURCE_ANALYSIS_DAILY_LIMIT_ADMIN, 20),
  chunkModel: modelName(process.env.SOURCE_CHUNK_ANALYSIS_MODEL),
  synthesisModel: modelName(process.env.SOURCE_SYNTHESIS_MODEL),
  promptVersion: 'source-analysis-v1',
  schemaVersion: 'source-knowledge-card-v1',
  paused: process.env.SOURCE_ANALYSIS_PAUSED === 'true',
});

export interface SourceDocumentsUser {
  role: string;
  isGuestSession: boolean;
}

export function sourceDocumentsAccessStatus(user: SourceDocumentsUser | null): 200 | 401 | 403 | 404 {
  if (!sourceAnalysisConfig.documentsEnabled) return 404;
  if (!user) return 401;
  if (user.isGuestSession) return 403;
  if (sourceAnalysisConfig.documentsAdminOnly && user.role !== 'owner') return 403;
  return 200;
}

export const SOURCE_LIMIT_ERROR = '이 자료는 100,000자를 초과합니다. 문서를 나누어 다시 등록해 주세요.';

export function dailyAnalysisLimit(isAdmin: boolean): number {
  return isAdmin ? sourceAnalysisConfig.dailyLimitAdmin : sourceAnalysisConfig.dailyLimitUser;
}

export function canAnalyzeSourceLength(characterCount: number, _isAdmin: boolean): boolean {
  void _isAdmin;
  return characterCount >= 0 && characterCount <= sourceAnalysisConfig.textLimit;
}
