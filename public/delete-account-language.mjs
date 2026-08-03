export const SUPPORTED_DELETE_ACCOUNT_LOCALES = Object.freeze([
  "en",
  "uk",
  "es",
  "de",
  "fr",
  "ja",
  "ar",
  "he",
]);

const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_DELETE_ACCOUNT_LOCALES);
const RTL_LOCALE_SET = new Set(["ar", "he"]);
const BRAND_TOKEN = "ZenFlow";

function normalizeLocaleCandidate(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveDeleteAccountLocale(requested, browserLanguage) {
  if (requested !== null) {
    const explicitLocale = normalizeLocaleCandidate(requested);
    return SUPPORTED_LOCALE_SET.has(explicitLocale) ? explicitLocale : "en";
  }

  const browserLocale = normalizeLocaleCandidate(browserLanguage).split(/[-_]/u, 1)[0];
  return SUPPORTED_LOCALE_SET.has(browserLocale) ? browserLocale : "en";
}

export function protectDeleteAccountBrandTokens(doc = document) {
  const root = doc.querySelector("main.shell");
  if (!root) return 0;

  const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(root, showText);
  const candidates = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (
      !node.nodeValue?.includes(BRAND_TOKEN) ||
      parent?.closest(".brand-token, script, style, noscript")
    ) {
      continue;
    }
    candidates.push(node);
  }

  let protectedCount = 0;
  for (const node of candidates) {
    const parts = node.nodeValue.split(BRAND_TOKEN);
    if (parts.length < 2) continue;

    const fragment = doc.createDocumentFragment();
    parts.forEach((part, index) => {
      if (part) fragment.append(doc.createTextNode(part));
      if (index >= parts.length - 1) return;

      const token = doc.createElement("span");
      token.className = "brand-token";
      token.textContent = BRAND_TOKEN;
      fragment.append(token);
      protectedCount += 1;
    });
    node.replaceWith(fragment);
  }

  return protectedCount;
}

export function applyDeleteAccountLocale({
  doc = document,
  search = window.location.search,
  browserLanguage = navigator.language,
} = {}) {
  const params = new URLSearchParams(search);
  const requested = params.has("lang") ? params.get("lang") : null;
  const locale = resolveDeleteAccountLocale(requested, browserLanguage);
  const direction = RTL_LOCALE_SET.has(locale) ? "rtl" : "ltr";

  doc.documentElement.lang = locale;
  doc.documentElement.dir = direction;

  for (const section of doc.querySelectorAll("[data-delete-account-locale]")) {
    section.hidden = section.getAttribute("data-delete-account-locale") !== locale;
  }

  for (const link of doc.querySelectorAll("[data-delete-account-language-link]")) {
    const isCurrent = link.getAttribute("data-delete-account-language-link") === locale;
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  const selected = doc.querySelector(`[data-delete-account-locale="${locale}"]`);
  const localizedTitle = selected?.getAttribute("data-page-title");
  if (localizedTitle) doc.title = localizedTitle;

  const languageNavigation = doc.querySelector("[data-delete-account-language-nav]");
  const localizedNavigationLabel = selected?.getAttribute("data-language-nav-label");
  if (languageNavigation && localizedNavigationLabel) {
    languageNavigation.setAttribute("aria-label", localizedNavigationLabel);
  }

  return locale;
}

if (
  typeof document !== "undefined" &&
  document.documentElement.dataset.deleteAccountPage === "true"
) {
  protectDeleteAccountBrandTokens(document);
  applyDeleteAccountLocale();
}
