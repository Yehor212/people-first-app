const LEXICALIZED_CARDINALITY_KEYS = new Set([
  "ar:offlineBannerPending_zero",
  "ar:offlineBannerPending_one",
  "ar:offlineBannerPending_two",
  "he:offlineBannerPending_one",
  "he:offlineBannerPending_two",
]);

export function isAllowedPlaceholderDifference(
  language: string,
  key: string,
  referencePlaceholders: readonly string[],
  localizedPlaceholders: readonly string[],
): boolean {
  return (
    LEXICALIZED_CARDINALITY_KEYS.has(`${language}:${key}`) &&
    referencePlaceholders.length === 1 &&
    referencePlaceholders[0] === "{count}" &&
    localizedPlaceholders.length === 0
  );
}
