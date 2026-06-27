import {
  FREE_RAG_MAX_CHUNK_CHARS,
  containsSensitiveText,
  createFreeProjectRagIndex,
  formatFreeRagResultsForAgent,
  redactSensitiveText,
  searchFreeProjectRag,
} from "./freeProjectRag";
import { expandRagCorpusDocuments, loadRagCorpusManifest } from "./ragCorpus";

const BLOCKED_SOURCE_PATTERN = /(^|\/)(node_modules|dist|build|coverage|artifacts|assets|generated)(\/|$)/;
const RAW_TOKEN_PATTERN = /\b[A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*[^\s)]+/;
const RAW_JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;

const manifest = loadRagCorpusManifest();
const documents = expandRagCorpusDocuments(manifest);
const blockedSource = documents.find((document) => BLOCKED_SOURCE_PATTERN.test(document.source));

if (blockedSource) {
  throw new Error(`Free RAG audit failed: blocked source was indexed: ${blockedSource.source}`);
}

const index = createFreeProjectRagIndex(documents);
const oversizedChunk = index.chunks.find((chunk) => chunk.text.length > FREE_RAG_MAX_CHUNK_CHARS);

if (oversizedChunk) {
  throw new Error(
    `Free RAG audit failed: oversized chunk ${oversizedChunk.citation} has ${oversizedChunk.text.length} chars.`
  );
}

const sensitiveChunk = index.chunks.find((chunk) => containsSensitiveText(redactSensitiveText(chunk.text)));

if (sensitiveChunk) {
  throw new Error(`Free RAG audit failed: redacted corpus still contains token-shaped text near ${sensitiveChunk.citation}.`);
}

const formatted = formatFreeRagResultsForAgent(
  searchFreeProjectRag(index, "token secret password jwt openai telegram", { limit: 20 })
);

if (RAW_TOKEN_PATTERN.test(formatted) || RAW_JWT_PATTERN.test(formatted)) {
  throw new Error("Free RAG audit failed: formatted output contains raw token-shaped text.");
}

console.log(
  `Free project RAG audit passed. Indexed ${documents.length} curated files into ${index.chunks.length} chunks.`
);
