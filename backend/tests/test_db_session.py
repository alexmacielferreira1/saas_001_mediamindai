from contextlib import nullcontext

import app.db.session as db
from sqlalchemy.exc import SQLAlchemyError


def test_get_session_yields_and_closes_the_session(monkeypatch):
    class FakeSession:
        closed = False

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            self.closed = True

    fake = FakeSession()
    monkeypatch.setattr(db, "SessionLocal", lambda: fake)

    dependency = db.get_session()
    assert next(dependency) is fake
    dependency.close()
    assert fake.closed is True


def test_database_available_requires_select_one(monkeypatch):
    class Connection:
        def scalar(self, _statement):
            return 1

    monkeypatch.setattr(db.engine, "connect", lambda: nullcontext(Connection()))
    assert db.database_available() is True


def test_database_unavailable_is_reported_without_leaking_driver_error(monkeypatch):
    class BrokenConnection:
        def __enter__(self):
            raise SQLAlchemyError("secret database detail")

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(db.engine, "connect", BrokenConnection)
    assert db.database_available() is False
