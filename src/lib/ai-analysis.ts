export interface ClientAnalysis {
  id?: unknown;
  status: string;
  title: string;
  conclusion: string;
  supportingIdeas: string[];
  opposingIdeas: string[];
  newInsight: string;
  unresolvedQuestions: string[];
  actionItems: string[];
}

export interface AnalysisPayload {
  title: string;
  conclusion: string;
  supportingIdeas: string[];
  opposingIdeas: string[];
  newInsight: string;
  unresolvedQuestions: string[];
  actionItems: string[];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Accept only the JSON contract requested from Gemini. This prevents malformed
 * provider output from being persisted as a report that looks valid to clients.
 */
export function parseAnalysisPayload(value: unknown): AnalysisPayload | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const title = record.title;
  const conclusion = record.conclusion;

  if (typeof title !== 'string' || title.trim().length === 0) return null;
  if (typeof conclusion !== 'string' || conclusion.trim().length === 0) return null;

  return {
    title: title.trim(),
    conclusion: conclusion.trim(),
    supportingIdeas: stringList(record.supportingIdeas),
    opposingIdeas: stringList(record.opposingIdeas),
    newInsight: typeof record.newInsight === 'string' ? record.newInsight.trim() : '',
    unresolvedQuestions: stringList(record.unresolvedQuestions),
    actionItems: stringList(record.actionItems),
  };
}

/**
 * Gemini is asked for JSON, but a provider can still wrap it in a markdown
 * fence or include a byte-order mark. Normalize those harmless variations
 * before validating the same strict payload contract used for persistence.
 */
export function parseAnalysisText(text: string): AnalysisPayload | null {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const candidates = [normalized];
  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = normalized.slice(firstBrace, lastBrace + 1);
    if (extracted !== normalized) candidates.push(extracted);
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const analysis = parseAnalysisPayload(parsed);
      if (analysis) return analysis;
    } catch {
      // A format retry is handled by the server route without logging content.
    }
  }

  return null;
}

export function toClientAnalysis(knowledge: object): ClientAnalysis {
  const record = knowledge as Record<string, unknown>;
  return {
    id: record.id,
    status: typeof record.status === 'string' ? record.status : 'draft',
    title: typeof record.title === 'string' ? record.title : '',
    conclusion: typeof record.conclusion === 'string' ? record.conclusion : '',
    supportingIdeas: stringList(record.supportingIdeas ?? record.supporting_ideas),
    opposingIdeas: stringList(record.opposingIdeas ?? record.opposing_ideas),
    newInsight: typeof (record.newInsight ?? record.new_insight) === 'string'
      ? (record.newInsight ?? record.new_insight) as string
      : '',
    unresolvedQuestions: stringList(record.unresolvedQuestions ?? record.unresolved_questions),
    actionItems: stringList(record.actionItems ?? record.action_items),
  };
}
