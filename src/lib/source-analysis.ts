export interface SourceEvidence { claim: string; locationKind: 'page' | 'paragraph'; start: number; end: number }
export interface SourceKnowledgeCard {
  title: string; coreClaims: string[]; keyEvidence: SourceEvidence[]; researchFindings: string[];
  conclusion: string; limitations: string[]; importantConcepts: string[]; commonWithExisting: string[];
  differentFromExisting: string[]; newQuestions: string[]; actionIdeas: string[];
}

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
const evidence = (value: unknown): SourceEvidence[] => Array.isArray(value) ? value.flatMap((item) => {
  if (!item || typeof item !== 'object') return [];
  const row = item as Record<string, unknown>;
  if (typeof row.claim !== 'string' || !['page', 'paragraph'].includes(String(row.locationKind)) || !Number.isInteger(row.start) || !Number.isInteger(row.end)) return [];
  return [{ claim: row.claim.trim(), locationKind: row.locationKind as SourceEvidence['locationKind'], start: row.start as number, end: row.end as number }];
}) : [];

export function parseSourceKnowledgeCard(value: unknown): SourceKnowledgeCard | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.title !== 'string' || typeof row.conclusion !== 'string' || !row.title.trim()) return null;
  return {
    title: row.title.trim(), coreClaims: strings(row.coreClaims), keyEvidence: evidence(row.keyEvidence),
    researchFindings: strings(row.researchFindings), conclusion: row.conclusion.trim(), limitations: strings(row.limitations),
    importantConcepts: strings(row.importantConcepts), commonWithExisting: strings(row.commonWithExisting),
    differentFromExisting: strings(row.differentFromExisting), newQuestions: strings(row.newQuestions), actionIdeas: strings(row.actionIdeas),
  };
}

export function parseSourceAnalysisText(text: string): SourceKnowledgeCard | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return parseSourceKnowledgeCard(JSON.parse(cleaned)); } catch { return null; }
}
