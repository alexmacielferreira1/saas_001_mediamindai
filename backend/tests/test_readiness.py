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
