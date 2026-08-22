# Diagnostic Data Model

This model describes audit evidence only. It does not add a product database, store, API, or runtime data collection.

## Workspace Lane

| Field | Meaning | Validation |
|---|---|---|
| `root_path` | Absolute linked-worktree or checkout path | Must resolve via `git rev-parse --show-toplevel` |
| `branch` | Checked-out branch name | Must be a named branch; `main` and `codex/*` are not interchangeable |
| `head_sha` | Current commit object | Must be a full SHA from Git |
| `dirty_paths` | Tracked/untracked edits at audit time | Derived from `git status --short`; no content required |
| `lock_state` | Linked-worktree lock and reason | Derived from `git worktree list --porcelain` |
| `vscode_workspace_path` | Generated one-root workspace file | Must contain exactly one folder that equals `root_path` |

## Change Lineage

| Field | Meaning | Validation |
|---|---|---|
| `source_branch` | Feature or agent branch | Git ref exists locally/remotely |
| `source_tip` | Exact source commit | Full SHA |
| `merge_base` | Common ancestor with `origin/main` | Produced by `git merge-base` |
| `main_relation` | ahead/behind/reachable relationship | Produced by `git rev-list --left-right --count` and ancestry check |
| `review_receipt` | PR number/state/base/head | Read-only GitHub metadata |
| `final_change_count` | Files in final reviewed merge diff | Calculated against the merge first parent, not an unreconciled snapshot |

### Change Lineage States

```text
local-uncommitted
  → committed-feature
  → pushed-feature
  → reviewed-PR
  → merged-main
  → deploy-run
  → public-web-artifact

Installed PWA profile freshness is a separate branch from public-web-artifact.
```

## Web Deployment Receipt

| Field | Meaning | Validation |
|---|---|---|
| `main_sha` | Current `origin/main` SHA | `git ls-remote` or fresh fetch-visible ref |
| `workflow_run_id` | GitHub Actions `deploy.yml` run | Read-only run metadata |
| `workflow_head_sha` | Run's triggered commit | Must equal `main_sha` for current-release claim |
| `deploy_job_conclusion` | Deploy job state | Must be `success` to claim public publication |
| `public_url` | GitHub Pages target | Stable canonical public route |
| `cache_buster` | One non-sensitive query value | Must be used for public artifact observation |
| `bundle_identity` | Module asset path observed in current document | Must come from the public DOM, not an assumed local build |

## Client Freshness State

| Field | Meaning | Boundary |
|---|---|---|
| `profile_kind` | clean audit browser, installed PWA, desktop app, native app | Never infer one profile from another |
| `online_state` | Whether network fetch was available | Profile-specific |
| `worker_state` | Active/waiting/installing service worker | Requires direct profile inspection |
| `version_result` | current, stale, unavailable | Produced by app update path, not guessed |
| `bootstrap_mismatch_action` | generated early script's cache/SW cleanup when version mismatches | Source-confirmed; profile execution still requires direct observation |
| `pending_writes` | Durable work that must settle before reload | Never inspect user content; app owns this behavior |

### Client Freshness State Transitions

```text
unknown
  → update-check-current
  → update-check-stale
  → safe-reload-requested
  → refreshed-or-unavailable
```

No audit transition authorizes an operator to issue `clear-storage`, `unregister-worker`, or `delete-cache`. The pre-existing generated bootstrap's automated mismatch action is recorded separately and is not an audit action.
