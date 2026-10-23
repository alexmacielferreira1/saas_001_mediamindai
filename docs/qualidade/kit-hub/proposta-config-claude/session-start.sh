#!/bin/bash
# Prepara sessões do Claude Code na nuvem: venv Python 3.12 + dependências do backend
# e node_modules do frontend. Não roda nas sessões locais (Windows).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -f requirements.lock ]; then
  PY=$(command -v python3.12 || command -v python3)
  if command -v uv >/dev/null 2>&1; then
    [ -x .venv/bin/python ] || uv venv -q -p "$PY" .venv
    uv pip install -q -p .venv/bin/python -r requirements.lock "pytest>=8,<10" "ruff>=0.9,<1" httpx
  else
    [ -x .venv/bin/python ] || "$PY" -m venv .venv
    .venv/bin/python -m pip install -q -r requirements.lock "pytest>=8,<10" "ruff>=0.9,<1" httpx
  fi
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$PWD/.venv/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

if [ -f frontend/package.json ]; then
  (cd frontend && npm install --no-audit --no-fund --loglevel=error)
fi
