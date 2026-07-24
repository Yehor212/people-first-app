"use strict";

const DUPLICATE_ARTIFACT_ORDINAL_PATTERN = / \d+(?=\.|$)/;

function hasDuplicateArtifactOrdinal(name) {
  return typeof name === "string" && DUPLICATE_ARTIFACT_ORDINAL_PATTERN.test(name);
}

module.exports = { hasDuplicateArtifactOrdinal };
