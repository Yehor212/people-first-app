import { ENUMERATOR_IDS } from "./constants.mjs";

const RULES = Object.freeze([
  rule("navigation", "ROUTE_OR_NAVIGATION", "route-or-nav", {
    path: /^(src\/(pages|components\/navigation-v2)\/|e2e\/)/,
    text: /\b(Route|NavV2|deepLink|navigate|activeTab)\b/,
  }),
  rule("surfaces-orbs", "SURFACE_OR_ORB", "surface-orb", {
    path: /^src\/(components|pages)\//,
    text: /\b(ValenceOrb|MiniValenceOrb|Mood|Habit|Focus|Journal|Garden|Breath)\b/,
  }),
  rule("gates-providers-background", "GATE_PROVIDER_OR_BACKGROUND", "gate-provider-background", {
    path: /^src\/(contexts|providers|hooks)\//,
    text: /\b(Provider|Context|FeatureFlag|serviceWorker|Background|Lifecycle|Hydrate)\b/,
  }),
  rule("state-storage-sync", "STATE_STORAGE_OR_SYNC", "state-storage-sync", {
    path: /^src\/(stores|storage)\//,
    text: /\b(Dexie|IndexedDB|sync|queue|hydrate|migration|export|delete)\b/i,
  }),
  rule("ai-ads-notifications", "AI_AD_NOTIFICATION_OR_REWARD", "ai-ad-notification", {
    path: /^src\/(lib|components|contexts|features)\//,
    text: /\b(AI Coach|aiCoach|RAG|AdProvider|AdMob|reward|LocalNotifications|notification|haptic)\b/i,
  }),
  rule("native-platform", "NATIVE_PLATFORM", "native-platform", {
    path: /^(android\/|ios\/|src-tauri\/|capacitor\.config\.)/,
    text: /\b(Capacitor|CapacitorPlugin|POST_NOTIFICATIONS|WKWebView|Tauri|AndroidManifest)\b/,
  }),
  rule("i18n-public-claims", "I18N_OR_PUBLIC_CLAIM", "i18n-public-claim", {
    path: /^(src\/i18n\/|public\/|docs\/(privacy|support|legal))/,
    text: /\b(privacy|support|terms|delete account|translation|locale|rtl|bidi)\b/i,
  }),
  rule("tests-observability-recovery", "TEST_OBSERVABILITY_OR_RECOVERY", "test-observability-recovery", {
    path: /(^|\/)(__tests__|e2e|observability|recovery)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/,
    text: /\b(test|expect|recover|dead.?letter|trace|observability|incident)\b/i,
  }),
  rule("legacy-assets", "LEGACY_OR_ASSET", "legacy-asset", {
    path: /(^|\/)(legacy|assets|sounds|icons|images)(\/|$)|\.(mp3|wav|ogg|png|jpg|jpeg|webp|svg|tgs|lottie)$/i,
    text: /\b(legacy|deprecated|asset|sound|audio)\b/i,
  }),
]);

export function enumerateFactsFromFiles(files) {
  const facts = [];
  const seen = new Set();
  for (const file of files) {
    for (const definition of RULES) {
      if (!ruleMatches(definition, file)) continue;
      const fact = {
        enumerator: definition.enumerator,
        type: definition.type,
        symbol: definition.symbol,
        path: file.path,
        contentSha256: file.contentSha256,
        byteLength: file.byteLength,
      };
      const key = `${fact.enumerator}\u0000${fact.type}\u0000${fact.path}\u0000${fact.symbol}`;
      if (!seen.has(key)) {
        seen.add(key);
        facts.push(fact);
      }
    }
  }
  return facts;
}

export function summarizeFacts(candidates) {
  return {
    totalCandidates: candidates.length,
    byEnumerator: ENUMERATOR_IDS.map((enumerator) => ({
      enumerator,
      candidateCount: candidates.filter((candidate) => candidate.enumerator === enumerator).length,
    })),
  };
}

function rule(enumerator, type, symbol, { path, text }) {
  return Object.freeze({ enumerator, type, symbol, path, text });
}

function ruleMatches(definition, file) {
  if (definition.path.test(file.path)) return true;
  return Boolean(file.isText && definition.text.test(file.text));
}
