/**
 * String sanitization using DOMPurify.
 * Separated from validation.ts to prevent DOMPurify (CJS) from being bundled
 * into chunks that only need pure validation functions like safeParseInt.
 */
import DOMPurify from "dompurify";

// Dangerous patterns that could indicate XSS attempts
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror=, etc.
  /<script/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

export const sanitizeString = (input: string): string => {
  // First pass: DOMPurify strips all HTML
  let sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Second pass: Remove any remaining dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove angle brackets and curly braces
  return sanitized
    .replace(/[<>{}\\]/g, "")
    .trim()
    .slice(0, 1000);
};

export const sanitizeUserName = (name: string): string => {
  return sanitizeString(name).slice(0, 100);
};

// Restrict href protocols to https: and mailto: only (CWE-79: prevent javascript: URIs)
const SAFE_URI_REGEXP = /^(?:https?|mailto):/i;

/** Sanitize rich HTML content for contenteditable — allows formatting tags only. */
export const sanitizeRichContent = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "strong",
      "i",
      "em",
      "u",
      "del",
      "s",
      "blockquote",
      "code",
      "a",
      "br",
      "div",
      "p",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
    ADD_ATTR: ["rel"],
  });
};

// DOMPurify hook: force rel="noopener noreferrer" on all anchor elements
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("rel", "noopener noreferrer");
    node.setAttribute("target", "_blank");
  }
});
