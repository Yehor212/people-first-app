export const TEXT_EXTENSIONS = Object.freeze(
  new Set([
    ".cjs",
    ".css",
    ".gradle",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".kts",
    ".md",
    ".mjs",
    ".patch",
    ".properties",
    ".rs",
    ".sql",
    ".swift",
    ".toml",
    ".ts",
    ".tsx",
    ".webmanifest",
    ".xml",
    ".yaml",
    ".yml",
  ])
);

export const ASSET_EXTENSIONS = Object.freeze(
  new Set([
    ".aac",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".lottie",
    ".m4a",
    ".mp3",
    ".ogg",
    ".png",
    ".svg",
    ".tgs",
    ".ttf",
    ".wav",
    ".webm",
    ".webp",
    ".woff",
    ".woff2",
  ])
);

const WEB_ALL = Object.freeze(["WEB", "PWA", "ANDROID", "IOS", "DESKTOP"]);
const ALL_RUNTIME = Object.freeze([...WEB_ALL, "STORE_RELEASE"]);

export const PATH_RULES = Object.freeze([
  pathRule({
    id: "ui-component-files",
    kind: "UI_COMPONENT",
    pattern: /^src\/(?:components|features|pages)\/.*\.(?:jsx|tsx)$/u,
    domains: ["ui"],
    platforms: WEB_ALL,
    symbolFromPath: componentIdentifier,
  }),
  pathRule({
    id: "canonical-orb-files",
    kind: "CANONICAL_ORB",
    pattern: /(?:^|\/)(ValenceOrb|MiniValenceOrb)\.(?:jsx|tsx)$/u,
    domains: ["canonical-orb", "ui"],
    platforms: WEB_ALL,
    symbolFromPath: (_locator, match) => match[1],
  }),
  pathRule({
    id: "versioned-ui-files",
    kind: "VERSIONED_UI",
    pattern: /(?:^|\/)(?:nav-v2|[^/]*V[12][^/]*)\//iu,
    domains: ["navigation", "ui-version"],
    platforms: WEB_ALL,
  }),
  pathRule({
    id: "native-platform-files",
    kind: "NATIVE_PLATFORM",
    pattern: /^(?:android|ios|src-tauri)\/|^capacitor\.config\.(?:js|mjs|ts)$/u,
    domains: ["native"],
    platforms: ["ANDROID", "IOS", "DESKTOP"],
  }),
  pathRule({
    id: "locale-modules",
    kind: "LOCALE_MODULE",
    pattern: /^src\/i18n\/languages\/(en|uk|es|de|fr|ja|ar|he)\.(?:js|ts)$/u,
    domains: ["i18n"],
    platforms: ALL_RUNTIME,
    symbolFromPath: (_locator, match) => match[1],
  }),
  pathRule({
    id: "public-claim-files",
    kind: "PUBLIC_CLAIM",
    pattern:
      /^(?:public\/[^/]*(?:manifest|privacy|terms|support)[^/]*|docs\/(?:STORE_LISTING|SUPPORT|PRIVACY|TERMS|CROSS_PLATFORM_RELEASE)[^/]*)/iu,
    domains: ["public-claims", "release"],
    platforms: ALL_RUNTIME,
  }),
  pathRule({
    id: "test-files",
    kind: "TEST_REFERENCE",
    pattern: /(?:^|\/)(?:__tests__|e2e|test|tests)\/|(?:\.test|\.spec)\.[^/]+$/u,
    domains: ["testing"],
    platforms: ["TESTING"],
  }),
  pathRule({
    id: "legacy-generated-files",
    kind: "LEGACY_GENERATED",
    pattern: /(?:^|\/)(?:legacy|deprecated|generated|gen)(?:\/|$)|(?:\.generated\.|\.gen\.)/iu,
    domains: ["legacy-generated"],
    platforms: ALL_RUNTIME,
  }),
  pathRule({
    id: "patch-files",
    kind: "PATCH",
    pattern: /(?:^|\/)patches\/.*\.patch$/u,
    domains: ["patches", "native"],
    platforms: ["ANDROID", "IOS", "DESKTOP"],
  }),
  pathRule({
    id: "asset-files",
    kind: "ASSET",
    pattern: /\.(?:aac|gif|ico|jpe?g|lottie|m4a|mp3|ogg|png|svg|tgs|ttf|wav|webm|webp|woff2?)$/iu,
    domains: ["assets"],
    platforms: ALL_RUNTIME,
  }),
  pathRule({
    id: "service-worker-pwa-files",
    kind: "SERVICE_WORKER_PWA",
    pattern: /(?:^|\/)(?:sw|service-worker)\.(?:js|mjs|ts)$|(?:^|\/)manifest\.webmanifest$/iu,
    domains: ["pwa", "background"],
    platforms: ["WEB", "PWA"],
  }),
  pathRule({
    id: "auth-onboarding-files",
    kind: "AUTH",
    pattern: /(?:^|\/)[^/]*(?:Auth|SignIn|Login)[^/]*\.(?:jsx|tsx)$/u,
    domains: ["auth"],
    platforms: WEB_ALL,
  }),
  pathRule({
    id: "modal-overlay-files",
    kind: "MODAL_OVERLAY",
    pattern: /(?:^|\/)[^/]*(?:Modal|Overlay|Sheet|Dialog)[^/]*\.(?:jsx|tsx)$/u,
    domains: ["modal-overlay"],
    platforms: WEB_ALL,
  }),
  pathRule({
    id: "recovery-files",
    kind: "ERROR_RECOVERY",
    pattern: /(?:^|\/)[^/]*(?:Error|Recovery|Fallback|Offline)[^/]*\.(?:js|jsx|ts|tsx)$/u,
    domains: ["error-recovery"],
    platforms: WEB_ALL,
  }),
]);

export const LEXICAL_RULES = Object.freeze([
  lexicalRule({
    id: "route-definitions",
    kind: "ROUTE",
    pattern: /\b(?:path|route)\s*[:=]\s*(?:["'`][^"'`\r\n]{1,256}["'`]|[A-Za-z_$][A-Za-z0-9_$]*)/gu,
    domains: ["navigation"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "navigation-definitions",
    kind: "NAVIGATION",
    pattern: /\b(?:NAV_ITEMS|Navigation|activeTab|TabType|navLayout|setActiveTab|navigateTo)\b/gu,
    domains: ["navigation"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "deep-link-handlers",
    kind: "DEEP_LINK",
    pattern: /\b(?:useDeepLink|deepLink|handleDeepLink|appUrlOpen|zenflow:deep-link)\b/giu,
    domains: ["navigation", "lifecycle"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "onboarding-entry-points",
    kind: "ONBOARDING",
    pattern: /\b(?:OnboardingFlow|WelcomeTutorial|onboardingComplete|useOnboardingEffects)\b/gu,
    domains: ["onboarding"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "auth-entry-points",
    kind: "AUTH",
    pattern: /\b(?:AuthGate|AuthScreen|useAuthSession|signIn|signOut|OAuth)\b/gu,
    domains: ["auth"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "modal-overlay-registrations",
    kind: "MODAL_OVERLAY",
    pattern: /\b(?:ModalLayer|OverlayLayer|show[A-Z][A-Za-z0-9]*(?:Modal|Sheet)|useModalA11y)\b/gu,
    domains: ["modal-overlay"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "error-recovery-surfaces",
    kind: "ERROR_RECOVERY",
    pattern: /\b(?:ErrorBoundary|RecoveryPanel|StorageError|retry|fallback|recover)\b/giu,
    domains: ["error-recovery"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "canonical-orb-references",
    kind: "CANONICAL_ORB",
    pattern: /\b(ValenceOrb|MiniValenceOrb)\b/gu,
    domains: ["canonical-orb", "ui"],
    platforms: WEB_ALL,
    identifierCapture: 1,
  }),
  lexicalRule({
    id: "versioned-ui-references",
    kind: "VERSIONED_UI",
    pattern: /\b(?:IndexV1|nav-v2|navLayout|V1\/V2|V2)\b/gu,
    domains: ["navigation", "ui-version"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "feature-flags",
    kind: "FEATURE_FLAG",
    pattern: /\b([A-Z][A-Z0-9]*(?:_ENABLED|_FLAG|_EXPERIMENT))\b/gu,
    domains: ["feature-flags"],
    platforms: WEB_ALL,
    identifierCapture: 1,
  }),
  lexicalRule({
    id: "provider-mounts",
    kind: "PROVIDER",
    pattern: /<([A-Z][A-Za-z0-9]*Provider)\b/gu,
    domains: ["providers"],
    platforms: WEB_ALL,
    identifierCapture: 1,
  }),
  lexicalRule({
    id: "background-listeners-jobs",
    kind: "BACKGROUND_WORK",
    pattern:
      /\b(?:addEventListener|addListener|setInterval|BackgroundTask|runBackgroundJob|offlineQueue)\b/gu,
    domains: ["background", "lifecycle"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "service-worker-pwa-registration",
    kind: "SERVICE_WORKER_PWA",
    pattern: /\b(?:serviceWorker|registerSW|workbox|beforeinstallprompt)\b/gu,
    domains: ["pwa", "background"],
    platforms: ["WEB", "PWA"],
  }),
  lexicalRule({
    id: "debug-dev-surfaces",
    kind: "DEBUG_SURFACE",
    pattern: /\b(?:import\.meta\.env\.DEV|devtools|logger\.debug|DEBUG)\b/gu,
    domains: ["debug"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "zustand-store-definitions",
    kind: "ZUSTAND_STORE",
    pattern: /\b(use[A-Z][A-Za-z0-9]*Store)\s*=\s*create(?:<|\()/gu,
    domains: ["state"],
    platforms: WEB_ALL,
    identifierCapture: 1,
  }),
  lexicalRule({
    id: "hydration-bridges",
    kind: "HYDRATION_BRIDGE",
    pattern: /\b(useHydrate[A-Z][A-Za-z0-9]*)\b/gu,
    domains: ["state", "storage"],
    platforms: WEB_ALL,
    identifierCapture: 1,
  }),
  lexicalRule({
    id: "dexie-schema-migrations",
    kind: "DEXIE_SCHEMA",
    pattern: /\b(?:new\s+Dexie|\.version\s*\(|\.stores\s*\(|\.upgrade\s*\(|useIndexedDB)\b/gu,
    domains: ["storage", "migration"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "data-lifecycle-paths",
    kind: "DATA_LIFECYCLE",
    pattern:
      /\b(?:sync[A-Z][A-Za-z0-9]*|exportData|importData|deleteAccount|clearLocalUserData|deletionTracker[A-Za-z0-9]*|deadLetters?)\b/gu,
    domains: ["storage", "sync", "deletion"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "ai-coach-rag-references",
    kind: "AI_COACH_RAG",
    pattern: /\b(?:AICoach|privateSearch|ragProvider|journalContext|modelProvider|CoachLite)\b/gu,
    domains: ["ai", "privacy"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "ads-analytics-consent",
    kind: "AD_ANALYTICS_CONSENT",
    pattern: /\b(?:AdProvider|AdMob|Analytics|privacyConsent|Consent|UMP|rewardedAd)\b/gu,
    domains: ["ads", "analytics", "consent"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "reward-pipeline",
    kind: "REWARDS",
    pattern: /\b(?:rewardUser|awardXp|earnTreats|plantSeed|waterPlants)\b/gu,
    domains: ["rewards"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "notification-sound-haptics",
    kind: "NOTIFICATION_SOUND_HAPTIC",
    pattern:
      /\b(?:notificationScheduler|LocalNotifications|scheduleReminder|haptic[A-Za-z0-9]*|appSound|nativeChannel|openOsSettings)\b/gu,
    domains: ["notifications", "sound", "haptics"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "native-plugin-branches",
    kind: "NATIVE_PLATFORM",
    pattern:
      /\b(?:Capacitor|CAPPlugin|registerPlugin|isNative|isAndroid|isIos|tauri::|LocalNotifications)\b/gu,
    domains: ["native"],
    platforms: ["ANDROID", "IOS", "DESKTOP"],
  }),
  lexicalRule({
    id: "rtl-bidi-markers",
    kind: "RTL_BIDI",
    pattern: /\b(?:isRtl|RTL|bidi|direction\s*:\s*rtl|document\.dir)\b/giu,
    domains: ["i18n", "accessibility"],
    platforms: ALL_RUNTIME,
  }),
  lexicalRule({
    id: "public-claims",
    kind: "PUBLIC_CLAIM",
    pattern:
      /\b(?:public\s+(?:store|support|privacy)|privacy\s+policy|terms\s+of\s+service|support\s+promise|parity\s+claim|V1\/V2\s+parity)\b/giu,
    domains: ["public-claims", "release"],
    platforms: ALL_RUNTIME,
  }),
  lexicalRule({
    id: "observability-references",
    kind: "OBSERVABILITY",
    pattern: /\b(?:Sentry|Crashlytics|captureException|captureMessage|logger\.(?:error|warn))\b/gu,
    domains: ["observability", "error-recovery"],
    platforms: WEB_ALL,
  }),
  lexicalRule({
    id: "legacy-generated-markers",
    kind: "LEGACY_GENERATED",
    pattern: /\b(?:@deprecated|legacy|generated\s+source|dead\s+code)\b/giu,
    domains: ["legacy-generated"],
    platforms: ALL_RUNTIME,
  }),
  lexicalRule({
    id: "dynamic-parser-uncertainty",
    kind: "PARSER_UNCERTAINTY",
    pattern: /\bimport\s*\(\s*(?!["'`])[^)\r\n]{1,160}\)/gu,
    domains: ["parser-uncertainty"],
    platforms: ALL_RUNTIME,
  }),
]);

export function isSensitiveTrackedPath(locator) {
  const basename = locator.slice(locator.lastIndexOf("/") + 1).toLowerCase();
  return (
    basename === ".mcp.json" ||
    basename === ".npmrc" ||
    basename === ".pypirc" ||
    basename.startsWith(".env") ||
    /\.(?:key|p12|pfx|pem)$/iu.test(basename) ||
    /(?:credential|private[-_.]?data|user[-_.]?journal|secret[-_.]?store)/iu.test(locator)
  );
}

function pathRule(rule) {
  return Object.freeze(rule);
}

function lexicalRule(rule) {
  return Object.freeze(rule);
}

function componentIdentifier(locator) {
  const basename = locator.slice(locator.lastIndexOf("/") + 1).replace(/\.(?:jsx|tsx)$/u, "");
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(basename) ? basename : undefined;
}
