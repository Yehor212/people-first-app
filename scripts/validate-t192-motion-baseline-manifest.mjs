const REQUIRED_LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const DIRECT_LOCALES = ["en", "ar", "he"];
const REQUIRED_FLOWS = ["gratitude-bloom", "let-go"];
const MOTION_PREFERENCES = ["normal", "reduced"];
const SHA256 = /^[a-f0-9]{64}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label} is required`);
}

function requireHash(value, label, errors) {
  if (typeof value !== "string" || !SHA256.test(value)) errors.push(`${label} must be SHA-256`);
}

function validateRow(row, index, errors) {
  const label = `rows[${index}]`;
  if (!isObject(row)) {
    errors.push(`${label} must be an object`);
    return;
  }
  requireText(row.id, `${label}.id`, errors);
  requireText(row.flow, `${label}.flow`, errors);
  if (row.subject_kind !== "non_orb") errors.push(`${label}.subject_kind must be non_orb`);
  requireHash(row.apk_sha256, `${label}.apk_sha256`, errors);
  requireText(row.locale, `${label}.locale`, errors);
  const expectedDirection = ["ar", "he"].includes(row.locale) ? "rtl" : "ltr";
  if (row.direction !== expectedDirection) errors.push(`${label}.direction must be ${expectedDirection}`);
  if (!MOTION_PREFERENCES.includes(row.motion_preference)) {
    errors.push(`${label}.motion_preference must be normal or reduced`);
  }
  for (const field of ["route", "trigger", "start_condition", "end_condition"]) {
    requireText(row[field], `${label}.${field}`, errors);
  }
  if (!isObject(row.device)) {
    errors.push(`${label}.device is required`);
  } else {
    for (const field of ["api", "abi", "viewport", "density", "font_scale"]) {
      if (row.device[field] === undefined || row.device[field] === null || row.device[field] === "") {
        errors.push(`${label}.device.${field} is required`);
      }
    }
  }
  if (!isObject(row.capture)) {
    errors.push(`${label}.capture is required`);
  } else {
    requireText(row.capture.path, `${label}.capture.path`, errors);
    requireHash(row.capture.sha256, `${label}.capture.sha256`, errors);
    for (const field of ["bytes", "duration_seconds", "fps"]) {
      if (!(Number(row.capture[field]) > 0)) errors.push(`${label}.capture.${field} must be positive`);
    }
  }
  if (!isObject(row.lifecycle)) {
    errors.push(`${label}.lifecycle is required`);
  } else {
    for (const field of ["back_cancel", "rapid_retrigger", "background_resume", "cleanup", "resource_owner"]) {
      if (row.lifecycle[field] !== "PASS") errors.push(`${label}.lifecycle.${field} must be PASS`);
    }
  }
  if (!isObject(row.privacy) || row.privacy.raw_private_content !== false) {
    errors.push(`${label}.privacy.raw_private_content must be false`);
  }
}

export function validateT192BaselineManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return { errors: ["manifest must be an object"] };
  if (manifest.task !== "T192") errors.push("task must be T192");
  if (!isObject(manifest.source_freeze)) errors.push("source_freeze is required");
  else requireText(manifest.source_freeze.commit, "source_freeze.commit", errors);
  if (!isObject(manifest.artifacts?.normal)) errors.push("normal artifact is required");
  else {
    requireHash(manifest.artifacts.normal.apk_sha256, "normal artifact APK hash", errors);
    if (manifest.artifacts.normal.qa_sentinel_present !== false) {
      errors.push("normal artifact must prove QA sentinel absent");
    }
  }
  if (!isObject(manifest.artifacts?.qa)) errors.push("QA artifact is required");
  else requireHash(manifest.artifacts.qa.apk_sha256, "QA artifact APK hash", errors);
  if (!Array.isArray(manifest.locale_applicability) || REQUIRED_LOCALES.some((locale) => !manifest.locale_applicability.includes(locale))) {
    errors.push("all eight locale applicability rows are required");
  }
  if (!Array.isArray(manifest.rows)) {
    errors.push("rows must be an array");
    return { errors };
  }
  manifest.rows.forEach((row, index) => validateRow(row, index, errors));
  for (const flow of REQUIRED_FLOWS) {
    for (const locale of DIRECT_LOCALES) {
      for (const motionPreference of MOTION_PREFERENCES) {
        const matches = manifest.rows.filter((row) =>
          row?.flow === flow && row?.locale === locale && row?.motion_preference === motionPreference,
        );
        if (matches.length !== 1) errors.push(`exactly one ${flow}/${locale}/${motionPreference} capture row is required`);
      }
    }
  }
  return { errors };
}
