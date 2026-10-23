"""Hook PostToolUse: formata com ruff o arquivo Python que o agente acabou de editar.

Só formata (nunca aplica `ruff check --fix`, que removeria imports ainda em uso numa
edição em andamento). Falha em silêncio: nunca bloqueia o agente.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def ruff_executable(root: Path) -> str | None:
    for candidate in (root / ".venv" / "bin" / "ruff", root / ".venv" / "Scripts" / "ruff.exe"):
        if candidate.exists():
            return str(candidate)
    return shutil.which("ruff")


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        return
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not file_path.endswith(".py"):
        return
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or ".")
    ruff = ruff_executable(root)
    if ruff and Path(file_path).exists():
        subprocess.run([ruff, "format", "--quiet", file_path], cwd=root, timeout=30, check=False)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 - hook nunca deve interromper o agente
        pass
