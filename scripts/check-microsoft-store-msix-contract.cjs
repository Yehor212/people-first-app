#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PRODUCT_ID = "9MZK46FHZV8K";
const EXPECTED_IDENTITY = {
  productId: PRODUCT_ID,
  packageIdentityName: "YehorSha.ZenFlow",
  publisher: "CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B",
  publisherDisplayName: "YehorSha",
  packageFamilyName: "YehorSha.ZenFlow_5m5fhwz1wz4xt",
};
const EXPECTED_APP_LANGUAGES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const EXPECTED_STORE_LANGUAGES = {
  en: "English",
  uk: "Ukrainian",
  es: "Spanish",
  de: "German",
  fr: "French",
  ja: "Japanese",
  ar: "Arabic",
  he: "Hebrew",
};
const STORE_LISTING_PACKET = "docs/release/microsoft-store/store-listing-localized.json";
const BANNED_STORE_CLAIMS = [
  /\bmedical advice\b/i,
  /\bdiagnosis\b/i,
  /\btreatment\b/i,
  /\btherapy replacement\b/i,
  /\bAI-powered\b/i,
  /\bgame-changing\b/i,
  /\brevolutionary\b/i,
  /\bultimate\b/i,
  /\btransform your life\b/i,
];
const failures = [];
const warnings = [];
let passCount = 0;

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${file} is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function readJson(file) {
  const source = read(file);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function pass() {
  passCount += 1;
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${file} is missing required Store/MSIX token: ${snippet}`);
    } else {
      pass();
    }
  }
}

function requirePlaceholderOnly(template) {
  const placeholderFields = [
    "packageIdentityName",
    "publisher",
    "publisherDisplayName",
  ];

  for (const field of placeholderFields) {
    const value = String(template[field] || "");
    if (!value.includes("<copy from Partner Center Product Identity>")) {
      failures.push(`docs/release/microsoft-store/identity.template.json must keep ${field} as a placeholder`);
    } else {
      pass();
    }
  }
}

function requireNoHighConfidenceSecrets(files) {
  const patterns = [
    /\bZENFLOW_WINDOWS_CERT_PFX_BASE64\s*=\s*["'][A-Za-z0-9+/=]{40,}["']/g,
    /\bZENFLOW_WINDOWS_CERT_PASSWORD\s*=\s*["'][^"']{8,}["']/g,
    /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/g,
    /\bSENTRY_AUTH_TOKEN\s*=\s*["'][^"']{20,}["']/g,
    /\bghp_[A-Za-z0-9_]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  ];

  for (const file of files) {
    const source = read(file);
    if (!source) continue;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) {
        failures.push(`${file} contains a high-confidence secret pattern`);
      }
    }
  }
  pass();
}

function validateOptionalIdentityEnv() {
  const identity = {
    productId: process.env.ZENFLOW_STORE_PRODUCT_ID || "",
    name: process.env.ZENFLOW_STORE_PACKAGE_IDENTITY_NAME || "",
    publisher: process.env.ZENFLOW_STORE_PUBLISHER || "",
    publisherDisplayName: process.env.ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME || "",
  };

  const anyIdentity = Object.values(identity).some(Boolean);
  if (!anyIdentity) {
    warnings.push("Partner Center Product Identity env values are absent; CI/env mirror remains UNVERIFIED, public identity file is checked");
    return;
  }

  if (identity.productId !== PRODUCT_ID) {
    failures.push(`ZENFLOW_STORE_PRODUCT_ID must be ${PRODUCT_ID}`);
  } else {
    pass();
  }

  if (identity.name !== EXPECTED_IDENTITY.packageIdentityName) {
    failures.push(`ZENFLOW_STORE_PACKAGE_IDENTITY_NAME must be ${EXPECTED_IDENTITY.packageIdentityName}`);
  } else {
    pass();
  }

  if (identity.publisher !== EXPECTED_IDENTITY.publisher) {
    failures.push(`ZENFLOW_STORE_PUBLISHER must be ${EXPECTED_IDENTITY.publisher}`);
  } else {
    pass();
  }

  if (identity.publisherDisplayName !== EXPECTED_IDENTITY.publisherDisplayName) {
    failures.push(`ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME must be ${EXPECTED_IDENTITY.publisherDisplayName}`);
  } else {
    pass();
  }
}

function requirePublicIdentity(identity) {
  for (const [field, expected] of Object.entries(EXPECTED_IDENTITY)) {
    if (identity[field] !== expected) {
      failures.push(`docs/release/microsoft-store/product-identity.public.json ${field} must be ${expected}`);
    } else {
      pass();
    }
  }

  if (!String(identity.storeUrl || "").endsWith(`/detail/${PRODUCT_ID}`)) {
    failures.push("docs/release/microsoft-store/product-identity.public.json storeUrl must point to the Store product");
  } else {
    pass();
  }

  if (!String(identity.storeProtocolLink || "").endsWith(`productid=${PRODUCT_ID}`)) {
    failures.push("docs/release/microsoft-store/product-identity.public.json storeProtocolLink must point to the Store product id");
  } else {
    pass();
  }
}

function requireAppLanguageFiles() {
  for (const language of EXPECTED_APP_LANGUAGES) {
    const file = `src/i18n/languages/${language}.ts`;
    if (!fs.existsSync(abs(file))) {
      failures.push(`${file} is missing; Store language audit expects ${EXPECTED_APP_LANGUAGES.join(", ")}`);
    } else {
      pass();
    }
  }
}

function requireLocalizedStorePacket(packet) {
  const languages = packet.languages || {};
  const screenshotFiles = packet.desktopScreenshotFiles || [];
  const neutralDecision = String(packet.neutralScreenshotDecision || "");

  if (!Array.isArray(screenshotFiles) || screenshotFiles.length !== 3) {
    failures.push(`${STORE_LISTING_PACKET} must list the three approved Desktop screenshot files`);
  } else {
    for (const file of screenshotFiles) {
      if (!fs.existsSync(abs(file))) {
        failures.push(`${STORE_LISTING_PACKET} references missing screenshot ${file}`);
      } else {
        pass();
      }
    }
  }

  if (!neutralDecision.includes("English UI screenshots")) {
    failures.push(`${STORE_LISTING_PACKET} must record the deliberate neutral-screenshot decision for non-English listings`);
  } else {
    pass();
  }

  for (const language of EXPECTED_APP_LANGUAGES) {
    const listing = languages[language];
    if (!listing) {
      failures.push(`${STORE_LISTING_PACKET} is missing ${language}`);
      continue;
    }

    if (listing.storeLanguage !== EXPECTED_STORE_LANGUAGES[language]) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.storeLanguage must be ${EXPECTED_STORE_LANGUAGES[language]}`);
    } else {
      pass();
    }

    if (listing.productName !== "ZenFlow") {
      failures.push(`${STORE_LISTING_PACKET} ${language}.productName must remain ZenFlow`);
    } else {
      pass();
    }

    if (!["ltr", "rtl"].includes(listing.direction)) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.direction must be ltr or rtl`);
    } else {
      pass();
    }

    const expectedDirection = language === "ar" || language === "he" ? "rtl" : "ltr";
    if (listing.direction !== expectedDirection) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.direction must be ${expectedDirection}`);
    } else {
      pass();
    }

    const shortDescription = String(listing.shortDescription || "");
    if (shortDescription.length < 60 || shortDescription.length > 270) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.shortDescription must be 60-270 characters`);
    } else {
      pass();
    }

    const description = String(listing.description || "");
    if (description.length < 600 || description.length > 10000) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.description must be 600-10000 characters`);
    } else {
      pass();
    }

    const whatsNew = String(listing.whatsNew || "");
    if (whatsNew.length < 80 || whatsNew.length > 1500) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.whatsNew must be 80-1500 characters`);
    } else {
      pass();
    }

    if (!Array.isArray(listing.features) || listing.features.length !== 10) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.features must contain exactly 10 feature rows`);
    } else {
      for (const [index, feature] of listing.features.entries()) {
        const value = String(feature || "");
        if (!value || value.length > 200 || /^[\s-*•]+/.test(value)) {
          failures.push(`${STORE_LISTING_PACKET} ${language}.features[${index}] must be non-empty, under 200 chars, and must not include bullet characters`);
        } else {
          pass();
        }
      }
    }

    if (!Array.isArray(listing.searchTerms) || listing.searchTerms.length < 4 || listing.searchTerms.length > 7) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.searchTerms must contain 4-7 Store terms`);
    } else {
      const unique = new Set(listing.searchTerms.map((term) => String(term).toLocaleLowerCase()));
      if (unique.size !== listing.searchTerms.length) {
        failures.push(`${STORE_LISTING_PACKET} ${language}.searchTerms must be unique`);
      } else {
        pass();
      }
    }

    if (!Array.isArray(listing.screenshotCaptions) || listing.screenshotCaptions.length !== 3) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.screenshotCaptions must contain exactly three captions`);
    } else {
      for (const [index, caption] of listing.screenshotCaptions.entries()) {
        const value = String(caption || "");
        if (!value || value.length > 200) {
          failures.push(`${STORE_LISTING_PACKET} ${language}.screenshotCaptions[${index}] must be non-empty and under 200 chars`);
        } else {
          pass();
        }
      }
    }

    const searchable = [
      shortDescription,
      description,
      whatsNew,
      ...(listing.features || []),
      ...(listing.screenshotCaptions || []),
    ].join("\n");
    for (const pattern of BANNED_STORE_CLAIMS) {
      if (pattern.test(searchable)) {
        failures.push(`${STORE_LISTING_PACKET} ${language} contains banned Store claim: ${pattern}`);
      }
    }
    pass();

    if (language !== "en" && description === languages.en?.description) {
      failures.push(`${STORE_LISTING_PACKET} ${language}.description must not reuse the English description verbatim`);
    } else {
      pass();
    }
  }
}

function main() {
  const packageJson = readJson("package.json");
  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  const identityTemplate = readJson("docs/release/microsoft-store/identity.template.json");
  const publicIdentity = readJson("docs/release/microsoft-store/product-identity.public.json");
  const localizedStorePacket = readJson(STORE_LISTING_PACKET);

  requireIncludes("docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md", [
    PRODUCT_ID,
    "MSIX or PWA app",
    "Product Identity",
    "product-identity.public.json",
    "No visual regression",
    "No sync fork",
    "No secrets in the app or repository",
    "No purchase or final submission automation",
    "Path A: Convert The Signed Installer",
    "Path B: Manual MSIX Packaging",
    "Windows App Certification Kit",
    "npm run desktop:store:check",
    "Store language truth",
    "Additional Store listing languages",
    "Languages supported in packages",
    "store-listing-localized.json",
  ]);

  requireIncludes("docs/release/microsoft-store/README.md", [
    PRODUCT_ID,
    "Product Identity",
    "PARTNER_CENTER_FIELD_PACKET.md",
    "STORE_LISTING_LOCALIZED_PACKET.md",
    "store-listing-localized.json",
    "STORE_SUBMISSION_AUDIT.md",
    "npm run desktop:store:check",
    "Do not place certificates",
    "product-identity.public.json",
    "accepted package in the Partner Center draft",
    "en",
    "uk",
    "es",
    "de",
    "fr",
    "ja",
    "ar",
    "he",
  ]);

  requireIncludes("docs/release/microsoft-store/PARTNER_CENTER_FIELD_PACKET.md", [
    PRODUCT_ID,
    EXPECTED_IDENTITY.packageIdentityName,
    EXPECTED_IDENTITY.publisher,
    "Store listings complete",
    "Additional Store listing languages reviewed",
    "Localized Store listing packet reviewed",
    "Package language list reviewed",
    "Packages uploaded and accepted",
    "Certification submitted",
    "docs/release/microsoft-store/store-screenshots/desktop/01-v2-orb-desktop.png",
    "docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-300.png",
    "npm run check:all",
    "npm run desktop:store:check",
    "https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images",
  ]);

  requireIncludes("docs/release/microsoft-store/STORE_SUBMISSION_AUDIT.md", [
    "App i18n",
    "Store listing languages",
    "Package languages",
    "Languages supported in packages",
    "Additional Store listing languages",
    "en, uk, es, de, fr, ja, ar, he",
    "store-listing-localized.json",
    "localized packet is ready",
    "tmp/partner-center-language-state-audit.png",
    "Packages` is `Not started",
  ]);

  requireIncludes("docs/release/microsoft-store/STORE_LISTING_QUALITY_GATE.md", [
    "Store Language Strategy",
    "en, uk, es, de, fr, ja, ar, he",
    "store-listing-localized.json",
    "English is the only live completed Store listing language",
    "Languages supported in packages",
  ]);

  requireIncludes("docs/release/microsoft-store/STORE_SUBMISSION_HANDOFF.md", [
    "STORE_SUBMISSION_AUDIT.md",
    "STORE_LISTING_LOCALIZED_PACKET.md",
    "Language Release Rule",
    "Additional Store listing languages",
    "Languages supported in packages",
  ]);

  requireIncludes("docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md", [
    "docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md",
    "npm run desktop:store:check",
    "Partner Center",
  ]);

  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    "Microsoft Store/MSIX",
    "npm run desktop:store:check",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    "Microsoft Store/MSIX contract",
    "npm run desktop:store:check",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    "Microsoft Store / MSIX",
    "npm run desktop:store:check",
    "9MZK46FHZV8K",
  ]);

  const storeScript = packageJson.scripts?.["desktop:store:check"];
  if (storeScript !== "node scripts/check-microsoft-store-msix-contract.cjs") {
    failures.push("package.json must expose desktop:store:check");
  } else {
    pass();
  }

  if (tauriConfig.productName !== "ZenFlow") {
    failures.push("src-tauri/tauri.conf.json productName must remain ZenFlow");
  } else {
    pass();
  }

  const targets = tauriConfig.bundle?.targets || [];
  if (!Array.isArray(targets) || !targets.includes("nsis")) {
    failures.push("src-tauri/tauri.conf.json must keep the signed NSIS installer path for Store conversion");
  } else {
    pass();
  }

  if (identityTemplate.productId !== PRODUCT_ID) {
    failures.push(`identity template must record product id ${PRODUCT_ID}`);
  } else {
    pass();
  }
  requirePlaceholderOnly(identityTemplate);
  requirePublicIdentity(publicIdentity);
  requireAppLanguageFiles();
  requireLocalizedStorePacket(localizedStorePacket);
  validateOptionalIdentityEnv();

  requireNoHighConfidenceSecrets([
    "docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md",
    "docs/release/microsoft-store/README.md",
    "docs/release/microsoft-store/PARTNER_CENTER_FIELD_PACKET.md",
    "docs/release/microsoft-store/STORE_SUBMISSION_AUDIT.md",
    "docs/release/microsoft-store/STORE_LISTING_QUALITY_GATE.md",
    "docs/release/microsoft-store/STORE_SUBMISSION_HANDOFF.md",
    "docs/release/microsoft-store/STORE_LISTING_LOCALIZED_PACKET.md",
    STORE_LISTING_PACKET,
    "docs/release/microsoft-store/identity.template.json",
    "docs/release/microsoft-store/product-identity.public.json",
    "scripts/check-microsoft-store-msix-contract.cjs",
  ]);

  for (const warning of warnings) {
    console.warn(`[desktop-store-msix] WARN - ${warning}`);
  }

  if (failures.length > 0) {
    console.error("[desktop-store-msix] FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[desktop-store-msix] PASS - ${passCount} guardrails checked`);
}

main();
