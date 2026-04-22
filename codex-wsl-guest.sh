#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22}"
NVM_VERSION="${NVM_VERSION:-v0.40.3}"

log() {
  printf '[codex-wsl-guest] %s\n' "$1"
}

ensure_nvm() {
  if [ -d "${HOME}/.nvm" ]; then
    return
  fi

  log "Installing nvm ${NVM_VERSION}"
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
}

load_nvm() {
  export NVM_DIR="${HOME}/.nvm"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
  else
    log "nvm was not found after installation"
    exit 1
  fi
}

ensure_node() {
  if command -v nvm >/dev/null 2>&1; then
    :
  fi

  log "Installing Node.js ${NODE_VERSION}"
  nvm install "${NODE_VERSION}"
  nvm alias default "${NODE_VERSION}"
  nvm use default >/dev/null
}

install_codex() {
  log "Installing latest @openai/codex"
  npm install -g @openai/codex
}

maybe_install_repo_dependencies() {
  if [ -f "package.json" ]; then
    log "package.json detected; running npm install"
    npm install
  else
    log "No package.json in current directory; skipping npm install"
  fi
}

log "Starting WSL guest bootstrap"
ensure_nvm
load_nvm
ensure_node
install_codex
maybe_install_repo_dependencies

log "Done"
log "Recommended next steps:"
log "  mkdir -p ~/code"
log "  cd ~/code"
log "  git clone <repo-url> people-first-app"
log "  cd people-first-app"
log "  codex"
