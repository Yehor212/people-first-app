# Quickstart: Verify Installed PWA Modernization

## Preconditions

- Work only in `/Users/yehor/Projects/ZenFlow/worktrees/codex-pwa-desktop-modernization`.
- Confirm branch `codex/pwa-desktop-modernization`, clean intended baseline, and `agent:workspace doctor --mode edit --agent codex` = `GO`.
- Do not use real accounts, production journal/mood/habit data, tokens, or contact data.
- Do not push, deploy, sign, submit to a Store, or mutate production state from this quickstart.

## Focused RED/GREEN

```bash
npx vitest run scripts/__tests__/public-webmanifest-contract.test.ts
npx vitest run src/hooks/__tests__/usePwaInstall.test.ts
```

The retained four-test PWA contract is replayed unchanged against base and candidate. Its base replay is retrospective characterization, because the retained receipt postdates the first implementation edits; it is not represented as chronological test-first proof. Review-remediation tests for cache preservation, update recovery, Tauri ownership, install-success state, Safari account/copy boundaries, malformed locale values, and manifest truth were recorded RED before their corresponding production changes and then rerun unchanged GREEN.

## Candidate-State Hash

Evidence binds to base commit `13ca51a80d23220574deba762851fe5a32372e46` and to one deterministic SHA-256 for the dirty candidate. Algorithm `zenflow-candidate-state-v3` does not hash rendered `git diff` output, because diff formatting and ordering can inherit host configuration. It hashes this exact byte stream instead, using unsigned big-endian integers and no implicit text normalization:

1. ASCII domain separator `zenflow-candidate-state-v3`, then one NUL byte;
2. the full lowercase base-commit SHA in ASCII, then one NUL byte;
3. `uint32` count of stage-0 index records from raw `git ls-files --stage -z --`, sorted by raw path bytes with `Buffer.compare`;
4. for each tracked record: `uint32` raw-path length and bytes; `uint16` index-mode length and ASCII mode; `uint16` object-ID length and lowercase ASCII object ID; `uint16` index stage; then exactly one state byte: `0x00` deleted, `0x01` regular file, or `0x02` symbolic link. A present record continues with `uint16` Git-relevant worktree-mode length and ASCII mode plus `uint64` payload length and raw payload bytes;
5. `uint32` count of paths from raw `git ls-files --others --exclude-per-directory=.gitignore -z --`, again sorted by raw path bytes;
6. for each untracked record: the same length-prefixed raw path, state byte, Git-relevant mode, payload length, and payload bytes, without index metadata.

A regular file uses worktree mode `100755` when any executable bit is set and otherwise `100644`; its payload is its file bytes. A symbolic link uses mode `120000`; its payload is the raw link-target bytes. A deleted tracked path has no payload. Non-stage-0 index entries, Gitlinks, directories in a file position, sockets, FIFOs, devices, unsafe paths, and entries that change identity/type/size/mode/timestamps while hashing are errors. Index object IDs bind staged state; worktree payloads bind unstaged state; deleted records bind removals. This avoids host diff-prefix, heuristic, context, color, quoting, order-file, rename, text-conversion, and external-diff configuration entirely.

The length prefixes and Git-relevant modes prevent path/content boundary or executable/symlink substitutions from preserving the digest. The retained runner performs two complete independent passes and fails unless HEAD, index metadata, tracked/untracked inventory, counts, payload totals, and digest agree. Repository `.gitignore` files, including the rule for `output/` evidence, define intentional ignored paths. Global `core.excludesFile` and worktree-local `.git/info/exclude` are deliberately not consulted, so host configuration cannot silently remove a candidate path from the digest. Canonical ignored receipts are bound separately: an evidence manifest records each retained receipt's relative path, byte length, Git-relevant executable mode, and SHA-256; a final closure receipt binds the candidate digest and evidence-manifest SHA-256 while both manifests exclude themselves to avoid circular hashing. Recompute the candidate digest after the last tracked source/spec change and generate the evidence manifest only after the last retained check, before Role 8/10 closure.

## Production PWA

```bash
npm run build
ZENFLOW_PWA_OFFLINE_SKIP_BUILD=true npx playwright test \
  e2e/pwa-desktop-lifecycle.spec.ts \
  --config=e2e/helpers/pwa-offline/playwright.config.ts
```

Inspect the generated `dist/manifest.webmanifest`, `dist/sw.js`, `dist/registerSW.js`, offline document, shortcut URLs, and service-worker cache names. A mocked standalone flag is contract evidence only; it is not a real OS install pass.

Then prepare and stage the exact Pages artifact and rerun the same suite against it:

```bash
node scripts/prepare-pages-artifact.cjs
npm run stage:release-artifacts
ZENFLOW_PWA_OFFLINE_SKIP_BUILD=true \
ZENFLOW_PWA_OFFLINE_PREVIEW_DIR=output/pages-artifact.nosync \
npx playwright test e2e/pwa-desktop-lifecycle.spec.ts \
  --config=e2e/helpers/pwa-offline/playwright.config.ts
```

Preparation writes an internal SHA-256 manifest for every uploadable path, size,
Git-relevant executable mode and byte sequence. Staging verifies that seal before and after copying, then
excludes the internal manifest from the upload. This closes same-filename
mutation gaps for Workbox `revision:null` assets; it is artifact provenance,
not code-signing or public-deployment proof. The staged `index.html` must contain
exactly one cache-busted manifest link. These are local artifact/engine checks;
they do not prove the deployed public URL or a real installed
Windows/macOS/mobile shell.

## Cross-Platform Boundaries

```bash
npx vitest run src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts
npm run check:desktop-exe-contract
npm run check:canonical-orbs
```

The PWA E2E suite includes production-equivalent portrait/landscape resize in Chromium/WebKit because manifest orientation is shared with mobile browsers. Android/iOS native builds must not receive the PWA manifest or service worker. Tauri continues to own its native updater. Real mobile browser installation/safe-area, native-device, and Windows runtime results remain `UNVERIFIED` unless those environments actually run.

## Locale, Visual, Data, and Security

```bash
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run assets:logos:check
npm run assets:logos:proof
npm run check:production-data-integrity:diff
/Users/yehor/.codex/bin/codex-security-suite.sh --profile auto
```

Inspect `tmp/logo-quality-proof-sheet.png`. Structural/logo checks do not constitute `ARTISTIC_PASS` or launcher/device proof.

## Broad Gates

Run build and artifact-sensitive integrity checks sequentially:

```bash
npm run check:all
npm run build
npm run check:production-data-integrity:bundle
npm run smoke:chrome-performance
npm run check:no-ai-templates
npm run check:best-practices
npm run check:agent-context
npm run check:agent-orchestra
npm run ci:preflight
```

## Done Review

```bash
git diff --check
git diff --stat
git status --short
```

Read the complete diff. Confirm no generated asset outside the intended PWA family changed, no mock business records or secrets entered production, and every platform row is `PASS`, `FAIL`, `N/A`, or `UNVERIFIED` with evidence.
