const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_STATES = ["idle", "press", "complete", "disabled", "reduced"];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const EXPECTED_ICON_COUNT = 22;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateHabitIconManifest(manifest, options = {}) {
  const rootDir = options.rootDir || "src/assets/habit-icons/v2";
  const checkFiles = options.checkFiles !== false;
  const errors = [];
  const icons = toArray(manifest && manifest.icons);
  const seen = new Set();

  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (icons.length !== EXPECTED_ICON_COUNT) errors.push("manifest must contain " + EXPECTED_ICON_COUNT + " icons");

  for (const icon of icons) {
    const id = typeof icon.id === "string" && icon.id.length > 0 ? icon.id : "unknown";
    if (seen.has(id)) errors.push(id + ": duplicate icon id");
    seen.add(id);

    if (EMOJI_RE.test(icon.label || "")) errors.push(id + ": label must not contain emoji");
    if (!icon.reduced) errors.push(id + ": reduced SVG is required");
    if (!icon.source) errors.push(id + ": source is required");
    if (!icon.license) errors.push(id + ": license is required");
    if (!icon.idle || typeof icon.idle !== "object") errors.push(id + ": idle contract is required");
    if (icon.idle && icon.idle.durationMs > 3000) errors.push(id + ": idle duration must be <= 3000ms");
    if (icon.idle && icon.idle.bytes > 80000) errors.push(id + ": idle animation must be <= 80000 bytes");

    for (const state of REQUIRED_STATES) {
      if (!toArray(icon.states).includes(state)) errors.push(id + ": missing state " + state);
    }

    if (checkFiles && icon.reduced) {
      const reducedPath = path.join(rootDir, icon.reduced);
      if (!fs.existsSync(reducedPath)) {
        errors.push(id + ": missing reduced file " + icon.reduced);
      } else {
        const reducedSource = fs.readFileSync(reducedPath, "utf8");
        if (!/<svg\b/.test(reducedSource)) errors.push(id + ": reduced file must be SVG");
        if (EMOJI_RE.test(reducedSource)) errors.push(id + ": reduced SVG must not contain emoji");
      }
    }
  }

  return {
    errors,
    iconCount: icons.length,
    ids: icons.map((icon) => icon.id),
  };
}

if (require.main === module) {
  const manifestPath = process.argv[2] || "src/assets/habit-icons/v2/manifest.json";
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const result = validateHabitIconManifest(manifest, {
    rootDir: path.dirname(manifestPath),
    checkFiles: true,
  });
  if (result.errors.length > 0) {
    console.error(result.errors.join("\n"));
    process.exit(1);
  }
  console.log("Validated " + result.iconCount + " v2 habit icons");
}

module.exports = { validateHabitIconManifest };
