export interface JournalLexicalEntry {
  id: string;
  title?: string | null;
  content?: string | null;
  mood?: string | null;
  tags?: string[] | null;
  updated_at?: number | null;
  created_at?: number | null;
}

export interface JournalLexicalSearchResult {
  entry_id: string;
  similarity: number;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function tokenize(text: string): string[] {
  const matches =
    text
      .toLowerCase()
      .normalize("NFKC")
      .match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return matches.filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEncryptedJournalContent(content: string | null | undefined): boolean {
  return Boolean(content?.startsWith("encrypted-entry:"));
}

function countTermHits(text: string, terms: Set<string>): number {
  const tokens = tokenize(text);
  let hits = 0;
  for (const token of tokens) {
    if (terms.has(token)) hits += 1;
  }
  return hits;
}

function scoreEntry(entry: JournalLexicalEntry, query: string, terms: Set<string>): number {
  const title = stripHtml(entry.title ?? "");
  const content = isEncryptedJournalContent(entry.content) ? "" : stripHtml(entry.content ?? "");
  const mood = entry.mood ?? "";
  const tags = Array.isArray(entry.tags) ? entry.tags.join(" ") : "";
  const normalizedQuery = query.toLowerCase();

  let score = 0;
  score += countTermHits(title, terms) * 4;
  score += countTermHits(tags, terms) * 3;
  score += countTermHits(mood, terms) * 2;
  score += countTermHits(content, terms) * 2;

  if (title.toLowerCase().includes(normalizedQuery)) score += 5;
  if (content.toLowerCase().includes(normalizedQuery)) score += 3;
  if (tags.toLowerCase().includes(normalizedQuery)) score += 3;

  return score;
}

export function searchJournalEntriesLexically(
  entries: JournalLexicalEntry[],
  query: string,
  limit = 10
): JournalLexicalSearchResult[] {
  const cleanedQuery = query.trim();
  const queryTerms = new Set(tokenize(cleanedQuery));
  if (!cleanedQuery || queryTerms.size === 0) return [];

  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit || 10)));
  const maxScore = Math.max(1, queryTerms.size * 6);

  return entries
    .map((entry) => {
      const score = scoreEntry(entry, cleanedQuery, queryTerms);
      const recency = Number(entry.updated_at ?? entry.created_at ?? 0);
      return { entry, score, recency };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.recency - a.recency)
    .slice(0, safeLimit)
    .map(({ entry, score }) => ({
      entry_id: entry.id,
      similarity: Number(Math.min(0.99, score / maxScore).toFixed(4)),
    }));
}
