from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.demo_seed import seed_demo_accounts


def main() -> None:
    settings = get_settings()
    if settings.demo_password is None:
        raise SystemExit("Defina DEMO_PASSWORD no .env local antes de executar o seed.")
    with SessionLocal() as session:
        result = seed_demo_accounts(
            session,
            settings.demo_password.get_secret_value(),
            settings.environment,
        )
    print(f"Contas demo preparadas: {result['created']} criadas, {result['updated']} atualizadas.")


if __name__ == "__main__":
    main()
