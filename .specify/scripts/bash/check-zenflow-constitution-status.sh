#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd -P)
STATUS_FILE="$REPO_ROOT/.specify/memory/constitution-status.json"
CONSTITUTION_FILE="$REPO_ROOT/.specify/memory/constitution.md"

fail() {
    printf 'constitution status gate: %s\n' "$1" >&2
    exit 2
}

for required_file in "$STATUS_FILE" "$CONSTITUTION_FILE"; do
    [[ -f "$required_file" && ! -L "$required_file" ]] || fail "required regular file missing or symlinked: $required_file"
done

command -v jq >/dev/null 2>&1 || fail "jq is required"

jq -e '
    .schema_version == 1 and
    .constitution_version == "1.0.1" and
    .status == "PROPOSED" and
    .ratified == false and
    .activation == "PROPOSAL_CRITERIA_ONLY" and
    .binding == false and
    .blocking_authority == false and
    .critical_remediation_authority == false and
    .ratification_evidence == null and
    .source == ".specify/memory/constitution.md" and
    .proposed_on == "2026-08-02"
' "$STATUS_FILE" >/dev/null || fail "status record is inconsistent or claims unverified authority"

STATUS_MARKER='<!-- ZENFLOW_CONSTITUTION_STATUS: status=PROPOSED; ratified=false; activation=PROPOSAL_CRITERIA_ONLY; binding=false; blocking_authority=false; critical_remediation_authority=false -->'
STATUS_FOOTER='**Status**: PROPOSED | **Version**: 1.0.1 | **Ratified**: UNRATIFIED | **Proposed**: 2026-08-02'

grep -Fqx -- "$STATUS_MARKER" "$CONSTITUTION_FILE" || fail "constitution status marker does not match the status record"
grep -Fqx -- "$STATUS_FOOTER" "$CONSTITUTION_FILE" || fail "constitution footer does not match the status record"

if [[ "${1:-}" == "--json" ]]; then
    jq -c '{
        schema_version,
        constitution_version,
        status,
        ratified,
        activation,
        binding,
        blocking_authority,
        critical_remediation_authority,
        ratification_evidence,
        source
    }' "$STATUS_FILE"
else
    printf '%s\n' 'constitution status gate: PROPOSAL_CRITERIA_ONLY (nonbinding; no blocking or critical-remediation authority)'
fi
