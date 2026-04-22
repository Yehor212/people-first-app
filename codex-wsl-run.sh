#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/mnt/c/project/people-first-app}"
TARGET_DIR="${TARGET_DIR:-$HOME/code/people-first-app}"

log() {
  printf '[codex-wsl-run] %s\n' "$1"
}

load_nvm() {
  export NVM_DIR="${HOME}/.nvm"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
    nvm use default >/dev/null 2>&1 || true
  fi
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log "Required command not found: $name"
    exit 1
  fi
}

copy_repo() {
  mkdir -p "$TARGET_DIR"

  if command -v rsync >/dev/null 2>&1; then
    log "Syncing repository with rsync"
    rsync -ah --delete --info=progress2 --exclude=node_modules "$SOURCE_DIR"/ "$TARGET_DIR"/
    return
  fi

  log "rsync not found; falling back to tar copy"
  tar --exclude=node_modules -C "$SOURCE_DIR" -cf - . | tar -C "$TARGET_DIR" -xf -
}

install_deps() {
  cd "$TARGET_DIR"
  rm -rf node_modules
  log "Running npm install in $TARGET_DIR"
  npm install
}

launch_codex() {
  cd "$TARGET_DIR"
  log "Launching Codex from $TARGET_DIR"
  exec codex
}

main() {
  load_nvm
  require_command npm
  require_command codex

  if [ ! -d "$SOURCE_DIR" ]; then
    log "Source directory not found: $SOURCE_DIR"
    exit 1
  fi

  log "Source: $SOURCE_DIR"
  log "Target: $TARGET_DIR"
  copy_repo
  install_deps
  launch_codex
}

main "$@"
