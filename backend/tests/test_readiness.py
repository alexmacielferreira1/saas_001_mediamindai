import importlib.util

import pytest
from app.core.config import ROOT

spec = importlib.util.spec_from_file_location("hub_readiness", ROOT / "scripts/readiness.py")
readiness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(readiness)


@pytest.mark.parametrize(
    "statuses,expected",
    [
        (["passed", "passed"], "passed"),
        (["passed", "failed"], "failed"),
        (["failed", "blocked"], "failed"),
        (["passed", "blocked"], "blocked"),
        (["passed", "pending"], "blocked"),
        ([], "blocked"),
    ],
)
def test_gate_never_hides_a_failed_or_unchecked_requirement(statuses, expected):
    checks = {str(i): {"status": status} for i, status in enumerate(statuses)}
    assert readiness.evaluate_checks(checks) == expected


def test_missing_executable_is_reported_as_blocked(tmp_path, monkeypatch):
    monkeypatch.setattr(readiness, "ROOT", tmp_path)
    result = readiness.run_check("missing", [str(tmp_path / "does-not-exist.exe")])
    assert result["status"] == "blocked"
    assert (tmp_path / ".runtime/checks/missing.log").exists()


def test_frontend_integrity_accepts_only_exact_audited_change(tmp_path):
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    file = frontend / "component.jsx"
    file.write_text("typed correction", encoding="utf-8")
    import hashlib

    baseline_hash = hashlib.sha256(b"original export").hexdigest()
    current_hash = hashlib.sha256(file.read_bytes()).hexdigest()
    manifest = [{"path": "component.jsx", "sha256": baseline_hash}]
    approval = [
        {
            "path": "component.jsx",
            "baseline_sha256": baseline_hash,
            "approved_sha256": current_hash,
            "reason": "Add type descriptions without changing runtime behavior.",
        }
    ]

    assert readiness.verify_frontend_integrity(frontend, manifest, approval) == ([], 1)

    file.write_text("unexpected later edit", encoding="utf-8")
    violations, approved_count = readiness.verify_frontend_integrity(frontend, manifest, approval)
    assert violations == ["component.jsx"]
    assert approved_count == 0
