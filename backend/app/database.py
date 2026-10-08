from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL


def normalise_url(url: str) -> str:
    """Hosted Postgres providers (Neon, Supabase, Render, ...) hand out postgres:// or postgresql:// URLs.
    SQLAlchemy needs to be told which driver to use, so route them to psycopg 3."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


URL = normalise_url(DATABASE_URL)
IS_SQLITE = URL.startswith("sqlite")

if IS_SQLITE:
    # Local development / tests: a single file, WAL for concurrent readers, foreign keys on.
    engine = create_engine(URL, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()
else:
    # Hosted Postgres (e.g. Neon). Serverless Postgres suspends idle compute and drops connections, so:
    #  - pool_pre_ping: test a connection before using it and transparently reconnect if it was dropped
    #  - pool_recycle:  never reuse a connection older than 4 minutes
    #  - prepare_threshold=None: no server-side prepared statements, which poolers (PgBouncer) can break
    engine = create_engine(URL, pool_pre_ping=True, pool_recycle=240, pool_size=5, max_overflow=5,
                           connect_args={"prepare_threshold": None})

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
