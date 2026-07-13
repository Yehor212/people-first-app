import type { TranslationStrings } from "@/i18n/types";

type JournalDisplayTranslations = Partial<
  Pick<TranslationStrings, "orbCapturedAt" | "orbScopeDay" | "orbScopeSpecific">
>;

const LEGACY_CAPTURED_AT_RE = /^Captured at\s+[0-9]{1,2}:\d{2}(?:\s?[AP]M)?$/i;
const LEGACY_SCOPE_DAY_RE = /^For the whole day$/i;
const LEGACY_SCOPE_SPECIFIC_RE =
  /^At a specific time(?:\s*[-–]\s*[0-9]{1,2}:\d{2}(?:\s?[AP]M)?)?$/i;
const LEGACY_METADATA_HTML_RE =
  /^\s*<p>\s*<strong>\s*(?:Captured at\s+[0-9]{1,2}:\d{2}(?:\s?[AP]M)?|For the whole day|At a specific time(?:\s*[-–]\s*[0-9]{1,2}:\d{2}(?:\s?[AP]M)?)?)\s*<\/strong>\s*<\/p>\s*/i;
const LEGACY_METADATA_TEXT_RE =
  /^\s*(?:Captured at\s+[0-9]{1,2}:\d{2}(?:\s?[AP]M)?|For the whole day|At a specific time(?:\s*[-–]\s*[0-9]{1,2}:\d{2}(?:\s?[AP]M)?)?)\s*(?:\n+|$)/i;

function decodeHtmlEntities(value: string): string {
  const textarea = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (textarea) {
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isLegacyMetadataLine(line: string): boolean {
  const normalized = line.replace(/\s+/g, " ").trim();
  return (
    LEGACY_CAPTURED_AT_RE.test(normalized) ||
    LEGACY_SCOPE_DAY_RE.test(normalized) ||
    LEGACY_SCOPE_SPECIFIC_RE.test(normalized)
  );
}

function stripLegacyMetadataText(value: string): string {
  let next = value;
  for (let i = 0; i < 3; i += 1) {
    const stripped = next.replace(LEGACY_METADATA_TEXT_RE, "");
    if (stripped === next) break;
    next = stripped;
  }
  return next.trim();
}

export function stripLegacyJournalMetadataHtml(content: string): string {
  let next = content;
  for (let i = 0; i < 3; i += 1) {
    const stripped = next.replace(LEGACY_METADATA_HTML_RE, "");
    if (stripped === next) break;
    next = stripped;
  }
  return stripLegacyMetadataText(next);
}

export function journalHtmlToPlainText(content: string): string {
  const withLineBreaks = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withLineBreaks)
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function formatCapturedAtLabel(time: string, ts: JournalDisplayTranslations): string {
  return (ts.orbCapturedAt || "Captured at {time}").replace("{time}", time);
}

function localizeGeneratedPreview(preview: string, ts: JournalDisplayTranslations): string {
  return preview
    .replace(/^Captured at\s+([0-9]{1,2}:\d{2}(?:\s?[AP]M)?)\b/i, (_match, time: string) =>
      formatCapturedAtLabel(time, ts)
    )
    .replace(/^For the whole day\b/i, ts.orbScopeDay || "For the whole day")
    .replace(
      /^At a specific time\s*[-–]\s*([0-9]{1,2}:\d{2}(?:\s?[AP]M)?)\b/i,
      (_match, time: string) => `${ts.orbScopeSpecific || "At a specific time"} - ${time}`
    )
    .trim();
}

export function getJournalDisplayTag(value: string): string {
  return value.trim().replace(/^#+/, "").trim();
}

export function getJournalDisplayTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const displayTags: string[] = [];

  for (const rawTag of tags) {
    const tag = getJournalDisplayTag(rawTag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    displayTags.push(tag);
  }

  return displayTags;
}

export function getJournalDisplayText(
  content: string,
  _ts: JournalDisplayTranslations = {}
): string {
  const plain = journalHtmlToPlainText(stripLegacyJournalMetadataHtml(content));
  return plain
    .split("\n")
    .filter((line, index) => index !== 0 || !isLegacyMetadataLine(line))
    .join("\n")
    .trim();
}

export function getJournalPreviewText(
  content: string,
  ts: JournalDisplayTranslations = {}
): string {
  return localizeGeneratedPreview(journalHtmlToPlainText(content), ts).replace(/\s+/g, " ").trim();
}

export function getJournalEditorContent(content: string): string {
  return stripLegacyJournalMetadataHtml(content);
}
