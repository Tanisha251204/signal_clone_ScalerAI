import os
import tempfile

_tmp = tempfile.mkdtemp()
# Default: throwaway SQLite. Set TEST_DATABASE_URL (an EMPTY Postgres database) to run the same suite against Postgres.
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL") or f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["SEED_DEMO_DATA"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, phone):
    r = client.post("/api/auth/login", json={"identifier": phone, "otp": "123456"})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], {"Authorization": f"Bearer {d['token']}"}, d["user"]


@pytest.fixture(scope="session")
def aarav(client):
    return login(client, "+919810000001")


@pytest.fixture(scope="session")
def priya(client):
    return login(client, "+919810000002")


@pytest.fixture(scope="session")
def rohan(client):
    return login(client, "+919810000003")
