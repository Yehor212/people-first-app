#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const TMP_ROOT = path.join(ROOT, "tmp", "microsoft-store-msix");
const LAYOUT_DIR = path.join(TMP_ROOT, "layout");
const UPLOAD_DIR = path.join(TMP_ROOT, "upload");
const PRODUCT_ID = "9MZK46FHZV8K";
const ARCH = "x64";
const IDENTITY = {
  name: "YehorSha.ZenFlow",
  publisher: "CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B",
  publisherDisplayName: "YehorSha",
};
const PACKAGE_LANGUAGES = ["en-us", "uk", "es", "de", "fr", "ja", "ar", "he"];
const WIN_KIT_ROOT = process.env.ProgramFilesX86
  ? path.join(process.env.ProgramFilesX86, "Windows Kits", "10", "bin")
  : "C:\\Program Files (x86)\\Windows Kits\\10\\bin";

function assertInsideWorkspace(target) {
  const resolvedRoot = path.resolve(ROOT);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to operate outside the workspace: ${resolvedTarget}`);
  }
}

function removeInsideWorkspace(target) {
  assertInsideWorkspace(target);
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

function findWindowsSdkTool(toolName) {
  const candidates = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase() === toolName.toLowerCase()) {
        candidates.push(fullPath);
      }
    }
  }

  walk(WIN_KIT_ROOT);
  candidates.sort((a, b) => b.localeCompare(a));
  const preferred = candidates.find((candidate) => candidate.includes(`${path.sep}${ARCH}${path.sep}`));
  return preferred || candidates[0] || null;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function packageVersion(version) {
  const [major = "0", minor = "0", patch = "0"] = String(version).split(".").map((part) => part.replace(/\D/g, "") || "0");
  return `${major}.${minor}.${patch}.0`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

async function renderAssets() {
  const source = path.join(ROOT, "docs", "release", "microsoft-store", "assets", "official-logo", "zenflow-official-logo-source-1024.png");
  if (!fs.existsSync(source)) {
    throw new Error(`Official Store logo source is missing: ${source}`);
  }

  const assetsDir = path.join(LAYOUT_DIR, "Assets");
  ensureDir(assetsDir);
  const targets = [
    ["StoreLogo.png", 50],
    ["Square44x44Logo.png", 44],
    ["Square150x150Logo.png", 150],
    ["Square300x300Logo.png", 300],
  ];

  for (const [name, size] of targets) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(assetsDir, name));
  }
}

function writeManifest(version) {
  const resourceRows = PACKAGE_LANGUAGES.map((language) => `    <Resource Language="${xmlEscape(language)}" />`).join("\n");
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap10 rescap">
  <Identity Name="${xmlEscape(IDENTITY.name)}" Publisher="${xmlEscape(IDENTITY.publisher)}" Version="${xmlEscape(version)}" ProcessorArchitecture="${ARCH}" />
  <Properties>
    <DisplayName>ZenFlow</DisplayName>
    <PublisherDisplayName>${xmlEscape(IDENTITY.publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Resources>
${resourceRows}
  </Resources>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
  <Applications>
    <Application Id="ZenFlow" Executable="zenflow-desktop.exe" EntryPoint="Windows.FullTrustApplication" uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL">
      <uap:VisualElements
        DisplayName="ZenFlow"
        Description="ZenFlow desktop runtime for daily wellness, habits, journaling, and state-of-mind tracking."
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png"
        BackgroundColor="transparent" />
    </Application>
  </Applications>
</Package>
`;
  fs.writeFileSync(path.join(LAYOUT_DIR, "AppxManifest.xml"), manifest);
}

function runMakePri(makePriPath) {
  if (!makePriPath) {
    return null;
  }

  const configPath = path.join(TMP_ROOT, "priconfig.xml");
  execFileSync(makePriPath, ["createconfig", "/cf", configPath, "/dq", "en-US", "/o"], { stdio: "inherit" });
  execFileSync(makePriPath, ["new", "/pr", LAYOUT_DIR, "/cf", configPath, "/mn", path.join(LAYOUT_DIR, "AppxManifest.xml"), "/o"], {
    cwd: LAYOUT_DIR,
    stdio: "inherit",
  });
  return path.join(LAYOUT_DIR, "resources.pri");
}

function runMakeAppx(makeAppxPath, msixPath) {
  execFileSync(makeAppxPath, ["pack", "/d", LAYOUT_DIR, "/p", msixPath, "/o"], { stdio: "inherit" });
}

function createMsixUpload(msixPath, uploadPath) {
  removeInsideWorkspace(UPLOAD_DIR);
  ensureDir(UPLOAD_DIR);
  copyFile(msixPath, path.join(UPLOAD_DIR, path.basename(msixPath)));

  const zipPath = uploadPath.replace(/\.msixupload$/i, ".zip");
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
  if (fs.existsSync(uploadPath)) fs.rmSync(uploadPath, { force: true });

  const command = [
    "$ErrorActionPreference = 'Stop';",
    `Compress-Archive -Path ${JSON.stringify(path.join(UPLOAD_DIR, "*"))} -DestinationPath ${JSON.stringify(zipPath)} -Force;`,
    `Move-Item -LiteralPath ${JSON.stringify(zipPath)} -Destination ${JSON.stringify(uploadPath)} -Force;`,
  ].join(" ");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { stdio: "inherit" });
}

async function main() {
  assertInsideWorkspace(TMP_ROOT);
  const packageJson = readJson("package.json");
  const version = packageVersion(packageJson.version);
  const exePath = path.join(ROOT, "src-tauri", "target", "release", "zenflow-desktop.exe");
  const makeAppxPath = process.env.ZENFLOW_MAKEAPPX_PATH || findWindowsSdkTool("makeappx.exe");
  const makePriPath = process.env.ZENFLOW_MAKEPRI_PATH || findWindowsSdkTool("makepri.exe");

  if (!fs.existsSync(exePath)) {
    throw new Error(`Desktop runtime is missing: ${exePath}. Run npm run desktop:build first.`);
  }

  if (!makeAppxPath) {
    throw new Error("MakeAppx.exe was not found. Install the Windows SDK before creating the Microsoft Store package.");
  }

  removeInsideWorkspace(TMP_ROOT);
  ensureDir(LAYOUT_DIR);
  copyFile(exePath, path.join(LAYOUT_DIR, "zenflow-desktop.exe"));
  await renderAssets();
  writeManifest(version);
  const priPath = runMakePri(makePriPath);

  const packageBase = `ZenFlow_${version}_${ARCH}`;
  const msixPath = path.join(TMP_ROOT, `${packageBase}.msix`);
  const uploadPath = path.join(TMP_ROOT, `${packageBase}.msixupload`);
  runMakeAppx(makeAppxPath, msixPath);
  createMsixUpload(msixPath, uploadPath);

  const resourcesPri = priPath && fs.existsSync(priPath) ? priPath : null;
  const metadata = {
    productId: PRODUCT_ID,
    packageIdentityName: IDENTITY.name,
    publisher: IDENTITY.publisher,
    publisherDisplayName: IDENTITY.publisherDisplayName,
    version,
    architecture: ARCH,
    languages: PACKAGE_LANGUAGES,
    makeAppxPath,
    makePriPath,
    resourcesPri,
    msixPath: path.relative(ROOT, msixPath).replace(/\\/g, "/"),
    msixSha256: sha256(msixPath),
    msixUploadPath: path.relative(ROOT, uploadPath).replace(/\\/g, "/"),
    msixUploadSha256: sha256(uploadPath),
    generatedAt: new Date().toISOString(),
    storeSubmissionNote:
      "Upload the .msixupload file to Partner Center > Submission 1 > Packages. Microsoft Store signing is handled by Microsoft after certification; do not claim final readiness until Partner Center accepts the package.",
  };
  fs.writeFileSync(path.join(TMP_ROOT, "package-manifest.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log("[desktop-store-package] PASS");
  console.log(`[desktop-store-package] MSIX: ${metadata.msixPath}`);
  console.log(`[desktop-store-package] MSIXUPLOAD: ${metadata.msixUploadPath}`);
  console.log(`[desktop-store-package] SHA256: ${metadata.msixUploadSha256}`);
}

main().catch((error) => {
  console.error("[desktop-store-package] FAIL");
  console.error(error.message);
  process.exit(1);
});
