"""MM-259: lógica do backup/restore local, sem tocar em Docker nem no banco real."""

import importlib.util
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "db_backup.py"


def load_script():
    spec = importlib.util.spec_from_file_location("db_backup", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # dataclasses resolve the module by name
    spec.loader.exec_module(module)
    return module


db = load_script()


class FakeDocker:
    """Records every command and answers like the container would."""

    def __init__(self, *, exists="", source="", restored="", fail_on=None, dump=b"PGDMP"):
        self.calls = []
        self.answers = {"exists": exists, "source": source, "restored": restored}
        self.fail_on = fail_on
        self.dump = dump

    def __call__(self, command, check=False, **kwargs):
        script = command[-1]
        self.calls.append(script)
        fail_on = (self.fail_on,) if isinstance(self.fail_on, str) else self.fail_on or ()
        code = 1 if any(part in script for part in fail_on) else 0
        if command[:2] == ["docker", "ps"]:
            return subprocess.CompletedProcess(command, 0, stdout="abc123\n")
        if script.startswith("pg_dump"):
            kwargs["stdout"].write(self.dump)
            return subprocess.CompletedProcess(command, code)
        out = ""
        if "printf" in script:
            out = "mediamind"
        elif "pg_database" in script:
            out = self.answers["exists"]
        elif "information_schema" in script:
            out = self.answers["restored" if "_restore_check" in script else "source"]
        return subprocess.CompletedProcess(command, code, stdout=out)


@pytest.fixture
def docker(monkeypatch):
    def install(**kwargs):
        fake = FakeDocker(**kwargs)
        monkeypatch.setattr(db.subprocess, "run", fake)
        return fake

    return install


def test_check_database_never_targets_main_or_system_databases():
    for name in ("mediamind", "postgres", "template1"):
        with pytest.raises(db.BackupError):
            db.validate_check_database(name, "mediamind")
    with pytest.raises(db.BackupError):
        db.validate_check_database("outro_banco", "mediamind")
    with pytest.raises(db.BackupError):
        db.validate_check_database("x; drop database mediamind", "mediamind")
    assert db.validate_check_database("mediamind_restore_check", "mediamind")


def test_commands_run_inside_container_without_credentials():
    dump = db.dump_command("c1")
    restore = db.restore_command("c1", "mediamind_restore_check")
    count = db.count_rows_command("c1", None)

    assert dump[:3] == ["docker", "exec", "c1"]
    assert "pg_dump" in dump[-1] and "-Fc" in dump[-1] and '"$POSTGRES_DB"' in dump[-1]
    assert restore[:3] == ["docker", "exec", "-i"]
    assert "-d mediamind_restore_check" in restore[-1]
    assert '-d "$POSTGRES_DB"' in count[-1]
    drop = db.drop_db_command("c1", "mediamind_restore_check")
    assert "--if-exists mediamind_restore_check" in drop[-1]
    for command in (dump, restore, count):
        assert "PASSWORD" not in " ".join(command)
    assert "label=com.docker.compose.service=postgres" in db.find_container_command()


def test_backup_file_name_is_timestamped_in_utc():
    assert db.backup_file_name(datetime(2026, 10, 20, 15, 4, 5, tzinfo=UTC)) == (
        "mediamind-20261020-150405.dump"
    )


def test_counts_are_parsed_and_compared():
    source = db.parse_counts("users|3\ntenants|1\n\n")
    assert source == {"users": 3, "tenants": 1}
    same = db.compare_counts(source, {"tenants": 1, "users": 3})
    assert same.matches and same.tables == 2 and same.rows == 4
    diff = db.compare_counts(source, {"users": 2})
    assert not diff.matches
    assert diff.differences == {"tenants": (1, None), "users": (3, 2)}
    assert not db.compare_counts({}, {}).matches


def test_backup_writes_into_runtime_folder(docker, tmp_path):
    docker(source="users|3\ntenants|1\n")

    path = db.backup(tmp_path / "backups", datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC))

    assert path.name == "mediamind-20260102-030405.dump"
    assert path.read_bytes() == b"PGDMP"
    assert not list(path.parent.glob("*.partial"))
    assert db.BACKUP_DIR.parts[-2:] == (".runtime", "backups")
    manifest = json.loads((path.parent / "mediamind-20260102-030405.counts.json").read_text())
    assert manifest["counts"] == {"users": 3, "tenants": 1}
    assert manifest["tables"] == 2 and manifest["rows"] == 4
    assert manifest["backup"] == path.name
    assert db.read_counts(path) == {"users": 3, "tenants": 1}


def test_failed_count_after_dump_leaves_no_backup(docker, tmp_path):
    docker(fail_on="information_schema")

    with pytest.raises(db.BackupError, match="contar as linhas"):
        db.backup(tmp_path, datetime(2026, 1, 2, tzinfo=UTC))

    assert list(tmp_path.iterdir()) == []


def test_failed_dump_leaves_no_partial_file(docker, tmp_path):
    docker(fail_on="pg_dump")

    with pytest.raises(db.BackupError):
        db.backup(tmp_path, datetime(2026, 1, 2, tzinfo=UTC))

    assert list(tmp_path.iterdir()) == []


def test_restore_check_creates_restores_compares_and_drops_only_check_db(docker, tmp_path):
    fake = docker(source="users|2\n", restored="users|2\n")
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")

    report = db.restore_check(dump)

    assert report.matches
    steps = [call.split()[0] for call in fake.calls[1:]]
    assert steps == ["printf", "psql", "createdb", "pg_restore", "psql", "psql", "dropdb"]
    assert fake.calls[-1].endswith("mediamind_restore_check")
    assert not any("dropdb" in call and call.endswith(" mediamind") for call in fake.calls)


def test_restore_check_compares_with_counts_recorded_in_the_backup(docker, tmp_path):
    # Banco principal mudou depois do backup: a comparação usa o que foi gravado no backup.
    fake = docker(source="users|9\n", restored="users|2\n")
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")
    db.write_counts(dump, {"users": 2}, datetime(2026, 1, 2, tzinfo=UTC))

    report = db.restore_check(dump)

    assert report.matches and report.baseline == "backup" and report.rows == 2
    steps = [call.split()[0] for call in fake.calls[1:]]
    assert steps == ["printf", "psql", "createdb", "pg_restore", "psql", "dropdb"]
    assert not any(
        '-d "$POSTGRES_DB"' in call and "information_schema" in call for call in fake.calls
    )

    docker(restored="users|1\n")
    differs = db.restore_check(dump)
    assert not differs.matches and differs.differences == {"users": (2, 1)}


def test_restore_check_without_counts_file_falls_back_to_main_database(docker, tmp_path):
    docker(source="users|2\n", restored="users|2\n")
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")

    report = db.restore_check(dump)

    assert report.matches and report.baseline == "principal atual"


def test_invalid_counts_file_is_refused_before_creating_the_check_db(docker, tmp_path):
    fake = docker()
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")
    db.counts_path(dump).write_text("{nada", encoding="utf-8")

    with pytest.raises(db.BackupError, match="contagens inválido"):
        db.restore_check(dump)
    db.counts_path(dump).write_text(json.dumps({"counts": {"users": "x"}}), encoding="utf-8")
    with pytest.raises(db.BackupError, match="contagens inválido"):
        db.restore_check(dump)
    assert not any(call.startswith(("createdb", "pg_restore")) for call in fake.calls)


def test_failed_drop_is_reported_separately(docker, tmp_path, capsys):
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")
    db.write_counts(dump, {"users": 2}, datetime(2026, 1, 2, tzinfo=UTC))

    # Restore ok, mas o dropdb falhou: o erro aparece (o banco precisa ser apagado à mão).
    docker(restored="users|2\n", fail_on="dropdb")
    with pytest.raises(db.BackupError, match="apagar o banco de verificação"):
        db.restore_check(dump)

    # Restore e dropdb falharam: o erro original continua sendo o do restore.
    docker(fail_on=("pg_restore", "dropdb"))
    with pytest.raises(db.BackupError, match="pg_restore"):
        db.restore_check(dump)
    assert "AVISO: Não foi possível apagar" in capsys.readouterr().err


def test_restore_check_drops_check_db_even_when_restore_fails(docker, tmp_path):
    fake = docker(fail_on="pg_restore")
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")

    with pytest.raises(db.BackupError):
        db.restore_check(dump)

    assert fake.calls[-1].startswith("dropdb") and "mediamind_restore_check" in fake.calls[-1]


def test_restore_check_refuses_existing_check_db_and_main_db(docker, tmp_path):
    fake = docker(exists="1")
    dump = tmp_path / "mediamind-1.dump"
    dump.write_bytes(b"PGDMP")

    with pytest.raises(db.BackupError, match="já existe"):
        db.restore_check(dump)
    with pytest.raises(db.BackupError, match="banco principal"):
        db.restore_check(dump, "mediamind")
    assert not any(call.startswith(("createdb", "dropdb", "pg_restore")) for call in fake.calls)
    with pytest.raises(db.BackupError):
        db.restore_check(tmp_path / "missing.dump")


def test_missing_container_and_missing_backup_are_clear_errors(monkeypatch, tmp_path):
    monkeypatch.setattr(
        db.subprocess,
        "run",
        lambda command, **kwargs: subprocess.CompletedProcess(command, 0, stdout=""),
    )
    with pytest.raises(db.BackupError, match="não está rodando"):
        db.find_container()
    with pytest.raises(db.BackupError, match="Nenhum backup"):
        db.latest_backup(tmp_path)

    def no_docker(*args, **kwargs):
        raise FileNotFoundError

    monkeypatch.setattr(db.subprocess, "run", no_docker)
    with pytest.raises(db.BackupError, match="Docker"):
        db.find_container()


def test_main_reports_exit_codes(docker, monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(db, "BACKUP_DIR", tmp_path)
    monkeypatch.setattr(db, "PROJECT_ROOT", tmp_path.parent)
    docker(source="users|2\n", restored="users|2\n")
    monkeypatch.setattr(db, "backup", lambda: tmp_path / "mediamind-1.dump")
    (tmp_path / "mediamind-1.dump").write_bytes(b"PGDMP")

    assert db.main(["backup"]) == 0
    assert db.main(["restore-check"]) == 0
    docker(source="users|2\n", restored="users|1\n")
    assert db.main(["restore-check", "--file", str(tmp_path / "mediamind-1.dump")]) == 2
    assert db.main(["restore-check", "--target", "mediamind"]) == 1
    output = capsys.readouterr()
    assert "Restore verificado" in output.out
    assert "AVISO: backup sem .counts.json" in output.out
    assert "DIFERENÇA users: banco principal atual=2 restaurado=1" in output.err
    assert "banco principal" in output.err

    db.write_counts(tmp_path / "mediamind-1.dump", {"users": 1}, datetime(2026, 1, 2, tzinfo=UTC))
    assert db.main(["restore-check"]) == 0
    docker(restored="users|3\n")
    assert db.main(["restore-check"]) == 2
    output = capsys.readouterr()
    assert "linhas no backup: 1" in output.out
    assert "AVISO" not in output.out
    assert "DIFERENÇA users: backup=1 restaurado=3" in output.err
