"""Backup e verificação de restore do PostgreSQL local do MediaMind (MM-259).

Uso (da raiz do produto):

    .venv/Scripts/python.exe scripts/db_backup.py backup
    .venv/Scripts/python.exe scripts/db_backup.py restore-check [--file caminho.dump]

* ``backup`` roda ``pg_dump -Fc`` dentro do container ``postgres`` do ``compose.yaml`` e
  grava em ``.runtime/backups/`` (pasta ignorada pelo Git), junto com
  ``<nome>.counts.json``: tabelas e linhas do banco lidas logo após o dump. Com escrita
  concorrente durante o backup essas contagens podem diferir do dump; rode com o app parado.
* ``restore-check`` cria um banco NOVO de verificação (padrão ``mediamind_restore_check``),
  restaura o arquivo nele, compara tabelas e contagem de linhas com as gravadas no backup
  (backups antigos sem ``.counts.json``: compara com o banco principal atual e avisa) e
  apaga somente esse banco de verificação criado pelo próprio script. O banco principal
  nunca é alvo de restore; se o banco de verificação já existir, o script recusa. Falha ao
  apagar o banco de verificação é informada à parte, sem esconder o erro do restore.

As credenciais não são lidas nem impressas: os comandos rodam dentro do container usando
``$POSTGRES_USER``/``$POSTGRES_DB`` do próprio container (conexão local por socket).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKUP_DIR = PROJECT_ROOT / ".runtime" / "backups"
COMPOSE_PROJECT = "hub-mediamind"
COMPOSE_SERVICE = "postgres"
DEFAULT_CHECK_DB = "mediamind_restore_check"
CHECK_DB_SUFFIX = "_restore_check"
SAFE_DB_NAME = re.compile(r"^[a-z][a-z0-9_]{0,62}$")

# Conta as linhas de cada tabela do schema public numa única consulta.
COUNT_ROWS_SQL = (
    "SELECT table_name, (xpath('/row/c/text()', query_to_xml(format("
    "'select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]"
    "::text FROM information_schema.tables WHERE table_schema = 'public' "
    "AND table_type = 'BASE TABLE' ORDER BY table_name"
)


class BackupError(RuntimeError):
    """Falha esperada, com mensagem segura para o terminal."""


@dataclass(frozen=True)
class CountReport:
    matches: bool
    tables: int
    rows: int
    differences: dict[str, tuple[int | None, int | None]]
    baseline: str = "backup"


def backup_file_name(now: datetime) -> str:
    return f"mediamind-{now.astimezone(UTC):%Y%m%d-%H%M%S}.dump"


def counts_path(dump: Path) -> Path:
    return dump.with_suffix(".counts.json")


def write_counts(dump: Path, counts: dict[str, int], now: datetime) -> Path:
    target = counts_path(dump)
    payload = {
        "backup": dump.name,
        "created_at": now.astimezone(UTC).isoformat(),
        "tables": len(counts),
        "rows": sum(counts.values()),
        "counts": counts,
    }
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return target


def read_counts(dump: Path) -> dict[str, int] | None:
    """Contagens gravadas no backup; ``None`` quando o backup é antigo (sem arquivo)."""
    path = counts_path(dump)
    if not path.is_file():
        return None
    try:
        counts = json.loads(path.read_text(encoding="utf-8"))["counts"]
        return {str(table): int(value) for table, value in counts.items()}
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise BackupError(f"Arquivo de contagens inválido: {path.name}") from exc


def validate_check_database(target: str, main_db: str) -> str:
    """Só aceita um banco de verificação descartável, nunca o banco principal."""
    if not SAFE_DB_NAME.fullmatch(target):
        raise BackupError("Nome de banco de verificação inválido.")
    if target == main_db or target in {"postgres", "template0", "template1"}:
        raise BackupError("Recusado: o restore nunca é feito no banco principal.")
    if not target.endswith(CHECK_DB_SUFFIX):
        raise BackupError(f"O banco de verificação precisa terminar em '{CHECK_DB_SUFFIX}'.")
    return target


def container_shell(container: str, script: str, *, stdin: bool = False) -> list[str]:
    command = ["docker", "exec"]
    if stdin:
        command.append("-i")
    return [*command, container, "sh", "-c", script]


def find_container_command() -> list[str]:
    return [
        "docker",
        "ps",
        "-q",
        "--filter",
        f"label=com.docker.compose.project={COMPOSE_PROJECT}",
        "--filter",
        f"label=com.docker.compose.service={COMPOSE_SERVICE}",
    ]


def dump_command(container: str) -> list[str]:
    return container_shell(
        container, 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl'
    )


def main_db_command(container: str) -> list[str]:
    return container_shell(container, 'printf %s "$POSTGRES_DB"')


def database_exists_command(container: str, target: str) -> list[str]:
    sql = f"SELECT 1 FROM pg_database WHERE datname = '{target}'"
    return container_shell(container, f'psql -U "$POSTGRES_USER" -d postgres -At -c "{sql}"')


def create_db_command(container: str, target: str) -> list[str]:
    return container_shell(container, f'createdb -U "$POSTGRES_USER" {target}')


def restore_command(container: str, target: str) -> list[str]:
    return container_shell(
        container,
        f'pg_restore -U "$POSTGRES_USER" -d {target} --no-owner --no-acl --exit-on-error',
        stdin=True,
    )


def count_rows_command(container: str, database: str | None) -> list[str]:
    db = database or '"$POSTGRES_DB"'
    return container_shell(
        container, f'psql -U "$POSTGRES_USER" -d {db} -At -F "|" -c "{COUNT_ROWS_SQL}"'
    )


def drop_db_command(container: str, target: str) -> list[str]:
    return container_shell(container, f'dropdb -U "$POSTGRES_USER" --if-exists {target}')


def parse_counts(output: str) -> dict[str, int]:
    counts = {}
    for line in output.splitlines():
        if not line.strip():
            continue
        table, _, value = line.partition("|")
        counts[table.strip()] = int(value.strip() or 0)
    return counts


def compare_counts(source: dict[str, int], restored: dict[str, int]) -> CountReport:
    differences = {
        table: (source.get(table), restored.get(table))
        for table in sorted(set(source) | set(restored))
        if source.get(table) != restored.get(table)
    }
    return CountReport(
        matches=not differences and bool(source),
        tables=len(source),
        rows=sum(source.values()),
        differences=differences,
    )


def drop_check_database(container: str, target: str, original: BaseException | None) -> None:
    """Apaga o banco de verificação; a falha não substitui o erro original do restore."""
    try:
        run(drop_db_command(container, target))
    except BackupError as drop_error:
        message = (
            f"Não foi possível apagar o banco de verificação '{target}'; apague-o manualmente."
        )
        if original is None:
            raise BackupError(message) from drop_error
        print(f"AVISO: {message}", file=sys.stderr)


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    try:
        result = subprocess.run(command, check=False, capture_output=True, **kwargs)
    except FileNotFoundError as exc:
        raise BackupError("Docker não encontrado. Abra o Docker Desktop.") from exc
    if result.returncode != 0:
        # Não repassa stderr: pode conter nomes de usuário ou detalhes do servidor.
        raise BackupError(f"Comando falhou (código {result.returncode}): {command[-1][:60]}")
    return result


def find_container() -> str:
    container = run(find_container_command(), text=True).stdout.strip().splitlines()
    if not container:
        raise BackupError("Container do PostgreSQL não está rodando (rode scripts/dev.ps1).")
    return container[0]


def backup(output_dir: Path | None = None, now: datetime | None = None) -> Path:
    container = find_container()
    output_dir = output_dir or BACKUP_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    now = now or datetime.now(UTC)
    target = output_dir / backup_file_name(now)
    partial = target.with_suffix(".partial")
    try:
        with partial.open("wb") as handle:
            result = subprocess.run(dump_command(container), check=False, stdout=handle)
        if result.returncode != 0 or partial.stat().st_size == 0:
            raise BackupError("pg_dump falhou; nenhum backup foi gravado.")
        try:
            counts = parse_counts(run(count_rows_command(container, None), text=True).stdout)
        except BackupError as exc:
            raise BackupError("Falha ao contar as linhas; nenhum backup foi gravado.") from exc
        write_counts(target, counts, now)
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)
    return target


def latest_backup(directory: Path | None = None) -> Path:
    files = sorted((directory or BACKUP_DIR).glob("mediamind-*.dump"))
    if not files:
        raise BackupError("Nenhum backup encontrado em .runtime/backups/.")
    return files[-1]


def restore_check(dump: Path, target: str = DEFAULT_CHECK_DB) -> CountReport:
    if not dump.is_file():
        raise BackupError("Arquivo de backup não encontrado.")
    container = find_container()
    main_db = run(main_db_command(container), text=True).stdout.strip()
    validate_check_database(target, main_db)
    if run(database_exists_command(container, target), text=True).stdout.strip():
        raise BackupError(f"O banco '{target}' já existe; apague-o manualmente antes.")
    source = read_counts(dump)
    baseline = "backup"
    run(create_db_command(container, target))
    failure: BaseException | None = None
    try:
        with dump.open("rb") as handle:
            run(restore_command(container, target), stdin=handle)
        if source is None:
            baseline = "principal atual"
            source = parse_counts(run(count_rows_command(container, None), text=True).stdout)
        restored = parse_counts(run(count_rows_command(container, target), text=True).stdout)
        report = compare_counts(source, restored)
        return CountReport(report.matches, report.tables, report.rows, report.differences, baseline)
    except BaseException as exc:
        failure = exc
        raise
    finally:
        # Só apaga o banco de verificação que este script acabou de criar.
        drop_check_database(container, target, failure)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("backup", help="Gera um backup em .runtime/backups/")
    check = sub.add_parser("restore-check", help="Restaura em banco novo e compara contagens")
    check.add_argument("--file", type=Path, help="Backup a restaurar (padrão: o mais recente)")
    check.add_argument("--target", default=DEFAULT_CHECK_DB, help="Banco de verificação")
    args = parser.parse_args(argv)
    try:
        if args.command == "backup":
            path = backup()
            print(f"Backup gravado: {path.relative_to(PROJECT_ROOT)} ({path.stat().st_size} bytes)")
            return 0
        report = restore_check(args.file or latest_backup(), args.target)
    except BackupError as error:
        print(f"ERRO: {error}", file=sys.stderr)
        return 1
    origin = "backup" if report.baseline == "backup" else "banco principal atual"
    if report.baseline != "backup":
        print("AVISO: backup sem .counts.json; comparando com o banco principal atual.")
    print(f"Tabelas: {report.tables} | linhas no {origin}: {report.rows}")
    if report.matches:
        print("Restore verificado: tabelas e contagens idênticas. Banco de verificação apagado.")
        return 0
    for table, (source, restored) in report.differences.items():
        print(f"DIFERENÇA {table}: {origin}={source} restaurado={restored}", file=sys.stderr)
    return 2


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
