type JournalQuoteDefinition = {
  translationId: string;
  fallback: string;
};

type JournalQuoteScope = "first-use" | "all";

type JournalQuoteOptions = {
  scope?: JournalQuoteScope;
};

export const JOURNAL_EMPTY_QUOTES: readonly JournalQuoteDefinition[] = [
  { translationId: "quoteJournal1", fallback: "Fill your paper with the breathings of your heart." },
  { translationId: "quoteJournal2", fallback: "Journal writing is a voyage to the interior." },
  { translationId: "quoteJournal3", fallback: "The act of writing is the act of discovering what you believe." },
  { translationId: "quoteJournal4", fallback: "We write to taste life twice, in the moment and in retrospect." },
  { translationId: "quoteJournal5", fallback: "Writing is the painting of the voice." },
  { translationId: "quoteJournal6", fallback: "Start writing, no matter what. The water does not flow until the faucet is turned on." },
  { translationId: "quoteJournal7", fallback: "In the journal I am at ease." },
  { translationId: "quoteJournal8", fallback: "A personal journal is an ideal environment in which to become." },
  { translationId: "quoteJournal9", fallback: "People who keep journals have life twice." },
  { translationId: "quoteJournal10", fallback: "The pages are still blank, but there is a miraculous feeling of the words being there." },
  { translationId: "quoteJournal11", fallback: "Write what disturbs you, what you fear, what you have not been willing to speak about." },
  { translationId: "quoteJournal12", fallback: "One day I will find the right words, and they will be simple." },
  { translationId: "quoteJournal13", fallback: "There is no greater agony than bearing an untold story inside you." },
  { translationId: "quoteJournal14", fallback: "Your journal is like your best friend. You don't have to pretend with it." },
  { translationId: "quoteJournal15", fallback: "There is only one way. Go into yourself." },
  { translationId: "quoteJournal16", fallback: "How vain it is to sit down to write when you have not stood up to live." },
  { translationId: "quoteJournal17", fallback: "Reading maketh a full man; conference a ready man; and writing an exact man." },
  { translationId: "quoteJournal18", fallback: "I never travel without my diary." },
  { translationId: "quoteJournal19", fallback: "The universe is transformation: life is opinion." },
  { translationId: "quoteJournal20", fallback: "I am myself the matter of my book." },
  { translationId: "quoteJournal21", fallback: "The unexamined life is not worth living." },
  { translationId: "quoteJournal22", fallback: "Write it on your heart that every day is the best day in the year." },
  { translationId: "quoteJournal23", fallback: "Men are disturbed not by things, but by the views which they take of things." },
  { translationId: "quoteJournal24", fallback: "We suffer more often in imagination than in reality." },
  { translationId: "quoteJournal25", fallback: "Language is the dress of thought." },
  { translationId: "quoteJournal26", fallback: "The life of every man is a diary in which he means to write one story." },
  { translationId: "quoteJournal27", fallback: "So long as you write what you wish to write, that is all that matters." },
  { translationId: "quoteJournal28", fallback: "How do I know what I think until I see what I say?" },
  { translationId: "quoteJournal29", fallback: "We tell ourselves stories in order to live." },
  { translationId: "quoteJournal30", fallback: "Good prose is like a windowpane." },
];

const FIRST_USE_QUOTE_IDS = new Set([
  "quoteJournal1",
  "quoteJournal2",
  "quoteJournal3",
  "quoteJournal4",
  "quoteJournal5",
  "quoteJournal7",
  "quoteJournal8",
  "quoteJournal9",
  "quoteJournal10",
  "quoteJournal12",
  "quoteJournal14",
  "quoteJournal18",
  "quoteJournal19",
  "quoteJournal20",
  "quoteJournal25",
  "quoteJournal26",
  "quoteJournal27",
  "quoteJournal28",
  "quoteJournal29",
  "quoteJournal30",
]);

export const JOURNAL_FIRST_USE_QUOTES = JOURNAL_EMPTY_QUOTES.filter((quote) =>
  FIRST_USE_QUOTE_IDS.has(quote.translationId),
);

export function getJournalEmptyQuoteIndex(date = new Date(), quoteCount = JOURNAL_EMPTY_QUOTES.length): number {
  return Math.abs(Math.floor(date.getTime() / 86_400_000)) % quoteCount;
}

export function getJournalQuote(
  translations: Record<string, string>,
  date = new Date(),
  options: JournalQuoteOptions = {},
): string {
  const quoteDefinitions = options.scope === "all" ? JOURNAL_EMPTY_QUOTES : JOURNAL_FIRST_USE_QUOTES;
  const quoteDefinition = quoteDefinitions[getJournalEmptyQuoteIndex(date, quoteDefinitions.length)];
  return translations[quoteDefinition.translationId] || quoteDefinition.fallback;
}
