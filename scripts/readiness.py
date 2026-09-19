"""Run all M0 checks and preserve failures; never silently waive original frontend defects."""

import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime

from app.core.config import ROOT


def evaluate_checks(checks):
    states = [item["status"] for item in checks.values()]
    if "failed" in states:
        return "failed"
    if not states or any(status not in ("passed", "not_applicable") for status in states):
        return "blocked"
    return "passed"


def run_check(name, args, env=None):
    log = ROOT / ".runtime" / "checks" / f"{name}.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC).isoformat()
    try:
        completed = subprocess.run(
            args,
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
        )
        log.write_text(completed.stdout + completed.stderr, encoding="utf-8")
        status = "passed" if completed.returncode == 0 else "failed"
        notes = f"Exit {completed.returncode}; evidence: {log.relative_to(ROOT).as_posix()}"
    except (OSError, subprocess.TimeoutExpired) as exc:
        status = "blocked"
        notes = f"Unable to execute ({type(exc).__name__})"
        log.write_text(notes + "\n", encoding="utf-8")
    print(f"{name}: {status}", flush=True)
    return {"status": status, "updated_at": now, "notes": notes}


def main():
    state_file = ROOT / "project-status.json"
    state = json.loads(state_file.read_text(encoding="utf-8"))
    if state["current_milestone"] != "M0":
        raise SystemExit("This verifier handles M0 only; later milestones require their own gates.")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    py = sys.executable
    integration_env = dict(os.environ, HUB_INTEGRATION="1")
    commands = [
        (
            "backend_lint",
            [py, "-m", "ruff", "check", "backend", "tests", "alembic", "scripts"],
            None,
        ),
        (
            "backend_format",
            [py, "-m", "ruff", "format", "--check", "backend", "tests", "alembic", "scripts"],
            None,
        ),
        ("unit_tests", [py, "-m", "pytest", "backend/tests", "-q"], None),
        ("migration", [py, "-m", "alembic", "upgrade", "head"], None),
        ("database_integration", [py, "-m", "pytest", "tests/integration", "-q"], integration_env),
        ("dependency_consistency", [py, "-m", "pip", "check"], None),
        ("frontend_build", [npm or "npm", "--prefix", "frontend", "run", "build"], None),
        ("frontend_lint", [npm or "npm", "--prefix", "frontend", "run", "lint"], None),
        ("frontend_typecheck", [npm or "npm", "--prefix", "frontend", "run", "typecheck"], None),
        ("http_smoke", [py, "scripts/smoke.py"], None),
    ]
    checks = {name: run_check(name, args, env) for name, args, env in commands}
    now = datetime.now(UTC).isoformat()
    manifest = json.loads((ROOT / "docs/history/base44-manifest.json").read_text())
    changed = []
    for item in manifest:
        file = ROOT / "frontend" / item["path"]
        if not file.exists() or hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]:
            changed.append(item["path"])
    checks["original_frontend_integrity"] = {
        "status": "passed" if not changed else "failed",
        "updated_at": now,
        "notes": f"{len(manifest)} original files; {len(changed)} changed or missing. "
        + ", ".join(changed),
    }
    checks["frontend_functional_validation"] = state.get("manual_checks", {}).get(
        "frontend_functional_validation",
        {
            "status": "blocked",
            "updated_at": now,
            "notes": (
                "Original export requires Base44 configuration; frontend not validated in browser. "
                "See docs/BASE44_MIGRATION_MAP.md. HTTP/build alone is insufficient."
            ),
        },
    )
    manual = checks["frontend_functional_validation"]
    if manual.get("status") == "passed" and not (manual.get("notes") and manual.get("updated_at")):
        manual.update(status="blocked", notes="Manual verification needs dated evidence.")
    git = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    checks["git_clean_at_check"] = {
        "status": "passed" if git.returncode == 0 and not git.stdout.strip() else "pending",
        "updated_at": now,
        "notes": "Snapshot before writing this report. Verify and commit reviewed work separately.",
    }
    milestone = state["milestones"]["M0"]
    overall = evaluate_checks(checks)
    milestone.update(
        status=overall,
        checks=checks,
        updated_at=now,
        notes=(
            "All recorded M0 checks passed."
            if overall == "passed"
            else "Partial M0; unresolved gates. Do not advance to M1."
        ),
    )
    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = [
        "# Estado do projeto",
        "",
        f"Marco atual: **M0 — {overall}**.",
        "",
        f"Verificado em {now}.",
        "",
        "| Verificação | Estado | Evidência |",
        "|---|---|---|",
    ]
    for name, result in checks.items():
        report.append(f"| {name} | {result['status']} | {result['notes']} |")
    report += [
        "",
        "M1–M7 continuam pendentes. Os relatórios não comprovam paridade nem uso em produção.",
        "Não ignorar testes nem desligar verificações. Resolver a causa e executar novamente.",
    ]
    (ROOT / "docs/PROJECT_STATUS.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    return 0 if overall == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
