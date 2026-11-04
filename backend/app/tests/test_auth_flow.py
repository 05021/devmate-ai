"""认证链路测试：注册/登录/登出/全局锁/团队创建/邀请码加入。"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db.session import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(engine)

app = create_app()


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def _register(username="alice", email="alice@test.dev", password="password123"):
    return client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )


def _login(account="alice", password="password123"):
    return client.post("/api/auth/login", json={"account": account, "password": password})


def test_register_creates_user_with_public_code():
    resp = _register()
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["public_code"].startswith("DM-")
    assert body["memberships"] == []
    # 会话 cookie 已下发
    assert "dm_session" in resp.cookies


def test_register_rejects_duplicate_email_and_username():
    assert _register(username="dupuser", email="dup@test.dev").status_code == 201
    assert _register(username="bob", email="dup@test.dev").status_code == 409
    assert _register(username="dupuser", email="other@test.dev").status_code == 409


def test_register_rejects_weak_password():
    resp = _register(username="weak", email="weak@test.dev", password="123")
    assert resp.status_code == 422


def test_login_success_and_wrong_password():
    _register(username="carol", email="carol@test.dev")
    ok = _login("carol")
    assert ok.status_code == 200
    assert ok.json()["username"] == "carol"
    bad = client.post("/api/auth/login", json={"account": "carol", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_protected_api_requires_login():
    client.cookies.clear()
    resp = client.get("/api/repos")
    assert resp.status_code == 401
    # 白名单放行
    assert client.get("/health").status_code == 200


def test_authenticated_access_after_login():
    _register(username="dave", email="dave@test.dev")
    _login("dave")
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "dave"


def test_create_team_and_invite_join():
    _register(username="owner1", email="owner1@test.dev")
    created = client.post("/api/teams", json={"name": "Alpha Team"})
    assert created.status_code == 201, created.text
    team = created.json()
    assert team["role"] == "owner"
    invite_code = team.get("invite_code")

    me = client.get("/api/auth/me").json()
    assert me["memberships"][0]["team_name"] == "Alpha Team"

    # 第二个用户凭邀请码加入
    _register(username="member1", email="member1@test.dev")
    joined = client.post("/api/teams/join", json={"invite_code": invite_code})
    assert joined.status_code == 200, joined.text
    assert joined.json()["role"] == "member"

    members = client.get(f"/api/teams/{team['team_id']}/members")
    assert members.status_code == 200
    roles = {m["username"]: m["role"] for m in members.json()}
    assert roles == {"owner1": "owner", "member1": "member"}


def test_join_with_invalid_code():
    _register(username="stray", email="stray@test.dev")
    resp = client.post("/api/teams/join", json={"invite_code": "WRONG123"})
    assert resp.status_code == 404


def test_member_cannot_rotate_invite_code():
    _register(username="owner2", email="owner2@test.dev")
    team = client.post("/api/teams", json={"name": "Beta Team"}).json()
    code = team["invite_code"]
    _register(username="mem2", email="mem2@test.dev")
    client.post("/api/teams/join", json={"invite_code": code})
    resp = client.post(f"/api/teams/{team['team_id']}/invite-code/rotate")
    assert resp.status_code == 403


def test_logout_clears_session():
    _register(username="erin", email="erin@test.dev")
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_change_password():
    _register(username="frank", email="frank@test.dev", password="password123")
    wrong_old = client.post(
        "/api/auth/change-password",
        json={"old_password": "nope", "new_password": "newpass456"},
    )
    assert wrong_old.status_code == 403
    ok = client.post(
        "/api/auth/change-password",
        json={"old_password": "password123", "new_password": "newpass456"},
    )
    assert ok.status_code == 200
    client.cookies.clear()
    relogin = client.post("/api/auth/login", json={"account": "frank", "password": "newpass456"})
    assert relogin.status_code == 200
