export type SourceInputType = 'text' | 'pdf' | 'url';
export type SourceDocumentType = 'paper' | 'report' | 'article' | 'research' | 'other';

export interface SourceLocation { kind: 'page' | 'paragraph'; start: number; end: number; text: string }
export interface SourceChunk { index: number; text: string; locations: Omit<SourceLocation, 'text'>[] }

export function sanitizeSourceText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function paragraphLocations(text: string): SourceLocation[] {
  return sanitizeSourceText(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
    .map((part, index) => ({ kind: 'paragraph' as const, start: index + 1, end: index + 1, text: part }));
}

export interface SourceChunkOptions { chunkSize: number; chunkOverlap: number; maxChunks: number }

export function chunkSourceLocations(locations: SourceLocation[], options: SourceChunkOptions): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  let text = ''; let refs: Omit<SourceLocation, 'text'>[] = [];
  const flush = () => {
    if (!text.trim() || chunks.length >= options.maxChunks) return;
    chunks.push({ index: chunks.length + 1, text: text.trim(), locations: refs });
  };
  for (const location of locations) {
    const label = location.kind === 'page' ? `[페이지 ${location.start}]` : `[문단 ${location.start}]`;
    const available = Math.max(1_000, options.chunkSize - label.length - 2);
    const pieces = location.text.match(new RegExp(`[\\s\\S]{1,${available}}`, 'g')) || [];
    for (const piece of pieces) {
      const section = `${label}\n${piece}`;
      if (text && text.length + section.length > options.chunkSize) {
        flush();
        text = text.slice(-options.chunkOverlap);
        refs = refs.slice(-1);
      }
      text += `${text ? '\n\n' : ''}${section}`;
      refs.push({ kind: location.kind, start: location.start, end: location.end });
      if (chunks.length >= options.maxChunks) break;
    }
    if (chunks.length >= options.maxChunks) break;
  }
  flush();
  return chunks;
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return false;
}

export function validateSourceUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('올바른 웹페이지 URL을 입력해 주세요.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('http 또는 https URL만 지원합니다.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || isPrivateAddress(host)) throw new Error('내부 네트워크 주소는 가져올 수 없습니다.');
  url.username = ''; url.password = ''; url.hash = '';
  return url;
}

export function canAccessSourceRaw(userId: string | undefined, ownerId: string): boolean {
  return Boolean(userId) && userId === ownerId;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); }
  });
  await Promise.all(runners); return results;
}
