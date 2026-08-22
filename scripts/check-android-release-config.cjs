#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const EXPECTED_SDKS = Object.freeze({
  minSdkVersion: 26,
  compileSdkVersion: 36,
  targetSdkVersion: 36,
});
const EXPECTED_RELEASE_IDENTITY = Object.freeze({
  versionName: "2.1.0",
  heldVersionCode: 35,
});
const RELEASE_SIGNING_PROPERTY_KEYS = Object.freeze([
  "storeFile",
  "storePassword",
  "keyAlias",
  "keyPassword",
]);

const FILES = Object.freeze({
  packageJson: "package.json",
  packageLock: "package-lock.json",
  appVersion: "src/lib/appVersion.ts",
  variables: "android/variables.gradle",
  appBuild: "android/app/build.gradle",
  manifest: "android/app/src/main/AndroidManifest.xml",
  activity: "android/app/src/main/java/com/zenflow/app/MainActivity.java",
  backPlugin: "android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java",
  capacitorConfig: "capacitor.config.ts",
  database: "src/storage/db.ts",
  runbook: "docs/release/ANDROID_2_1_RUNBOOK.md",
});

function inspectAndroidReleaseNativeServicesInputs({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const relativePath = "android/app/google-services.json";
  const targetPath = path.join(resolvedRoot, relativePath);
  const issueCodes = [];
  const googleServices = {
    exists: false,
    regularFile: false,
    symlink: false,
    tracked: runGitPathCheck(resolvedRoot, ["ls-files", "--error-unmatch", "--", relativePath]),
    ignored: runGitPathCheck(resolvedRoot, [
      "check-ignore",
      "--no-index",
      "--quiet",
      "--",
      relativePath,
    ]),
    nonEmpty: false,
    jsonValid: false,
    packageMatches: false,
    mobileSdkAppIdPresent: false,
    projectNumberPresent: false,
  };

  try {
    const stat = fs.lstatSync(targetPath);
    googleServices.exists = true;
    googleServices.symlink = stat.isSymbolicLink();
    googleServices.regularFile = stat.isFile() && !googleServices.symlink;
    googleServices.nonEmpty = googleServices.regularFile && stat.size > 0;
  } catch (error) {
    if (!error || error.code !== "ENOENT") issueCodes.push("GOOGLE_SERVICES_UNREADABLE");
  }

  if (!googleServices.exists) issueCodes.push("GOOGLE_SERVICES_MISSING");
  else if (googleServices.symlink) issueCodes.push("GOOGLE_SERVICES_SYMLINK");
  else if (!googleServices.regularFile) issueCodes.push("GOOGLE_SERVICES_NOT_REGULAR");
  else if (!googleServices.nonEmpty) issueCodes.push("GOOGLE_SERVICES_EMPTY");
  if (googleServices.tracked) issueCodes.push("GOOGLE_SERVICES_TRACKED");
  if (!googleServices.ignored) issueCodes.push("GOOGLE_SERVICES_NOT_IGNORED");

  if (googleServices.nonEmpty) {
    try {
      const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      googleServices.jsonValid = parsed !== null && typeof parsed === "object";
      googleServices.projectNumberPresent =
        typeof parsed?.project_info?.project_number === "string" &&
        parsed.project_info.project_number.trim().length > 0;
      const clients = Array.isArray(parsed?.client) ? parsed.client : [];
      googleServices.packageMatches = clients.some(
        (client) =>
          client?.client_info?.android_client_info?.package_name === "com.zenflow.app",
      );
      googleServices.mobileSdkAppIdPresent = clients.some(
        (client) =>
          client?.client_info?.android_client_info?.package_name === "com.zenflow.app" &&
          typeof client?.client_info?.mobilesdk_app_id === "string" &&
          client.client_info.mobilesdk_app_id.trim().length > 0,
      );
    } catch {
      issueCodes.push("GOOGLE_SERVICES_JSON_INVALID");
    }
  }

  if (googleServices.jsonValid) {
    if (!googleServices.packageMatches) issueCodes.push("GOOGLE_SERVICES_PACKAGE_MISMATCH");
    if (!googleServices.mobileSdkAppIdPresent) {
      issueCodes.push("GOOGLE_SERVICES_MOBILE_APP_ID_MISSING");
    }
    if (!googleServices.projectNumberPresent) {
      issueCodes.push("GOOGLE_SERVICES_PROJECT_NUMBER_MISSING");
    }
  }

  const uniqueIssueCodes = [...new Set(issueCodes)];
  return {
    shapeReady: uniqueIssueCodes.length === 0,
    googleServices,
    issueCodes: uniqueIssueCodes,
    sensitiveValuesPrinted: false,
  };
}

function createIssue(code, file, detail) {
  return { code, file, detail };
}

function runGitPathCheck(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

function parseSigningProperties(source) {
  const values = new Map();
  const duplicates = new Set();
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const match = /^([^\s=:]+)\s*[=:]\s*(.*)$/u.exec(line);
    if (!match || !RELEASE_SIGNING_PROPERTY_KEYS.includes(match[1])) continue;
    if (values.has(match[1])) duplicates.add(match[1]);
    values.set(match[1], match[2]);
  }
  return { values, duplicates };
}

function inspectAndroidReleaseSigningInputs({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const keyPropertiesPath = path.join(resolvedRoot, "android", "key.properties");
  const relativeKeyPropertiesPath = "android/key.properties";
  const issueCodes = [];
  const requiredKeys = Object.fromEntries(
    RELEASE_SIGNING_PROPERTY_KEYS.map((key) => [key, false]),
  );
  const keyProperties = {
    exists: false,
    regularFile: false,
    symlink: false,
    tracked: runGitPathCheck(resolvedRoot, [
      "ls-files",
      "--error-unmatch",
      "--",
      relativeKeyPropertiesPath,
    ]),
    ignored: runGitPathCheck(resolvedRoot, [
      "check-ignore",
      "--no-index",
      "--quiet",
      "--",
      relativeKeyPropertiesPath,
    ]),
  };
  const keystore = {
    configured: false,
    exists: false,
    regularFile: false,
    symlink: false,
  };

  let keyPropertiesStat = null;
  try {
    keyPropertiesStat = fs.lstatSync(keyPropertiesPath);
    keyProperties.exists = true;
    keyProperties.symlink = keyPropertiesStat.isSymbolicLink();
    keyProperties.regularFile = keyPropertiesStat.isFile() && !keyProperties.symlink;
  } catch (error) {
    if (!error || error.code !== "ENOENT") issueCodes.push("KEY_PROPERTIES_UNREADABLE");
  }

  if (!keyProperties.exists) {
    issueCodes.push("KEY_PROPERTIES_MISSING");
  } else if (keyProperties.symlink) {
    issueCodes.push("KEY_PROPERTIES_SYMLINK");
  } else if (!keyProperties.regularFile) {
    issueCodes.push("KEY_PROPERTIES_NOT_REGULAR");
  }
  if (keyProperties.tracked) issueCodes.push("KEY_PROPERTIES_TRACKED");
  if (!keyProperties.ignored) issueCodes.push("KEY_PROPERTIES_NOT_IGNORED");

  let storeFileValue = null;
  if (keyProperties.regularFile) {
    try {
      const parsed = parseSigningProperties(fs.readFileSync(keyPropertiesPath, "utf8"));
      for (const key of RELEASE_SIGNING_PROPERTY_KEYS) {
        const value = parsed.values.get(key);
        requiredKeys[key] = typeof value === "string" && value.trim().length > 0;
        if (!requiredKeys[key]) {
          issueCodes.push(`SIGNING_PROPERTY_MISSING_${key.replace(/([a-z])([A-Z])/gu, "$1_$2").toUpperCase()}`);
        }
        if (parsed.duplicates.has(key)) {
          issueCodes.push(`SIGNING_PROPERTY_DUPLICATE_${key.replace(/([a-z])([A-Z])/gu, "$1_$2").toUpperCase()}`);
        }
      }
      if (requiredKeys.storeFile) {
        storeFileValue = parsed.values.get("storeFile").trim();
        keystore.configured = true;
      }
    } catch {
      issueCodes.push("KEY_PROPERTIES_UNREADABLE");
    }
  }

  if (storeFileValue !== null) {
    try {
      const keystorePath = path.isAbsolute(storeFileValue)
        ? path.normalize(storeFileValue)
        : path.resolve(resolvedRoot, "android", storeFileValue);
      const keystoreStat = fs.lstatSync(keystorePath);
      keystore.exists = true;
      keystore.symlink = keystoreStat.isSymbolicLink();
      keystore.regularFile = keystoreStat.isFile() && !keystore.symlink;
      if (keystore.symlink) issueCodes.push("KEYSTORE_SYMLINK");
      else if (!keystore.regularFile) issueCodes.push("KEYSTORE_NOT_REGULAR");
    } catch (error) {
      if (error && error.code === "ENOENT") issueCodes.push("KEYSTORE_MISSING");
      else issueCodes.push("KEYSTORE_UNREADABLE");
    }
  }

  const uniqueIssueCodes = [...new Set(issueCodes)];
  return {
    shapeReady: uniqueIssueCodes.length === 0,
    keyProperties,
    requiredKeys,
    keystore,
    issueCodes: uniqueIssueCodes,
    secretValuesPrinted: false,
  };
}

function readRequired(rootDir, relativePath, issues) {
  const target = path.join(rootDir, relativePath);
  if (!fs.existsSync(target)) {
    issues.push(createIssue("MISSING_FILE", relativePath, "required Android release file is absent"));
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function parseGradleInteger(source, name) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+)\\b`));
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractNamedGradleBlock(source, name) {
  const startMatch = new RegExp(`\\b${name}\\s*\\{`).exec(source);
  if (!startMatch) return "";
  const openBrace = source.indexOf("{", startMatch.index);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }
  return "";
}

function requireSdk(issues, source, name, expected, code) {
  const actual = parseGradleInteger(source, name);
  if (actual !== expected) {
    issues.push(
      createIssue(
        code,
        FILES.variables,
        `${name} must be ${expected}; received ${actual === null ? "missing" : actual}`,
      ),
    );
  }
}

function findAndroidReleaseConfigIssues({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const issues = [];
  const packageJsonSource = readRequired(rootDir, FILES.packageJson, issues);
  const packageLockSource = readRequired(rootDir, FILES.packageLock, issues);
  const appVersionSource = readRequired(rootDir, FILES.appVersion, issues);
  const variables = readRequired(rootDir, FILES.variables, issues);
  const appBuild = readRequired(rootDir, FILES.appBuild, issues);
  const manifest = readRequired(rootDir, FILES.manifest, issues);
  const activity = readRequired(rootDir, FILES.activity, issues);
  const backPlugin = readRequired(rootDir, FILES.backPlugin, issues);
  const capacitorConfig = readRequired(rootDir, FILES.capacitorConfig, issues);
  const database = readRequired(rootDir, FILES.database, issues);
  const runbook = readRequired(rootDir, FILES.runbook, issues);

  if (packageJsonSource) {
    let packageVersion = null;
    try {
      const parsed = JSON.parse(packageJsonSource);
      packageVersion = typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      issues.push(
        createIssue(
          "PACKAGE_JSON_INVALID",
          FILES.packageJson,
          "package.json must be valid JSON with a string version",
        ),
      );
    }
    if (packageVersion !== null && packageVersion !== EXPECTED_RELEASE_IDENTITY.versionName) {
      issues.push(
        createIssue(
          "PACKAGE_VERSION_MISMATCH",
          FILES.packageJson,
          `package version must be ${EXPECTED_RELEASE_IDENTITY.versionName}; received ${packageVersion}`,
        ),
      );
    } else if (packageVersion === null && !issues.some(({ code }) => code === "PACKAGE_JSON_INVALID")) {
      issues.push(
        createIssue(
          "PACKAGE_JSON_INVALID",
          FILES.packageJson,
          "package.json must contain a string version",
        ),
      );
    }
  }

  if (packageLockSource) {
    let lockVersions = null;
    try {
      const parsed = JSON.parse(packageLockSource);
      lockVersions = {
        manifest: typeof parsed.version === "string" ? parsed.version : null,
        root: typeof parsed.packages?.[""]?.version === "string"
          ? parsed.packages[""].version
          : null,
      };
    } catch {
      issues.push(
        createIssue(
          "PACKAGE_LOCK_INVALID",
          FILES.packageLock,
          "package-lock.json must be valid JSON with manifest and root package versions",
        ),
      );
    }
    if (
      lockVersions !== null &&
      (lockVersions.manifest !== EXPECTED_RELEASE_IDENTITY.versionName ||
        lockVersions.root !== EXPECTED_RELEASE_IDENTITY.versionName)
    ) {
      issues.push(
        createIssue(
          "PACKAGE_LOCK_VERSION_MISMATCH",
          FILES.packageLock,
          `package-lock manifest and root versions must both be ${EXPECTED_RELEASE_IDENTITY.versionName}; received ${lockVersions.manifest ?? "missing"}/${lockVersions.root ?? "missing"}`,
        ),
      );
    }
  }

  if (appVersionSource) {
    const appVersionMatch = appVersionSource.match(
      /\bexport\s+const\s+APP_VERSION\s*=\s*["']([^"']+)["']/u,
    );
    const appVersion = appVersionMatch?.[1] ?? null;
    if (appVersion !== EXPECTED_RELEASE_IDENTITY.versionName) {
      issues.push(
        createIssue(
          "APP_VERSION_MISMATCH",
          FILES.appVersion,
          `APP_VERSION must be ${EXPECTED_RELEASE_IDENTITY.versionName}; received ${appVersion ?? "missing"}`,
        ),
      );
    }
  }

  if (variables) {
    requireSdk(
      issues,
      variables,
      "minSdkVersion",
      EXPECTED_SDKS.minSdkVersion,
      "MIN_SDK_MISMATCH",
    );
    requireSdk(
      issues,
      variables,
      "compileSdkVersion",
      EXPECTED_SDKS.compileSdkVersion,
      "COMPILE_SDK_MISMATCH",
    );
    requireSdk(
      issues,
      variables,
      "targetSdkVersion",
      EXPECTED_SDKS.targetSdkVersion,
      "TARGET_SDK_MISMATCH",
    );
  }

  if (appBuild) {
    const requiredDelegations = [
      "compileSdk = rootProject.ext.compileSdkVersion",
      "minSdkVersion rootProject.ext.minSdkVersion",
      "targetSdkVersion rootProject.ext.targetSdkVersion",
    ];
    for (const token of requiredDelegations) {
      if (!appBuild.includes(token)) {
        issues.push(
          createIssue(
            "APP_SDK_DELEGATION_MISSING",
            FILES.appBuild,
            `app build must delegate SDK configuration through: ${token}`,
          ),
        );
      }
    }

    const defaultConfig = extractNamedGradleBlock(appBuild, "defaultConfig");
    const versionNameMatch = defaultConfig.match(/\bversionName\s+["']([^"']+)["']/);
    const versionCodeMatch = defaultConfig.match(/\bversionCode\s+(\d+)\b/);
    const versionName = versionNameMatch?.[1] ?? null;
    const versionCode = versionCodeMatch ? Number.parseInt(versionCodeMatch[1], 10) : null;
    if (versionName !== EXPECTED_RELEASE_IDENTITY.versionName) {
      issues.push(
        createIssue(
          "VERSION_NAME_MISMATCH",
          FILES.appBuild,
          `versionName must be ${EXPECTED_RELEASE_IDENTITY.versionName}; received ${versionName ?? "missing"}`,
        ),
      );
    }
    if (versionCode !== EXPECTED_RELEASE_IDENTITY.heldVersionCode) {
      issues.push(
        createIssue(
          "VERSION_CODE_NOT_AUTHORIZED",
          FILES.appBuild,
          `versionCode must remain ${EXPECTED_RELEASE_IDENTITY.heldVersionCode} until the authenticated Play maximum is recorded; received ${versionCode ?? "missing"}`,
        ),
      );
    }

    const buildTypes = extractNamedGradleBlock(appBuild, "buildTypes");
    const release = extractNamedGradleBlock(buildTypes, "release");
    if (!/\bminifyEnabled\s+true\b/.test(release)) {
      issues.push(
        createIssue(
          "RELEASE_MINIFICATION_DISABLED",
          FILES.appBuild,
          "release build must keep R8 minification enabled",
        ),
      );
    }
    if (!/\bshrinkResources\s+true\b/.test(release)) {
      issues.push(
        createIssue(
          "RELEASE_RESOURCE_SHRINKING_DISABLED",
          FILES.appBuild,
          "release build must shrink resources after R8 analysis",
        ),
      );
    }
    if (
      !/\bproguardFiles\b/.test(release) ||
      !/proguard-android-optimize\.txt/.test(release) ||
      !/proguard-rules\.pro/.test(release)
    ) {
      issues.push(
        createIssue(
          "RELEASE_PROGUARD_CONFIG_MISSING",
          FILES.appBuild,
          "release build must retain the optimized default and app ProGuard rules",
        ),
      );
    }
    if (!/\bdebugSymbolLevel\s+["']FULL["']/.test(release)) {
      issues.push(
        createIssue(
          "RELEASE_NATIVE_SYMBOLS_INCOMPLETE",
          FILES.appBuild,
          "release build must retain FULL native debug symbols",
        ),
      );
    }

    const signingGuardTokens = [
      "ZENFLOW_RELEASE_SIGNING_PROPERTY_KEYS",
      "zenflowReleaseSigningConfigured",
      "releaseBuildRequested && !zenflowReleaseSigningConfigured",
      "signingConfig signingConfigs.release",
    ];
    if (signingGuardTokens.some((token) => !appBuild.includes(token))) {
      issues.push(
        createIssue(
          "RELEASE_SIGNING_GUARD_MISSING",
          FILES.appBuild,
          "distributable release tasks must fail closed unless every upload-signing input and the keystore file are available",
        ),
      );
    }

    const firebaseGuardTokens = [
      "zenflowGoogleServicesConfigured",
      "releaseBuildRequested && !zenflowGoogleServicesConfigured",
      "apply plugin: 'com.google.gms.google-services'",
    ];
    if (firebaseGuardTokens.some((token) => !appBuild.includes(token))) {
      issues.push(
        createIssue(
          "RELEASE_FIREBASE_GUARD_MISSING",
          FILES.appBuild,
          "distributable release tasks must fail closed unless the ignored Android Firebase configuration is present",
        ),
      );
    }
  }

  if (manifest) {
    if (!/android:enableOnBackInvokedCallback\s*=\s*["']true["']/.test(manifest)) {
      issues.push(
        createIssue(
          "PREDICTIVE_BACK_DISABLED",
          FILES.manifest,
          "application must explicitly keep predictive Back enabled",
        ),
      );
    }

    const adaptiveRestrictions = [
      /android:screenOrientation\s*=/,
      /android:resizeableActivity\s*=\s*["']false["']/,
      /android:maxAspectRatio\s*=/,
      /android:minAspectRatio\s*=/,
      /android:(?:smallScreens|normalScreens|largeScreens|xlargeScreens|resizeable)\s*=\s*["']false["']/,
    ];
    if (adaptiveRestrictions.some((pattern) => pattern.test(manifest))) {
      issues.push(
        createIssue(
          "ADAPTIVE_WINDOW_RESTRICTION",
          FILES.manifest,
          "release manifest cannot restrict orientation, resizability, aspect ratio, or large screens",
        ),
      );
    }
  }

  if (activity && !activity.includes("registerPlugin(AndroidBackPlugin.class);")) {
    issues.push(
      createIssue(
        "BACK_PLUGIN_NOT_REGISTERED",
        FILES.activity,
        "MainActivity must register the AndroidBack plugin before bridge creation",
      ),
    );
  }

  if (backPlugin) {
    if (!backPlugin.includes("OnBackPressedCallback") || !backPlugin.includes("addCallback(")) {
      issues.push(
        createIssue(
          "ANDROIDX_BACK_CALLBACK_MISSING",
          FILES.backPlugin,
          "custom Back bridge must use a lifecycle-bound AndroidX callback",
        ),
      );
    }
    if (/\bonBackPressed\s*\(|KEYCODE_BACK|dispatchKeyEvent\s*\(/.test(backPlugin)) {
      issues.push(
        createIssue(
          "LEGACY_BACK_DISPATCH",
          FILES.backPlugin,
          "target-36 release code cannot depend on legacy Back dispatch",
        ),
      );
    }
  }

  if (
    capacitorConfig &&
    !/App\s*:\s*\{[\s\S]*?disableBackButtonHandler\s*:\s*true/.test(capacitorConfig)
  ) {
    issues.push(
      createIssue(
        "CAPACITOR_BACK_HANDLER_ENABLED",
        FILES.capacitorConfig,
        "Capacitor App's competing Back handler must remain disabled",
      ),
    );
  }

  if (database) {
    if (!/this\.version\(11\)\.stores\s*\(/.test(database)) {
      issues.push(
        createIssue(
          "DEXIE_V11_SCHEMA_MISSING",
          FILES.database,
          "Android 2.1 must declare Dexie schema v11",
        ),
      );
    }
    for (const storeName of [
      "automationTransactions",
      "automationHistoryMarkers",
      "automationRemoteEvents",
    ]) {
      if (!database.includes(storeName)) {
        issues.push(
          createIssue(
            "DEXIE_V11_STORE_MISSING",
            FILES.database,
            `Dexie v11 must declare ${storeName}`,
          ),
        );
      }
      if (!new RegExp(`db\\.${storeName}\\.clear\\(\\)`).test(database)) {
        issues.push(
          createIssue(
            "DEXIE_V11_ACCOUNT_CLEAR_MISSING",
            FILES.database,
            `account-bound cleanup must clear ${storeName}`,
          ),
        );
      }
    }
  }

  if (runbook) {
    if (!/^forward_schema_floor:\s*11\s*$/m.test(runbook)) {
      issues.push(
        createIssue(
          "FORWARD_SCHEMA_FLOOR_INVALID",
          FILES.runbook,
          "forward_schema_floor must remain 11 after v11 distribution",
        ),
      );
    }
    if (!/^legacy_v10_rollback:\s*forbidden\s*$/m.test(runbook)) {
      issues.push(
        createIssue(
          "LEGACY_V10_ROLLBACK_ALLOWED",
          FILES.runbook,
          "legacy_v10_rollback must be forbidden",
        ),
      );
    }
    if (!/^rollback_artifact:\s*v11-aware-or-newer\s*$/m.test(runbook)) {
      issues.push(
        createIssue(
          "ROLLBACK_ARTIFACT_NOT_V11_AWARE",
          FILES.runbook,
          "rollback_artifact must be v11-aware-or-newer",
        ),
      );
    }
  }

  return issues;
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  if (process.argv.includes("--signing-readiness")) {
    const result = inspectAndroidReleaseSigningInputs({ rootDir });
    console.log(JSON.stringify(result, null, 2));
    if (!result.shapeReady) process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--native-services-readiness")) {
    const result = inspectAndroidReleaseNativeServicesInputs({ rootDir });
    console.log(JSON.stringify(result, null, 2));
    if (!result.shapeReady) process.exitCode = 1;
    return;
  }
  const issues = findAndroidReleaseConfigIssues({ rootDir });
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[android-release-config] FAIL ${issue.code} ${issue.file}: ${issue.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `[android-release-config] PASS version=${EXPECTED_RELEASE_IDENTITY.versionName}/${EXPECTED_RELEASE_IDENTITY.heldVersionCode} minSdk=${EXPECTED_SDKS.minSdkVersion} compileSdk=${EXPECTED_SDKS.compileSdkVersion} targetSdk=${EXPECTED_SDKS.targetSdkVersion} adaptive=true predictiveBack=true r8=true shrinkResources=true nativeSymbols=FULL forwardSchema=11`,
  );
}

module.exports = {
  EXPECTED_SDKS,
  findAndroidReleaseConfigIssues,
  inspectAndroidReleaseNativeServicesInputs,
  inspectAndroidReleaseSigningInputs,
};

if (require.main === module) {
  main();
}
