from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    get_settings().database_url.get_secret_value(),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_timeout=3,
    connect_args={"connect_timeout": 3, "options": "-c statement_timeout=3000"},
    hide_parameters=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session():
    with SessionLocal() as session:
        yield session


def release_connection(session: Session) -> None:
    """Encerra a transação da requisição e devolve a conexão ao pool antes de trabalho longo.

    Usado antes de FFmpeg, transcrição/análise e chamadas HTTP a provedores de IA, para que
    poucas requisições demoradas não esgotem o pool (auditoria 2026-10-23, #6). Grava o que
    estiver pendente; com ``expire_on_commit=False`` os objetos carregados continuam
    utilizáveis e a próxima consulta abre outra transação.
    """
    session.commit()


def database_available() -> bool:
    try:
        with engine.connect() as connection:
            return connection.scalar(text("SELECT 1")) == 1
    except SQLAlchemyError:
        return False
