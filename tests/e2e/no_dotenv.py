"""Executa API, Alembic ou seed do E2E ignorando o ``.env`` da raiz do checkout.

O E2E recebe toda a configuração por variáveis de ambiente montadas pelo
``scripts/e2e.ps1`` (banco ``*_e2e``, segredos de teste gerados na hora). Desligar o
``env_file`` garante que chaves reais de IA, OAuth ou senhas demo de um ``.env`` local
nunca entrem no processo de teste.

Uso: ``python tests/e2e/no_dotenv.py api|migrate|seed``.
"""

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core import config  # noqa: E402

config.Settings.model_config["env_file"] = None
config.get_settings.cache_clear()


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    settings = config.get_settings()
    if settings.environment != "test" or not settings.database_url.get_secret_value().rsplit(
        "/", 1
    )[-1].endswith("_e2e"):
        raise SystemExit("no_dotenv: requer ENVIRONMENT=test e banco *_e2e.")
    if command == "api":
        import uvicorn

        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=settings.api_port,
            log_level="warning",
            access_log=False,
        )
    elif command == "migrate":
        from alembic.config import main as alembic_main

        alembic_main(argv=["-c", str(ROOT / "alembic.ini"), "upgrade", "head"])
    elif command == "seed":
        runpy.run_path(str(Path(__file__).with_name("seed_e2e.py")), run_name="__main__")
    else:
        raise SystemExit("uso: no_dotenv.py api|migrate|seed")


if __name__ == "__main__":
    main()
